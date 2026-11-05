# 任務交接：航廈標示與 PDF 訂位資訊提示詞

- 日期：2026-11-06（Asia/Taipei）
- 狀態：awaiting_review（本機實作與驗證完成；待使用者確認截圖）
- 正式版基準：0381130d4fa9feff219864fac756e1044023e889
- 工作分支：work
- 本次授權：實作、驗證及提供截圖；先前介面審核流程有效，尚未授權本次程式推送 main／部署。已授權先發布純交接文件 checkpoint。
- 來源：使用者本次航班截圖僅在對話，含個人訂位資訊，不複製到 repo。設計參考 docs/design/AddFlight.dc.html 與 docs/handoff-assets/flight-view.png。

## 使用者需求

航廈只顯示「1」難懂，要在前方加大寫 T。AI 匯入訂單提示詞要讓已授權讀信的 AI 讀取對應信件 PDF 附件，找出座位及完整訂位資訊。

## 修改方向

1. 新增共用航廈顯示格式，數字 1／2 顯示 T1／T2；既有 T1 不重複加 T，小寫 t 統一大寫。保留非數字的航廈名稱及未知值，不推測缺少的航廈。
2. 套用於航班詳細頁（摘要、出發／抵達資訊）及新增／專屬表單摘要。只調整顯示，原始 IndexedDB 資料與編輯值不改，無 schema migration。
3. 加強 importPrompt：授權範圍內讀取同筆信件／信串中的 PDF 電子機票、訂位確認、選位明細，按訂位、航班日期與旅客核對，必要且工具支援時讀掃描頁面。以最新有效資料為準；不能讀附件或未選位時填 null，notes 說明缺漏與來源，不能虛構。
4. 匯入說明簡短提示附件需求，保留複製提示詞與貼 JSON 流程；不新增信箱連線或本機 PDF 解析功能。
5. 預計檔案：src/lib/terminal.ts、src/screens/ItemDetail.tsx、src/screens/EntryForm.tsx、src/lib/importer.ts、src/screens/Plan.tsx、相關測試及交接文件。

## 驗收與驗證

- 舊資料 1、既有 T1、小寫 t2、空白與具名航廈顯示正確，無 TT1，無資料覆寫。
- 提示詞明確要求 PDF、座位與航段匹配、來源和無法讀取時的處理；parser 仍保存現有 seat 字串／陣列及 notes。
- 執行 npm test、npm run build；用示範資料在 390px、320px 與桌機檢查航班查看、編輯與匯入說明，輸出截圖供確認。
- 本任務沒有存取真實信箱或 PDF；不能宣稱已對真實郵件／附件實測。真實 iPhone 未測。

## 接手狀態

已在修改前完成 GitHub checkpoint，再開始實作。工作區先 fast-forward 最新 main（只新增設計文件），沒有覆蓋其他 AI 工作。

已完成：共用 formatTerminal 顯示函式、詳細頁與專屬表單摘要、完整 PDF／座位提示詞、匯入說明、相關測試與示範截圖。數字與小寫航廈只改顯示；編輯原值和資料庫內容保留，無 schema 變更。

實際驗證：

- `npm test`：11 個檔案、62 個測試全數通過。
- `npm run build`：TypeScript／Vite／PWA 成功；既有主 bundle >500 kB 提示仍存在。
- Chromium 實測 UI 貼 JSON → 檢查 → 加入訂單 → 詳細頁 → 編輯取消／儲存 → 重載，確認原航廈 `1`／`t2`、PNR、notes 不會因格式化遺失。座位陣列保留為 `12A、12B`，另航段 null 仍為未提供。
- 確認複製出的提示詞包含 PDF 附件、座位與讀不到時填 null 的要求；專屬表單摘要亦顯示 T1／T2，清空則顯示航廈未提供。
- 查看／編輯在 320px、390px、1280px 無水平溢出，無 browser pageerror。未測真實 iPhone、真實郵件或 PDF 讀取。
- `git diff --check` 通過。

程式與示範截圖已在本機 `work` commit `c474a19`，**尚未推送任何遠端程式分支**。這份 checkpoint 只有文字，不能在另一台機器恢復此 commit 的程式；程式目前僅存在 `/workspace/travel-notebook`。

本機截圖：`docs/handoff-assets/flight-terminal-pdf/flight-view.png`、`pdf-import.png`，同樣尚未上傳 GitHub；檔案均為示範資料，沒有使用本次使用者截圖內的私人訂位代號。

下一個 AI 的第一步：讀取使用者最新回覆；確認是否已核准截圖／推送。如果仍是等待審核，不要自行合併或部署，也不要把舊使用者的「推併入」當成本次授權。取得本次核准後，確認本機 commit 尚在、檢查遠端最新 main、整合必要變更，再推送並驗證對應 Vercel commit 和正式網站。原使用者座位仍需用新提示詞取得 PDF 資訊後重新匯入。

## Checkpoint 紀錄

- 修改前計畫：分支 [handoff/2026-11-06-flight-terminal-pdf-20261105-174346-749497](https://github.com/unnn3ing-oss/travel-notebook/tree/handoff/2026-11-06-flight-terminal-pdf-20261105-174346-749497/docs/handoffs)，commit [159504a](https://github.com/unnn3ing-oss/travel-notebook/commit/159504a92e85a296456491a3656b1d49115c6796)。已確認 pushed 才開始修改。
- 本次審核交接會再次由工具發布純文件 checkpoint；實際分支／SHA 以工具輸出與遠端讀回為準，不預寫尚未產生的 SHA。交接文件不是程式備份，main 尚無這次變更。
