#!/usr/bin/env python3
"""Publish one handoff document against remote main without changing the worktree/index."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile


class HandoffError(Exception):
    pass


def git(root: Path, *args: str, env: dict[str, str] | None = None,
        data: bytes | None = None) -> str:
    try:
        result = subprocess.run(
            ["git", *args], cwd=root, env=env, input=data,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=45,
        )
    except subprocess.TimeoutExpired as exc:
        raise HandoffError(f"git {args[0]} 逾時；請查明遠端狀態，不要假設保存成功。") from exc
    if result.returncode:
        error = result.stderr.decode("utf-8", errors="replace").strip()
        error = re.sub(r"(https?://)[^\s/@]+@", r"\1[redacted]@", error)
        raise HandoffError(f"git {args[0]} 失敗：{error}")
    return result.stdout.decode("utf-8").strip()


def validate_document(root: Path, value: str) -> tuple[str, bytes]:
    # Git path is deliberately restricted: never include source, credentials or arbitrary files.
    if not re.fullmatch(r"docs/handoffs/[a-z0-9][a-z0-9._-]*\.md", value):
        raise HandoffError("只接受 docs/handoffs/ 下已填妥的英數小寫任務 Markdown 路徑。")
    path = root / value
    try:
        resolved = path.resolve(strict=True)
    except FileNotFoundError as exc:
        raise HandoffError("找不到交接文件；請先依範本填寫需求與方向。") from exc
    if not resolved.is_relative_to(root / "docs" / "handoffs") or path.is_symlink():
        raise HandoffError("交接路徑不可使用 symlink 或離開 docs/handoffs/。")
    content = path.read_bytes()
    if len(content) > 256 * 1024:
        raise HandoffError("交接文件超過 256 KiB，請縮短並移除不應放入的資料。")
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise HandoffError("交接文件必須是 UTF-8 Markdown。") from exc
    for section in ("使用者需求", "修改方向", "驗收與驗證", "接手狀態"):
        match = re.search(r"^## " + section + r"\s*\n(.*?)(?=^## |\Z)", text, re.M | re.S)
        if not match or not match[1].strip() or match[1].strip().startswith("待填"):
            raise HandoffError(f"請先填寫「{section}」，不能發布空白範本。")
    return value, content


def publish(path: str, branch: str | None, dry_run: bool, context: dict) -> dict:
    root = Path(git(Path.cwd(), "rev-parse", "--show-toplevel")).resolve()
    relative, content = validate_document(root, path)
    slug = Path(relative).stem
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S-%f")
    branch = branch or f"handoff/{slug}-{stamp}"
    if not branch.startswith("handoff/"):
        raise HandoffError("分支名稱必須以 handoff/ 開頭，不能直接發布至 main。")
    git(root, "check-ref-format", "refs/heads/" + branch)
    context.update(path=relative, branch=branch)
    git(root, "fetch", "origin", "main")
    base = git(root, "rev-parse", "--verify", "FETCH_HEAD^{commit}")
    context["base_commit"] = base
    existing = git(root, "ls-remote", "--heads", "origin", "refs/heads/" + branch)
    if existing:
        raise HandoffError("此 handoff 分支已存在；請用新的分支名稱，不要 force-push。")
    with tempfile.TemporaryDirectory(prefix="travel-handoff-") as temporary:
        environment = os.environ.copy()
        environment["GIT_INDEX_FILE"] = str(Path(temporary) / "index")
        git(root, "read-tree", base, env=environment)
        blob = git(root, "hash-object", "-w", "--stdin", data=content)
        git(root, "update-index", "--add", "--cacheinfo", "100644", blob, relative, env=environment)
        tree = git(root, "write-tree", env=environment)
        changed = git(root, "diff", "--name-only", base, tree).splitlines()
        if not changed:
            return {"status": "already_on_main", **context, "commit": base}
        if changed != [relative]:
            raise HandoffError("Checkpoint 含非指定文件的差異，已停止發布。")
        commit = git(root, "commit-tree", tree, "-p", base,
                     data=f"docs(handoff): checkpoint {slug}\n".encode())
    context["commit"] = commit
    if dry_run:
        return {"status": "dry_run", **context}
    git(root, "push", "origin", f"{commit}:refs/heads/{branch}")
    remote = git(root, "ls-remote", "--heads", "origin", "refs/heads/" + branch)
    fields = remote.split()
    if not fields or fields[0] != commit:
        raise HandoffError("遠端 SHA 尚未確認，請查該 handoff 分支；不要宣稱保存成功。")
    return {"status": "pushed", **context}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", help="已填好的 docs/handoffs/YYYY-MM-DD-task.md")
    parser.add_argument("--branch", help="選用：新的 handoff/... 分支；預設自動產生 UTC 時間戳")
    parser.add_argument("--dry-run", action="store_true", help="建立本機 checkpoint objects，但不推送")
    args = parser.parse_args()
    context: dict = {}
    try:
        result = publish(args.path, args.branch, args.dry_run, context)
    except (HandoffError, OSError) as exc:
        print(json.dumps({"status": "error", **context, "error": str(exc)}, ensure_ascii=False))
        return 1
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
