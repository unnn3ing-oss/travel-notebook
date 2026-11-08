# 任務交接：電腦 AI 匯入與 Google Drive 備份

- 日期：2026-11-08（Asia/Taipei）
- 狀態：awaiting_review；實作與本機驗證完成，未合併／部署
- 正式版基準：40bffc16e324005c552aec5a25278b36eeecb00e
- 工作分支：work
- 本次授權：電腦 AI 匯入優先；App 內 Google Drive 上傳／下載／還原及 OAuth 設定說明。使用者提供公開網頁 client ID。未授權這批程式推送 main／部署，前次「推」不沿用。
- 設計：沿用既有 Claude Design／品牌色，截圖只用示範資料。

## 使用者需求

1. 電腦多日規劃工具列增加 AI 匯入入口，共用手機 ImportSheet／saveImport；可複製提示詞、貼 JSON、忽略／覆蓋、儲存及復原。
2. 桌機匯入為最大 880px 置中面板，全視窗遮罩；899px 以下保留最大 480px 手機面板。鍵盤 Tab 焦點限制、Escape／遮罩關閉與焦點回復。
3. Google Drive 備份是 App 內手動完整快照，包含七表、筆記和附件；連接／中斷、上傳新版本、列出 App 備份、分頁／下載及還原。不是自動雙向同步，不覆寫／刪除雲端既有檔。
4. 共用 JSON v2 資料層保留舊備份相容；一致讀取快照，交易外編解碼，格式與附件驗證完成後才原子還原，失敗回滾。50MiB 上限。不含 localStorage 或 OAuth token。
5. 起始頁新增「從備份還原」，全域 Settings 可無旅程進入；新裝置不必先建立假旅程。無旅程隱藏行事曆／刪除旅程操作。還原先顯示檔名、時間、旅程／卡片／附件數量，紅色二次確認後才取代本機資料；取消不寫入。
6. 使用者另要求 icon JPG，已從原 icon-1024.png 轉成 /workspace/exports/travel-notebook-icon.jpg，1024×1024、白底。這是本機交付檔，不在 repo；原 PNG 可再轉換，未改 App icon。

## 修改方向

已依優先順序完成桌機共用匯入器，再抽出共用備份資料層、接上 Google OAuth／Drive，最後補齊首次開啟還原入口。沿用舊資料格式與手機畫面，沒有另建桌機匯入邏輯或新增自動同步。

### Google OAuth 與設定

- 使用者提供的 **公開** 網頁 client ID 已放 src/lib/googleDriveConfig.ts 作網站預設；不是 client secret。未設定 VITE_GOOGLE_CLIENT_ID 時沿用預設，非空值可覆寫，明確空字串／無效值停用 Google；.env.example 說明差異。這個網站無須另填 Vercel 變數。
- Google Identity Services token model，最小 scope https://www.googleapis.com/auth/drive.file，include_granted_scopes:false。token 只在記憶體，離開設定／重載／到期需重連，不寫 localStorage、備份或 Git。沒有 client secret、後端或 refresh token。
- Drive v3 resumable 上傳完整 JSON Blob，檔案 appProperties.app=travel-notebook；僅列出 App 建立的 JSON 備份，不讀整個 Drive。舊手動上傳的 JSON 用檔案還原。
- 上傳確認完成後才記備份成功；失敗／拒絕／過期／網路錯誤不動本機資料。下載、session URL／file ID、大小與格式均驗證。
- 已提供 [完整 Google Console 指南](../google-drive-setup.md)：同專案 Drive API、External Testing／test users、drive.file、Web client JS origin https://travel-notebook-chi.vercel.app；popup token model 不需 redirect URI 或 secret。
- 已真實載入 Google SDK HTTP200、公開 ID 有效格式、Connect 就緒，授權前 Drive 請求 0。**尚未使用真實 Google 帳號完成 OAuth／上傳／下載／還原**；模擬測試不能代替實際帳號、Google 專案 API／測試使用者／origin 設定。

## 已改檔案

- 第一階段：src/screens/Planner.tsx、Plan.tsx、design.tsx、styles.css；桌機截圖。
- 第二階段：src/lib/backup.ts、backup.test.ts、googleDrive.ts、googleDrive.test.ts、googleDriveConfig.ts、src/components/GoogleDriveBackup.tsx；Settings.tsx、App.tsx、Welcome.tsx；design.tsx／styles.css 斷點修正。
- 說明：README.md、.env.example、docs/google-drive-setup.md、任務／長期索引與 docs/handoff-assets/desktop-import-drive。

## 驗收與驗證

- npm test：18 files／120 tests 通過；npm run build：TypeScript／Vite／PWA 通過，bundle index-BJ0lA-Fu.js。只有既有 >500k 警告；git diff --check 通過。
- 備份測試：七表含精確 Blob bytes roundtrip、舊 v2、排除 localStorage、無效 ID／日期／巢狀欄位／外部 URL／壞 base64 拒絕、交易寫入失敗回滾。
- Google 單元測試：最小 scope、預設／覆寫／停用 ID、拒絕／缺 scope／到期、兩階段上傳、未授信 session URL 不送 bearer、清單／分頁、401／403／網路、正確下載 URL 與 ID／大小限制。
- 隔離 Chromium：1366×900 桌機空／有旅程入口、實際複製、混合新增覆蓋、原 ID／PDF／住宿雙卡／交通保留、復原、重載、多候選。1366、900、899、390、320 面板寬度與無水平溢出；Tab／Shift+Tab、Escape／遮罩焦點回復，無 pageerror。
- 模擬 OAuth／Drive UI：拒絕無 Drive 請求、七表／PDF 上傳與下載、上傳失敗不記成功、網路失敗保留清單、壞檔不進確認、取消不寫、確認原子還原、401／到期需重連、token 不進 localStorage／備份。SDK 載入失敗可重試；明確空 ID 不請求 Google；原檔案備份／還原仍可用。
- 首次開啟：空資料庫可直接進設定、無旅程操作隱藏、取消不新增旅程、確認恢復旅程／筆記／精確附件 bytes，無 pageerror。外部服務使用模擬回應。
- [截圖索引](../handoff-assets/desktop-import-drive/README.md) 區分真實 SDK、模擬 Google 與手機回歸畫面。不聲稱真實 iPhone／Safari 或正式站已驗證本次程式。

## 接手狀態

- 本機程式 commit：62ed0556bd1ba25294397bbdd934ca08aeeefbb3（桌機 AI 匯入）；ddeb3bf0f51184ef815d2339d194ab03785d0e12（Drive／首次開啟還原、指南與截圖）。這些程式 **僅在 /workspace/travel-notebook 的 work 分支，未推遠端**。
- 本次 checkpoint 只含這份 Markdown，不包含程式 diff 或新截圖；換機不能單靠 handoff 分支恢復未推送程式。
- 待使用者看截圖後指示「推」或合併部署。取得該次授權後先核對工作區／遠端 main、保存授權狀態，再正常推 main；不能 force-push。確認 Vercel／正式 bundle 與實際 UI。
- 發布後使用者須以 Google 測試帳號完成真實連接、上傳、另一裝置下載／還原；不可擅自登入或聲稱已完成。若 origin_mismatch／access_denied，依指南檢查專案設定。

## 已確認發布的文件 checkpoint

1. 修改前計畫：handoff/2026-11-08-desktop-import-drive-backup-20261108-115457-425010，67f333a51851ed2c35a88a4e905f11949c096910。
2. 桌機完成：handoff/2026-11-08-desktop-import-drive-backup-20261108-120014-473617，fe51485f87b5696e03f7d8a0bda0a1b8cb03b5f6。
3. 加入公開 ID 前：handoff/2026-11-08-desktop-import-drive-backup-20261108-122207-818390，e791c490f4636d88473bd6c0b446f2d81a0827ce。
4. 首次開啟還原方向：handoff/2026-11-08-desktop-import-drive-backup-20261108-123308-772756，05ab2b1ea7cebe68dae6d279aa00c6d46d4db3eb。

5. 完成 awaiting_review：handoff/2026-11-08-desktop-import-drive-backup-20261108-123948-063575，15bf1801dde5f5d6ac9d1138fd5e7855ad879e12，工具已確認 pushed。遠端文件包含兩個本機程式 SHA 與測試結果，只有此筆發布結果在發布後補記於本機文件。
