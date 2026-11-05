# 任務交接：建立跨 AI 的接續流程

- 日期：2026-11-06（Asia/Taipei）
- 狀態：completed（文件與工具完成；常駐內容的發布以 GitHub main 為準）
- 正式版基準：`cfb10e41ee0b17df5a7dcaf4b12a375c2fb28b5f`
- 儲存庫：unnn3ing-oss/travel-notebook
- 目前發布網站：https://travel-notebook-chi.vercel.app/

## 使用者需求

使用者希望把給 AI 的 handoff 放到 GitHub，避免 Claude 或 Codex 其中一邊用量耗盡時失去接續脈絡。之後收到需求、AI 提出修改方向後，必須在改動程式之前先送一份交接到 GitHub。

既有審核習慣仍有效：介面修改先提供示範資料截圖供確認，再依使用者指示併入 main／部署。本次已明確授權將交接文件與流程保存到 GitHub。

## 修改方向

1. 新增根目錄 AGENTS.md 與 Claude 可讀取的入口，規定先讀交接、保護現有修改、先記錄計畫再改碼。
2. 新增長期架構／資料／介面／驗證與部署的交接說明、任務範本與索引。
3. 保存目前已確認且只含示範資料的畫面，供另一個 AI 比對。
4. 提供只發布一份交接文件至獨立 handoff/ 分支的工具，避免把工作區中尚未確認的程式一併推送。
5. 以獨立的本機 Git 遠端測試文件發布工具，確認不改原本分支、工作檔或 staged index。
6. 本次不更動應用程式邏輯、資料庫 schema、依賴或 Vercel 設定。

預計檔案：AGENTS.md、CLAUDE.md、README.md、docs/ai-handoff.md、docs/handoffs/README.md、docs/handoffs/TEMPLATE.md、本交接紀錄、docs/handoff-assets/、scripts/publish-handoff.py、scripts/test_publish_handoff.py。

## 驗收與驗證

- 新 AI 能從 repo 根目錄找到架構說明與最新任務。
- 每個修改前 checkpoint 包含需求、方向、基準 SHA、驗收與接手狀態。
- 發布工具建立的 commit 以遠端 main 為基準，diff 只有指定的 handoff Markdown；不含未審核程式，且不修改現有工作區或 index。
- 測試工具的 dry-run、不合法路徑拒絕、正式發布、遠端驗證與工作區保護。
- 文檔連結與示範截圖實際存在，無秘密或真實訂單資訊。
- 這是文件／工具工作；應用程式現況依正式版基準：60 個測試通過、建置成功，Vercel 成功且主要線上操作已驗證。本次若未重跑，不能寫成本次重新驗證。

## 接手狀態

本次文件與工具實作完成，沒有待做的應用功能修改。已完成：

- 根目錄 AGENTS.md、CLAUDE.md 共用入口與修改前交接要求。
- 長期交接、任務索引、範本與 7 張已確認的示範截圖。
- scripts/publish-handoff.py：以遠端 main 為基準，臨時 index 僅納入指定交接文件，讀回遠端 SHA 驗證。
- scripts/test_publish_handoff.py：6 個隔離本機 Git 測試全數通過，含未審核的本地 commit、staged／unstaged 變更保護、dry-run、路徑／範本／分支拒絕、symlink 拒絕、既有分支保護、已在 main 的內容判斷。
- 本機 Markdown 連結與圖片存在檢查、git diff --check。應用程式測試／建置本次未重跑，因為沒有修改 app、依賴或部署設定；前述 60 個測試與建置成功是 cfb10e4 的歷史驗證。

接手的 AI：先讀 AGENTS.md，再找與下一個需求相符的新任務；不要再重做這次文件工作。開始改程式前建立一份已填好的任務文件並使用發布工具保存 GitHub checkpoint。

交接文件不是未推送程式的備份；程式碼遠端保存、合併與部署仍依該次授權。無法保證額度已用盡的 AI 還能執行最後一次保存，所以要求修改前與每個主要階段更新。

## Checkpoint 紀錄

- 修改前計畫：[handoff/ai-continuity-plan-20261105-163139](https://github.com/unnn3ing-oss/travel-notebook/tree/handoff/ai-continuity-plan-20261105-163139/docs/handoffs)，commit [5c78782](https://github.com/unnn3ing-oss/travel-notebook/commit/5c78782f0fd4f69fb6b892e7df4a6bcd8d1cedd3)。這份已在其他文件／工具開始建立前確認推送成功。
- 本次不包含應用程式變更；常駐文件與工具會隨本次文件 commit 併入 main。最終 commit 可用 `git log -1 -- docs/handoffs/2026-11-06-ai-continuity.md` 查出，不預寫尚未產生的 SHA。
