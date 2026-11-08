# 任務交接：Drive 403 與清單錯誤提示

- 日期：2026-11-08（Asia/Taipei）
- 狀態：in_progress；已獲本次推送／部署授權
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

## 完成狀態

本機 commit 5b9e6bc8663a354596fca8eb1cd2cd8b7bcd1bd0，未推程式／未部署。121 tests／18 files、TypeScript／Vite／PWA、diff check 通過；bundle index-9k9LmVWD.js。隔離 Chromium 模擬 Google SERVICE_DISABLED→正確啟用提示、沒有錯顯示空備份、模擬啟用後重新整理→空清單成功，無 pageerror。圖 docs/handoff-assets/drive-error-feedback/disabled-api-mocked.png 為模擬，未取得真實帳號錯誤回應。不聲稱已替使用者啟用 API 或實際授權成功。

使用者應在同專案 Google Cloud Console 啟用 Drive API，等候傳播後重新整理清單；這個設定不需部署 App 即可生效。程式修正仍需本次「推」授權。初次 checkpoint 已 pushed：44025abf1775cb8abce6b975dcaf59e1236d2f8e。接手先看工作區差異與此本機 SHA；文件分支不含程式 diff，換機無法只靠該分支恢復修正。

## 本次發布授權

使用者本輪明確指示「推」，授權 5b9e6bc 修正、截圖與交接併入 main／Vercel 部署，取代上述待審核限制。遠端仍為 c39e99e，工作區乾淨；發布後驗證正式站新版與模擬錯誤／重試流程，不代表已啟用使用者 Google 專案 API。
