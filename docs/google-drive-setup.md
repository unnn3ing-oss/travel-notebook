# 啟用 Google Drive 備份

電腦版 AI 匯入可獨立使用。使用者本次提供的公開 OAuth 用戶端 ID 已加入網站預設設定；部署後可連接 Google Drive。仍需在同一 Google 專案啟用 API、設定測試帳號及允許網站來源。ChatGPT 的 Google 連線不會自動套用到這個 App。

## 1. 建立專案並啟用 API

1. 開啟 [Google Cloud Console](https://console.cloud.google.com/)，選擇或建立專案，例如「旅行手帳」。
2. 在同一個專案開啟 [Google Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com)，按「啟用」。
3. 這個功能不需要 API 金鑰、服務帳戶或 client secret。不要把 client secret 放在前端、聊天或 GitHub。

## 2. 設定同意畫面

1. 開啟 [Google Auth Platform](https://console.cloud.google.com/auth/overview)，首次使用按「開始使用」。
2. 在「品牌資訊／Branding」填寫應用程式名稱、使用者支援信箱與開發者聯絡信箱。其他公開資訊依 Console 要求填寫。
3. 個人 Gmail 使用者在「目標對象／Audience」選「外部／External」。Workspace 組織的「內部」僅供組織內帳號，無法給一般 Gmail 使用者登入。
4. 開發時保留「測試」狀態，將實際要登入的帳號加入「測試使用者」。測試模式不會自動開放給所有人。
5. 在「資料存取權／Data Access」→「新增或移除範圍」，加入：
   ```
   https://www.googleapis.com/auth/drive.file
   ```
   若找不到，確認同專案已啟用 Drive API。不要改選完整 `drive` 權限。
6. 要公開給其他使用者時，依 Console 指示切換正式發布並完成其要求的品牌／網域或其他審核；不要把測試模式的成功當成所有帳號均已開放。

## 3. 建立網頁用戶端

1. 「用戶端／Clients」→「建立用戶端」。舊介面可能位於「API 和服務 → 憑證 → 建立 OAuth 用戶端 ID」。
2. 應用程式類型選「網頁應用程式／Web application」。
3. 在「已授權的 JavaScript 來源」加入正式網站，**只填來源，不含結尾斜線、路徑或 `#/`**：
   ```
   https://travel-notebook-chi.vercel.app
   ```
4. 本機開發可另加實際使用的來源，例如 `http://localhost:5173`。若換 port／主機名稱要另外加入；不能用萬用字元。
5. 此 App 使用 GIS 的 popup token model，不需設定重新導向 URI。
6. 複製以 `.apps.googleusercontent.com` 結尾的「用戶端 ID」。這是公開識別字，不是 client secret；只有這個 ID 需要交給網站設定。

## 4. 網站預設與 Vercel 覆寫

**本次不必額外設定 Vercel 變數**：使用者提供的公開用戶端 ID 已放在 `src/lib/googleDriveConfig.ts`，隨程式部署。它與前端環境變數一樣可在 bundle 看見，不是 client secret。

下列步驟僅供日後更換用戶端 ID、其他 fork 或刻意停用：

1. 開啟 Vercel 的 `travel-notebook` 專案 → Settings → Environment Variables。
2. 新增：
   ```
   VITE_GOOGLE_CLIENT_ID=你的公開用戶端ID.apps.googleusercontent.com
   ```
   值只填 ID，不加引號、空白或 `client_secret`。可套用 Production；Preview 如需不同設定，也要將對應固定預覽來源加入 Google 設定。
3. Vite 在**建置時**讀取變數，因此儲存變數後需要重新部署；不會自動改變已發布的 bundle。依本次使用者發布授權完成部署，再驗證正式網址。
4. 本機要用網站預設時不需 `.env.local`；要覆寫可複製 `.env.example` 為 `.env.local` 並填自己的 ID，重新啟動 Vite。`.env.local` 已被 Git 忽略；不要提交任何 secret。

明確把 `VITE_GOOGLE_CLIENT_ID` 設成空值或無效值會停用 Drive，顯示「尚未啟用」，不載入 Google SDK 或發出 Drive 請求。未設定此變數時使用網站公開預設 ID，原本的檔案備份始終可用。

## 5. 在 App 驗證

1. 使用已列為測試使用者的帳號，開啟正式網站 → 必備 → 設定與備份。新裝置還沒有旅程時，可從起始頁按「從備份還原」，不必先建立空旅程。
2. 在 Google Drive 區按「連接 Google Drive」，選擇帳號並授權。
3. 按「備份到 Google Drive」。看到成功訊息後，在清單中確認新備份；檔案建立在這個帳號的我的雲端硬碟，不取代舊版本。
4. 按「下載」確認可取得 JSON v2 備份，裡面包含附件。先用虛構旅程驗證，避免用唯一資料副本測試還原。
5. 在另一個瀏覽器或裝置開啟**同一網站**，連接同一 Google 帳號，重新整理清單；先下載保存，再選備份按「還原」。檔案會先檢查，確認畫面顯示旅程／卡片／附件數，按「確認還原」才取代該裝置全部本機資料；「取消」不寫入。
6. 這是手動完整快照，不是持續跨裝置同步／合併。上傳新備份不會自動修改其他裝置的資料。

目前只列此 App 建立、帶專用標記的 JSON 備份；不會瀏覽整個 Drive。手動放進 Drive 的舊檔可下載後用既有「從備份檔還原」功能處理。維持同一 Google 專案／網站用戶端設定，避免更換應用身分後無法列到原專案的私有檔案標記。

## 常見問題

| 訊息／現象 | 檢查 |
| --- | --- |
| origin_mismatch | Google JavaScript 來源是否與瀏覽器的 scheme／主機／port 完全相同，且 Vercel 使用正確 client ID |
| access_denied／測試帳號無法登入 | 是否為同一專案、加入正確測試使用者、API 已啟用；Workspace 管理政策也可能限制存取 |
| 登入視窗開不起來 | 允許此網站彈出 Google 視窗，再重新連接 |
| 403 | 檢查 Drive API、權限與 Google 帳號／組織政策；不改用更廣權限繞過 |
| 401／連線到期 | token 是短期的，請重新連接；不儲存密鑰或 refresh token |
| 上傳未確認成功 | 重新整理清單確認是否已有新檔，再決定是否重試；不把失敗嘗試記為成功 |
| 備份過大 | 單份含附件的 JSON 上限 50 MB，請先精簡附件 |
| 清單空白 | 確認帳號／專案一致；本 App 尚無成功上傳時本來就沒有備份。這不是完整 Drive 檔案清單 |

## 實作與測試範圍

`VITE_GOOGLE_CLIENT_ID` 可公開、會包含在前端 bundle。access token 僅在設定頁記憶體，離頁／重載／到期後需重新連接，不寫 localStorage、IndexedDB、備份或 Git。中斷此頁連線保留 Drive 舊備份與本機資料；永久撤銷可到 Google 帳號的第三方連線管理處理。

使用 Google Identity Services token model、`drive.file`、Drive v3 resumable upload（先取得 session URI 再 PUT 內容），驗證上傳 URI／固定下載端點，保留歷次備份。JSON v2 七表與附件共用本機備份資料層，還原採單一 IndexedDB transaction。

開發期間以模擬 OAuth／Drive 回應驗證，不能代替上述真實 Google 設定與帳號端到端測試。使用者已提供公開 ID，程式設定完成；目前仍未測真實 Google 帳號的登入／上傳／還原，需發布後由測試帳號完成上述驗證。

官方參考：[GIS token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model) · [Drive OAuth 權限](https://developers.google.com/workspace/drive/api/guides/api-specific-auth) · [Resumable uploads](https://developers.google.com/workspace/drive/api/guides/manage-uploads)
