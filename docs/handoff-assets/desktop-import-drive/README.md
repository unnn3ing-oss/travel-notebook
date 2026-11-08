# 電腦 AI 匯入與 Google Drive 備份：候選畫面

2026-11-08（Asia/Taipei）。已獲本次「推」授權，隨 eca3a1d 併入 main／部署；這些畫面是發布前候選截圖。旅程、訂位、附件均為虛構，不含使用者真實備份或 token。公開 OAuth client ID 由網站擁有者提供，不是 secret。

| 畫面 | 實際驗證 |
| --- | --- |
| [電腦空旅程](desktop-empty.png) | 1366×900，多日規劃工具列可直接 AI 匯入 |
| [電腦複製提示詞](desktop-copy.png) | 桌機 880px 置中面板、全視窗遮罩、共用旅程提示詞 |
| [電腦預設忽略](desktop-default-ignore.png) | 既有航班／住宿／交通可在桌機預覽選忽略／覆蓋 |
| [電腦選擇覆蓋](desktop-choose-overwrite.png) | 混合新增及覆蓋使用同一個匯入器 |
| [電腦確認統計](desktop-confirmation-summary.png) | 確認後才寫入，可復原 |
| [手機住宿回歸](desktop-hotel-updated.png) | 檔名保留第一階段紀錄，實際為 390px 手機，住宿／附件保留 |
| [手機多候選回歸](desktop-select-target.png) | 實際為 390px，必須指定覆蓋目標 |
| [Drive 入口](drive-ready-real-sdk.png) | 真的 Google SDK HTTP200，連接按鈕可用；未登入 Google、未發 Drive 請求 |
| [Drive 已連接示範](drive-connected-mocked.png) | **模擬 OAuth 與 Drive API**，不是實際帳號；成功上傳完整七表／PDF 的測試畫面 |
| [Drive 還原確認](drive-restore-confirm-mocked.png) | **模擬 Google 回應**，下載檢查後顯示數量，取消不寫入，確認才原子還原 |
| [Drive 明確停用](drive-unconfigured.png) | 測試時將環境變數設空，確認無 Google 請求；目前網站已有公開預設 ID，不是預設狀態 |
| [首次開啟還原入口](welcome-restore.png) | 空資料庫即可進設定還原，不必先建立旅程；Google 授權／下載使用模擬回應 |

桌機匯入已實測：空旅程／有行程入口、複製、混合新增覆蓋、原 ID／PDF／住宿雙卡／交通、復原／重載、多候選；1366、900 桌機面板與 899、390、320 手機面板無溢出。Tab／Shift+Tab 限制在面板，Escape／遮罩關閉後焦點回入口。

Drive 模擬已驗證：最小 drive.file scope、拒絕不請求、完整上傳／下載、API 失敗不記成功、網路失敗保留清單、壞檔不進還原確認、取消不寫、確認還原七表／精確 PDF bytes、401／到期重新連接、token 不寫 localStorage 或備份。另確認原檔案備份／還原仍可用，以及 SDK 失敗可重試。

首次開啟實測：空資料庫由「從備份還原」進設定、隱藏旅程專屬刪除／行事曆操作、取消不新增旅程、確認後旅程／筆記／附件正確恢復，無 pageerror。單元測試 18 files／120 tests 與 TypeScript／Vite／PWA 建置通過。

真實測試只包含 Google SDK 載入 HTTP200、公開 ID 設定與連線入口；**尚未使用真實 Google 帳號端到端測試上傳／下載／還原**。發布後仍需使用者測試帳號、啟用 API／同意畫面與授權來源設定。設定步驟見 [OAuth 指南](../../google-drive-setup.md)。未測真實 iPhone／Safari。
