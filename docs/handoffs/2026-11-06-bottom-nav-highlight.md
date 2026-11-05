# 任務交接：底部工具列選取底色包含文字

- 日期：2026-11-06（Asia/Taipei）
- 狀態：awaiting_review（實作與驗證完成，待使用者確認截圖）
- 正式版基準：0381130d4fa9feff219864fac756e1044023e889
- 本機基準：c30d673（包含尚待審核的航廈與 PDF 提示詞任務）
- 工作分支：work
- 授權：實作並提供截圖；依使用者既有流程等待確認後才合併／部署。純交接文件 checkpoint 已預先授權。

## 使用者需求

底部工具列目前只在選中項目的圖示後方顯示黃色底，使用者希望底色也包含下方文字，形成完整的選取區。沿用原深藍／黃配色與四項導覽，不改其他功能。

## 修改方向

1. 檢查目前共用 Nav，將圖示背景改為同時包住圖示與標籤的圓角區域，維持四項等寬、置中、可點擊與 aria-current。
2. 選取區使用 var(--ticket) 與 var(--on-ticket)，非選中項目維持現況；沿用導覽高度與底部安全留白。
3. 預計修改 src/design.tsx 的 Nav 結構／樣式；必要時才調整相關 CSS。不變更資料庫、依賴、路由或先前航廈／PDF 實作。
4. 先保存本計畫到 GitHub，確認 pushed 後改程式。完成後提供示範截圖及更新交接。

## 驗收與驗證

- 黃底實際包住選中項目的圖示與文字，非選中項目不變黃。
- 四項切換皆正確；旅程中的「今日」亦正確；保留可讀文字與目前頁 aria-current。
- Chromium 檢查 320px、390px、桌機、深／淺色與底部安全留白，輸出手機截圖；未測真實 iPhone 時如實記錄。
- 執行 npm run build；純低影響視覺修改不新增鏡像測試，不需重跑未變更資料邏輯的完整單元測試。

## 接手狀態

已確認修改前計畫 pushed 才實作。應用修改只有 src/design.tsx 的共用 Nav：黃色圓角選取區包含圖示與文字；預設高度仍為 84px，改用 min-height 讓較大的底部安全留白能正常伸展。沒有更動其他導覽、資料或前項實作。

實際驗證：

- npm run build：最終版本 TypeScript／Vite／PWA 成功；既有 bundle >500 kB 提示仍存在。
- Chromium：320px、390px、1280px，深／淺色共 24 組四分頁切換均通過；選中區包含文字與圖示、深藍文字可讀、非選中無黃底、aria-current 只有一個、無水平溢出。亦驗證旅程中「今日」選取。
- 將底部 padding 設為 34px 模擬較大的安全區，確認導覽高度隨之增高且留白至少 34px。不是實機 env(safe-area-inset-bottom)／iPhone 測試。
- 無 browser pageerror，git diff --check 通過。本次僅視覺調整，未重跑完整單元測試；前一項任務的 62 個測試通過是歷史結果。
- 瀏覽器檢查腳本第一次因路由切換尚未完成就讀選取項而失敗；等待 aria-current 對應項出現後重跑全數通過，無須改動應用邏輯。

應用修改與 3 張示範截圖已保存於本機 work commit `a5e91a65e8b5000d3e3181646c11557a29e2401e`，尚未推送任何程式分支、合併或部署。截圖在 docs/handoff-assets/bottom-nav-highlight/，亦僅存在本機。前一項航廈／PDF 修改 c474a19 與交接 c30d673 已保留，仍待使用者確認。本次不視為部署或核准前項的指示。

下一個 AI 的第一步：查看使用者最新回覆是否確認本次及前項修改、是否授權合併部署。未核准則維持待審核，勿用舊訊息的推送授權發布本次程式。核准後檢查本機 commits、最新遠端 main，再整合／推送及驗證 Vercel。文件 checkpoint 不包含程式備份；原始碼目前僅在 /workspace/travel-notebook，換機不能單靠此文件恢復未推送 commit。

## Checkpoint 紀錄

- 修改前計畫已 pushed：分支 [handoff/2026-11-06-bottom-nav-highlight-20261105-174924-727464](https://github.com/unnn3ing-oss/travel-notebook/tree/handoff/2026-11-06-bottom-nav-highlight-20261105-174924-727464/docs/handoffs)，commit `2477d4444824fe9a144b628fe177410f33441687`。
- 完成後保存純文件 checkpoint，實際分支／SHA 以發布工具輸出為準；程式與圖片沒有隨工具推送。
