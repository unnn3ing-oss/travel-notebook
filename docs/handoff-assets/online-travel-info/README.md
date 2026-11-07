# 聯網旅途資訊：候選畫面與驗證

2026-11-07（Asia/Taipei）產生，已獲使用者本次「推」授權，於 2026-11-08（Asia/Taipei）隨 1147d5e 併入 main／發布。本機獨立 Chromium，示範旅程與測試行程均為虛構；天氣與周邊百科內容為公開資料，沒有真實訂位、住址、筆記或私人附件。

| 截圖 | 資料與用途 |
| --- | --- |
| [天氣](weather-live.png) | 真實 Open-Meteo HTTP200，東京旅行日期內預報、取得時間與來源 |
| [交通](stations-live.png) | 真實 Wikipedia HTTP200，附近車站／短摘要／地圖，明示非即時班次或延誤 |
| [景點](sights-live.png) | 真實 Wikipedia HTTP200，城市中心周邊景點與來源 |
| [離線狀態](offline-simulated.png) | Playwright 網路模擬，離線讀取示範快取，不是真實氣象／營運紀錄 |
| [部分更新失敗](partial-failure-simulated.png) | 模擬 API 503，保留上次成功資料與時間，不當成剛更新 |
| [正式建置離線重載](pwa-offline-reload.png) | 正式建置在本機 preview，Service Worker ready 後離線重載，讀取真實來源的先前公開快取；不是正式站部署 |

真實 API 瀏覽器確認 CORS 可用，天氣、車站與景點取得並保存，沒有 pageerror。開發 React StrictMode 初次重跑取消過期請求的 ERR_ABORTED 是預期取消，最終兩個來源皆 HTTP200。

模擬測試確認：部分失敗保留原成功時間；離線不請求；回線重試；五分鐘退避；關閉自動更新不再自動查詢但可手動更新；模糊城市必須選定；切城會取消舊請求且城市快取分開；重載後城市／開關保留；320／390 無水平溢出；既有 IndexedDB 行程完整不變，公開請求未包含測試筆記／訂位代號。

正式建置另確認 Service Worker ready → 離線重載 → 可查看快取的天氣、車站、景點與偏好，旅途中「今日」頁亦有資訊卡。89 tests、TypeScript／Vite／PWA 建置通過。未測真實 iPhone／Safari、App 關閉後背景執行、實際交通即時營運或景點開放資訊；這版沒有該營運資料源。

發布後正式站驗證：Open-Meteo 天氣、Wikipedia、地名服務皆 HTTP200；東京真實資料可離線重載，京都人工選城與自動更新開關保存，320／390 無溢出或 pageerror。京都該次查詢 0 車站，空結果提示正確；資料覆蓋非完整目錄。Vercel success，正式站 bundle index-B4inossp.js。
