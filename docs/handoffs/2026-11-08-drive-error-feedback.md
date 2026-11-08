# 任務交接：Drive 403 與清單錯誤提示

- 日期：2026-11-08（Asia/Taipei）
- 狀態：planned
- 基準：c39e99e，work，工作區乾淨
- 授權：使用者回報連接後 403 並錯顯示沒有備份；允許修正與驗證，尚無本次推送／部署指示。

## 使用者需求

連接 Google 後出現拒絕備份存取與沒有備份兩則訊息。使用者確認 Drive API 尚未啟用／不確定。已提供同一專案啟用 Drive API 步驟，不聲稱已查到其私人 Google Console 狀態。

## 修改方向

解析 Google 403 的已知 reason：SERVICE_DISABLED／accessNotConfigured 提示網站擁有者啟用同一專案 Drive API；權限不足與配額限制分別提示。只顯示受控訊息，不回顯 API 原文、token 或帳號。保持最小 drive.file scope。清單另記成功狀態，讀取失敗不得說沒有備份，保留先前成功清單可重試。

## 驗收與驗證

單元驗證 Google 常見 403 格式、無效回應 fallback；瀏覽器模擬 API 未啟用→無空清單誤報→啟用後重試空清單成功；npm test／build。真實 API 啟用與帳號驗證仍由使用者操作。

## 接手狀態

尚未改程式，先保存此計畫。預計改 googleDrive.ts／test、GoogleDriveBackup.tsx、設定指南。實作完成供審核，未收到本次推之前不部署。
