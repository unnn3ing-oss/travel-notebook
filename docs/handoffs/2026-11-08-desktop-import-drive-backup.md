# 任務交接：優先修復電腦 AI 匯入，再準備 Google Drive 備份

- 日期：2026-11-08（Asia/Taipei）
- 狀態：in_progress；電腦 AI 匯入已實測、Drive 模擬流程已通過，使用者已提供公開 OAuth client ID，準備加入網站預設設定
- 正式版基準：40bffc16e324005c552aec5a25278b36eeecb00e
- 工作分支：work，初始工作區乾淨
- 授權：使用者要求備份傳 Google，電腦 AI 匯入優先；補充選擇 App 內 Google Drive 上傳／下載，沒有 OAuth client ID，請整理設定步驟。授權實作、測試與設定文件；本次未授權 main 合併／部署。

## 使用者需求

1. 優先讓電腦可使用 AI 匯入，包含複製提示詞、貼 JSON、忽略／覆蓋、儲存與復原。
2. App 內連接 Google Drive 上傳／下載／還原備份，方便其他裝置使用。不是手動下載後上傳，也不是持續雙向同步。
3. 尚無 Google OAuth 網頁用戶端 ID；需提供建立專案、啟用 Drive API、OAuth 同意畫面／測試使用者、允許來源及 Vercel 公開變數等步驟，不索取 client secret。

## 修改方向

### 第一階段（先完成）

- AI 入口原在被桌機 CSS 隱藏的 mobile-plan；在 PlanBoard 工具列加入口，與手機共用同一 ImportSheet／saveImport，不複製另一套邏輯。
- 匯入面板在桌機置中、加寬，遮罩蓋全視窗；手機保留原底部面板。補齊鍵盤 Tab 焦點限制、Escape 關閉與回到原入口，不影響新增表單。
- 驗證桌機空旅程／有行程、複製／貼上／新增／忽略覆蓋／住宿雙卡／復原／重載，並截圖。

### 第二階段（程式準備與設定文件）

- 將現有 JSON v2 檔案備份與還原整理成共用 backup.ts；保留七個表、附件 data URL、資料格式與本機備份功能。先讀出一致快照、交易外編解碼，驗證完整後才進交易還原；失敗不改原資料。
- Google Identity Services token model，僅 drive.file（此 App 建立／開啟的檔案），token 只在記憶體，過期需重連，不放 localStorage、備份或 Git。無後端／client secret。
- OAuth client ID 由 VITE_GOOGLE_CLIENT_ID 提供；未設定時清楚顯示尚未啟用，保留原檔案備份，不假裝可登入。使用者目前已在後續提供公開 client ID，不擅自建立 Google 帳號／專案或繞過同意。
- Drive 區：連接／中斷、上傳新的完整備份（含附件）、列出此 App 備份、下載檔案及選擇還原；不覆寫／刪除遠端既有備份。還原顯示備份檔名、時間與資料數量，再確認才取代本機資料。
- 使用 Drive v3 resumable upload，將 JSON 完整 Blob 上傳；檔案 metadata appProperties 標記本 App。下載／列檔限制在 App 備份，驗證檔案內容與大小，網路／授權／格式錯誤不影響本機資料。
- 共用備份排除 token、連線資訊與 localStorage 公開資料快取；Google 備份是手動快照，不宣稱自動跨裝置同步。中斷連接不刪 Drive 檔案或本機行程。
- 提供 .env.example（空公開 client ID）與 Google／Vercel 啟用說明，實際帳號連線需使用者完成外部 OAuth 設定。測試以虛構資料／OAuth 與 API mock 為主，不聲稱真實 Google 帳號端到端通過。

## 驗收與驗證

- npm test、npm run build、git diff --check；資料層的備份全表／Blob roundtrip、錯誤格式／損壞附件、原子還原失敗回滾。
- Drive 模擬：最小 scope、client ID 未設定／SDK 失敗／拒絕／過期、成功上傳才記成功、清單與分頁／下載、取消還原不寫、確認還原正確、401／403／網路失敗保留資料、session URL／file ID 安全限制、不持久化 token。
- Chromium：1366／900 桌機入口及置中面板、899／390／320 手機維持；真實 UI 複製、混合新增覆蓋／復原／重載、鍵盤與遮罩。
- Drive 未配置真實畫面、模擬登入後上傳／列表／還原及錯誤狀態截圖。只用虛構備份，不上傳真實個資或秘密。明確區分真實畫面與模擬外部服務。

## 接手狀態

修改前 checkpoint 已確認 pushed：`handoff/2026-11-08-desktop-import-drive-backup-20261108-115457-425010`，commit `67f333a51851ed2c35a88a4e905f11949c096910`。

第一階段已完成，優先本機 commit `62ed0556bd1ba25294397bbdd934ca08aeeefbb3`：PlanBoard AI 入口、與手機共用匯入器、桌機 880px 置中面板、全視窗遮罩、Tab 焦點限制／Escape／回復入口。TypeScript／Vite／PWA 建置通過。隔離 Chromium 1366×900 空旅程入口、實際複製、混合新增覆蓋、ID／附件／住宿雙卡、復原、重載、多候選及 320／390 無溢出／pageerror 通過。桌機畫面已存 docs/handoff-assets/desktop-import-drive；檔名 desktop-hotel-updated／desktop-select-target 實際為結尾 390px 回歸截圖，需在最後索引區分。

程式未推 GitHub、未合併／部署，只有文件 checkpoint 遠端。接著抽備份共用資料層，再做 Drive 連接／上傳／列表／下載還原與 mock 測試、未配置狀態、設定步驟。使用者先確認沒有 ID、要求操作說明，後來已自行建立並提供公開 ID：875788779288-14phiukvfvb6r4b31ohft5akdbd33c99.apps.googleusercontent.com。不得因此聲稱已測真實帳號登入／上傳。


使用者未有 OAuth client ID，這是正式 Google 登入／真實帳號驗證的必要外部設定，不能由提示詞或 mock 代替。程式未推送時仍只在本機，handoff 不備份其 diff。

## 方向更新：使用者已提供公開 client ID

使用者自行設定 Google Console 後提供公開網頁 OAuth ID。為讓這個靜態網站直接使用，將 ID 作為網站公開預設設定（與 Vite build-time 變數同樣會出現在 bundle，不是 client secret）；仍支援 VITE_GOOGLE_CLIENT_ID 覆寫，明確空值可停用。這樣不需另外修改 Vercel 帳號設定才能啟用本次網站，不能在前端放 client secret。更新設定指南與未設定測試入口。先保存此方向後才修改預設設定。

目前新增 backup.ts／googleDrive.ts／GoogleDriveBackup.tsx 與 Settings 共用備份，119 tests／建置通過。OAuth／Drive mock 的上傳／下載／拒絕／401／到期／網路與壞檔／取消和確認還原／附件／token 不持久化全通過；沒有真實 Google 帳號測試。桌機優先階段原碼已本機 commit 62ed055；Drive 原碼仍未提交，未推 main／部署。
