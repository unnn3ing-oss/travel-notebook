# 任務交接：重新設計複製提示詞的匯入架構

- 日期：2026-11-07（Asia/Taipei）
- 狀態：releasing；使用者已授權「推上併入」，準備 fast-forward main 並驗證 Vercel
- 正式版／本機基準：d42a29189ee19030571cdfd8249b95b0613ed223，work 分支
- 授權：使用者已審閱實作摘要／文字檔與截圖連結，明確要求「推上併入」；本次 GitHub main 合併與其自動 Vercel 發布已授權。

## 使用者需求

依目前工具可匯入的類型、欄位與選項，重新設計能整理資訊內容、信件與附件的提示詞架構，直接供 App「複製提示詞」使用。延續 PDF 補件後核對座位、精簡旅途筆記與資料來源分區的已確認方向。

## 修改方向

1. 將提示詞整理為「旅程任務／可用來源／附件取得與補件／有效訂單核對／八種類型與欄位對應／資料格式與列舉／精簡筆記與核對區／能力限制／輸出自檢」分段架構。
2. 動態帶入當前旅程名稱、起訖日期、IANA 時區、參考幣別與人數。資料字串明確標為資料，不當額外指令。
3. 共用 JSON v2 欄位範本補齊 flight、hotel、transit、ticket、restaurant、place、car、other；列出 parser 能接的選項與限制，不新增不支援欄位或改動 parser／DB。
4. 把範本與提示詞移到獨立 importPrompt.ts，importer.ts 仍以同一路徑 re-export，維持既有按鈕與呼叫相容。範例、欄位文件的 JSON 骨架從同一來源產生，避免相互落後。
5. 保留「Gmail 附件拒絕且座位缺漏→請上傳原始 PDF 到同一 AI 對話→實讀後才產生最終 JSON」；能讀 PDF 不等於 PDF 必定有座位，未載明仍不猜。
6. 對應八種業務的專屬欄位與一般欄位、跨日航班、付款／取消版本、交通未知數字會變 0 的限制、租車跨日資訊與短筆記等；來源／查核放 review，App 不匯入。
7. 僅更新提示詞、匯入說明、文件與適當相容測試；不改日夜背景、手動資料、匯入預覽行為，不自動覆寫舊卡或筆記。不把私人報告、PNR、地址與附件內容放進 repo。

## 驗收與驗證

- 實際「複製提示詞」輸出含當前旅程資訊、清楚分段、八類型與單一 JSON v2 範本。
- 用虛構八類型資料驗證 parseImport／materializeImport 的欄位、住宿雙卡、路線、notes 與 review 不混雜；保留舊格式相容。
- 核對欄位文件與範本同步，未知選項不誤當事實。npm test、npm run build、git diff --check。
- 瀏覽器檢查按鈕複製內容與貼 JSON→預覽→保存→詳細頁／重載；提供可直接複製的文字檔。沒有執行外部 AI 或親讀信箱／PDF，不宣稱實測附件權限。

## 接手狀態

### GitHub 修改前 checkpoint

已確認計畫保存在 `handoff/2026-11-07-import-prompt-framework-20261106-173636-804374`，commit `1b46b059cf4a610e72b553d90f0b895e7f895af6`，並 fetch 比對本機文件一致，才開始改程式。

### 已完成

- 本機程式與範例 commit：`d2a3a71c599b09277d4de5a75b47963996ec4600`（work）。**尚未推程式到 GitHub，未合併 main／未部署**。
- `src/lib/importPrompt.ts`：八段架構、六個動態旅程參考欄位、八種類型骨架與完整選項；`importer.ts` re-export 保留複製按鈕入口。parser、資料庫與舊卡資料未改。
- 保留 PDF 補件／座位逐人逐航段核對、T 航廈、短筆記、獨立 review；補齊交通缺數字／mode、跨午夜班次、外幣、提醒偏好與重複匯入限制。
- `Plan.tsx` 說明更新為可搭配信件／Notion／PDF／圖片；版面維持現有樣式。
- `docs/import-prompt-framework.md`、欄位參考與兩份 prompt-example.txt 同步。新候選截圖與文字在 `docs/handoff-assets/import-prompt-framework/`，全部為虛構示範資料，尚非使用者確認的正式視覺基準。

### 實際驗證

- npm test：14 個檔案、81 tests 全過。新增八類型欄位整合與動態範本測試。
- npm run build：TypeScript／Vite／PWA 成功，bundle `index-D75fNmoZ.js`；沿用既有 >500 kB 提示。
- git diff --check 通過。程式、欄位文件的 JSON 骨架、兩份提示詞文字及瀏覽器實際剪貼簿輸出完全一致。
- 隔離 Chromium 390×844：實際按複製帶入目前旅程，貼八類 JSON → 預覽八筆 → 加入九張（住宿雙卡）→ 重載；航班前導零／座位、住宿地址／一行筆記／連動卡、交通路段保存，root.review 未進資料庫。
- 320／390 寬度無水平溢出，無 pageerror；截圖 copy-prompt.png、import-preview.png、short-hotel-note.png 已在本機 commit。
- 沒有外部 AI／真實信箱／Notion／PDF 端到端測試，不能宣稱已實測附件權限或辨識率。未測真實 iPhone／Safari。

### 本次發布授權與下一步

使用者已於本次回覆「推上併入」。已 fetch main 與最新 handoff，main 仍為 d42a291，工作區乾淨，本機 HEAD 82ef949 包含實作與完整交接；確認 main 是 HEAD 祖先，可正常 fast-forward，不需要 force push。程式自前次 81 tests／建置／瀏覽器驗證後未修改，沿用該次結果。

先保存此發布交接，再正常 push HEAD:main，等待 Vercel success 並核對正式站 bundle index-D75fNmoZ.js。使用隔離瀏覽器透過實際 UI 建立示範旅程，檢查複製內容及匯入／重載；完成後更新交接、索引與長期記憶，不再把待審核狀態當現況。

程式與範例若未推送只在 /workspace/travel-notebook，純文件 checkpoint 不是原始碼備份。使用者過去的部署指示不自動套用新需求。
