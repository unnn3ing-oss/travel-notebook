# 任務交接：航廈標示與 PDF 訂位資訊提示詞

- 日期：2026-11-06（Asia/Taipei）
- 狀態：planned
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

尚未改程式，先保存此計畫。已檢查乾淨工作區並 fast-forward 最新 main（只新增設計文件），沒有覆蓋其他 AI 工作。下一步：確認 checkpoint pushed 後實作、驗證、提供示範截圖。程式完成後仍須等使用者確認才併入 main／部署。

## Checkpoint 紀錄

發布後補實際分支與 SHA。純文件 checkpoint 不包含尚未提交的程式；目前無應用修改。
