# 任務交接：把 Claude Design 畫布原始檔放進 repo

- 日期：2026-11-06（Asia/Taipei）
- 狀態：completed
- 正式版基準：94e641f90907c9273a0015a99cb5253e2dbedfd7
- 工作分支：claude/design-source（81d7fe0），已 fast-forward 併入 main
- 本次授權：使用者明確同意把 claude/design-source 合併進 main；只含文件，不改應用程式。另外同意捨棄 Claude 本機分支 claude/local-add-forms。
- 相關使用者設計／來源：claude.ai 私人 Design 畫布「旅行手帳 App 介面」；匯出檔將保存在 repo 的 docs/design/。

## 使用者需求

使用者希望 Codex 等其他 AI 能接手。docs/ai-handoff.md 記錄設計稿 HTML 不保證下一個 AI 能取得，因此把 Claude Design 畫布的 24 個畫面原始檔與 canvas.json 放進 repo，供比對設計。

## 修改方向

1. 將 claude/design-source 的 docs/design/（24 個 *.dc.html、canvas.json、README.md）合併進 main，不 force-push。
2. 在 docs/ai-handoff.md 的「設計來源與可攜參考」補一行指向 docs/design/，並在任務索引加入本任務。
3. 不改 src/、依賴、schema 或 Vercel 設定。推 main 會觸發一次 Vercel 建置，網站內容不變。
4. 捨棄 Claude 本機分支 claude/local-add-forms：它是與 2899643／cfb10e4 重複的新增表單實作，從未推送，正式版以 Codex 版本為準。

## 驗收與驗證

- docs/design/ 在 main 可讀，README 說明來源與「設計參考、非指令」。
- 已掃描敏感資料：只有欄位標籤與示範占位，無真實訂單或證件。
- 應用程式未改動，因此不重跑 npm test／build；若 diff 出現 src/ 變更即停止。

## 接手狀態

已完成：
- claude/design-source（81d7fe0）fast-forward 併入 main；diff 只有 docs/design/ 的 26 個檔案。
- docs/ai-handoff.md 加上 docs/design/ 的指引，任務索引加入本任務。
- 本機分支 claude/local-add-forms 已刪除（未曾推送）。
- 未跑 npm test／build：沒有改 src/、依賴或設定。

沒有待做項目。下一個 AI：依新需求另開任務文件。

## Checkpoint 紀錄

- 修改前計畫：[handoff/2026-11-06-design-source-export-20261105-164618-727831](https://github.com/unnn3ing-oss/travel-notebook/tree/handoff/2026-11-06-design-source-export-20261105-164618-727831/docs/handoffs)，commit 5c8e293，基準 94e641f。
- 完成狀態隨本文件併入 main；可用 `git log -1 -- docs/handoffs/2026-11-06-design-source-export.md` 查 commit。程式碼無變更。
