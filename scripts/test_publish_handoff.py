"""Isolated local-Git checks; never contact GitHub or alter the real checkout."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).with_name("publish-handoff.py").resolve()
DOCUMENT = "docs/handoffs/2026-11-06-test-task.md"
CONTENT = """# 測試交接
## 使用者需求
保存工作計畫。
## 修改方向
修改示範頁的指定欄位。
## 驗收與驗證
執行測試與資料重載。
## 接手狀態
尚未開始改碼，先保存交接。
"""


class PublishHandoffTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="handoff-test-")
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name)
        self.remote = self.base / "remote.git"
        self.root = self.base / "checkout"
        self.root.mkdir()
        self.git("init", "--bare", "--initial-branch=main", str(self.remote))
        self.git("init", "--initial-branch=main")
        self.git("config", "user.name", "Handoff Test")
        self.git("config", "user.email", "handoff-test@example.invalid")
        (self.root / "app.txt").write_text("approved application\n")
        self.git("add", "app.txt")
        self.git("commit", "-m", "approved base")
        self.git("remote", "add", "origin", str(self.remote))
        self.git("push", "origin", "main")
        self.approved = self.git("rev-parse", "HEAD")
        (self.root / DOCUMENT).parent.mkdir(parents=True)
        (self.root / DOCUMENT).write_text(CONTENT)

    def git(self, *args):
        return subprocess.check_output(["git", *args], cwd=self.root, stderr=subprocess.PIPE).decode().strip()

    def run_helper(self, *args):
        result = subprocess.run([sys.executable, str(SCRIPT), *args], cwd=self.root,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return result.returncode, json.loads(result.stdout)

    def test_push_contains_only_document_and_preserves_branch_staged_unstaged_work(self):
        # Even locally committed unreviewed source must not become the checkpoint base.
        (self.root / "app.txt").write_text("unreviewed local commit\n")
        self.git("add", "app.txt")
        self.git("commit", "-m", "unreviewed local source")
        head = self.git("rev-parse", "HEAD")
        (self.root / "app.txt").write_text("staged user change\n")
        self.git("add", "app.txt")
        (self.root / "app.txt").write_text("unstaged user change\n")
        original_index = self.git("ls-files", "--stage")
        original_status = self.git("status", "--porcelain")
        code, result = self.run_helper(DOCUMENT, "--branch", "handoff/safe-test")
        self.assertEqual(code, 0, result)
        self.assertEqual(result["status"], "pushed")
        self.assertEqual(result["base_commit"], self.approved)
        self.assertEqual(self.git("rev-parse", result["commit"] + "^"), self.approved)
        self.assertEqual(self.git("show", result["commit"] + ":app.txt"), "approved application")
        self.assertEqual(self.git("diff", "--name-only", self.approved, result["commit"]), DOCUMENT)
        self.assertEqual(self.git("rev-parse", "HEAD"), head)
        self.assertEqual(self.git("branch", "--show-current"), "main")
        self.assertEqual(self.git("ls-files", "--stage"), original_index)
        self.assertEqual(self.git("status", "--porcelain"), original_status)
        self.assertEqual((self.root / "app.txt").read_text(), "unstaged user change\n")
        self.assertEqual(self.git("ls-remote", "origin", "refs/heads/main").split()[0], self.approved)
        self.assertEqual(self.git("ls-remote", "origin", "refs/heads/handoff/safe-test").split()[0], result["commit"])

    def test_dry_run_does_not_push(self):
        code, result = self.run_helper(DOCUMENT, "--dry-run", "--branch", "handoff/dry-run")
        self.assertEqual(code, 0, result)
        self.assertEqual(result["status"], "dry_run")
        self.assertEqual(self.git("ls-remote", "origin", "refs/heads/handoff/dry-run"), "")
        self.assertEqual(self.git("rev-parse", "HEAD"), self.approved)

    def test_rejects_source_template_empty_sections_and_main_branch(self):
        for path in ["app.txt", "docs/handoffs/TEMPLATE.md", "../outside.md"]:
            code, result = self.run_helper(path)
            self.assertNotEqual(code, 0)
            self.assertEqual(result["status"], "error")
        (self.root / DOCUMENT).write_text("# 未填\n## 使用者需求\n待填\n")
        self.assertNotEqual(self.run_helper(DOCUMENT)[0], 0)
        (self.root / DOCUMENT).write_text(CONTENT)
        self.assertNotEqual(self.run_helper(DOCUMENT, "--branch", "main")[0], 0)

    @unittest.skipUnless(hasattr(os, "symlink"), "symlink not supported")
    def test_rejects_symlinks(self):
        outside = self.base / "outside.md"
        outside.write_text(CONTENT)
        link = self.root / "docs/handoffs/link.md"
        link.symlink_to(outside)
        self.assertNotEqual(self.run_helper("docs/handoffs/link.md")[0], 0)

    def test_refuses_existing_branch_without_overwriting_it(self):
        _, first = self.run_helper(DOCUMENT, "--branch", "handoff/existing")
        (self.root / DOCUMENT).write_text(CONTENT + "\n新增進度。\n")
        code, result = self.run_helper(DOCUMENT, "--branch", "handoff/existing")
        self.assertNotEqual(code, 0, result)
        self.assertEqual(self.git("ls-remote", "origin", "refs/heads/handoff/existing").split()[0], first["commit"])

    def test_reports_matching_document_already_saved_on_main(self):
        self.git("add", DOCUMENT)
        self.git("commit", "-m", "approved handoff")
        self.git("push", "origin", "main")
        code, result = self.run_helper(DOCUMENT)
        self.assertEqual(code, 0, result)
        self.assertEqual(result["status"], "already_on_main")
        self.assertEqual(result["commit"], self.git("rev-parse", "HEAD"))


if __name__ == "__main__":
    unittest.main()
