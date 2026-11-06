# 任務交接：D 方案文字底線檢視切換

> 2026-11-06 發布確認：使用者已明確要求「併入 部署 vercel」。本任務已隨 `7ab3dcf0abdd2bda6f338053696c65541c13e3ea` 併入 main，Vercel 成功且正式站已驗證。原始碼與圖片現已保存 GitHub；下方「只在本機／待授權」是當時審核階段的歷史紀錄，已由本次發布取代。請讀 [最新發布交接](2026-11-06-release-approved-ui.md)，不要重做本任務。

- 日期：2026-11-06（Asia/Taipei）
- 狀態：completed（使用者已確認；已併入 main 並部署，見最新發布紀錄）
- 正式版基準：0381130d4fa9feff219864fac756e1044023e889
- 本機基準／分支：5552b66／work，包含前面尚未推送的修改。
- 授權：使用者選 D，實作文字底線檢視切換；尚未授權程式合併 main／部署。已授權純交接 checkpoint。

## 使用者需求

目前清單／時間軸切換太大。使用者從四種圖片提案中選擇 D：小型文字切換，當前項目以黃色短底線標示，和 AI 匯入放在日期下方同一列，不再獨佔整列。

## 修改方向

1. 移除頁首下方的大膠囊，把清單／時間軸文字放在日期列後方工具列左側，AI 匯入在右側。
2. 清單／時間軸共用同一工具列，保留日期樣式、sessionStorage 記住檢視方式、aria-pressed 與鍵盤焦點。長按排序仍保留，說明改為輔助文字避免再多佔一列。
3. 只修改 Plan.tsx 與對應 CSS；保留已完成的機票卡、六款地標、底部黃底、航廈與 PDF 提示詞。不改資料與桌機多日規劃。
4. 完成後提供實作截圖、保存交接，再等使用者確認合併部署。

## 驗收與驗證

- 390px／320px 深淺色：選取文字及黃色短底線清楚，無整列膠囊，和 AI 匯入並排，無水平溢出。
- 切換與重載保留檢視；兩種檢視均可開 AI 匯入；切換保留鍵盤焦點與日期，單純操作不寫 items。
- 空旅程與未排景點庫維持原有行為；桌機仍僅顯示多日規劃。執行 npm run build、瀏覽器實測與截圖；不為純樣式變更新增鏡像測試。
- 未測真實 iPhone／Safari 時如實記錄。

## 接手狀態

已確認修改前計畫 pushed 才開始實作。完成於本機 work commit `89a7ccbc5af16dafd71f0a3eeb9525156718e27f`，只更動 Plan.tsx、styles.css 及示範截圖，沒有推送程式／合併 main／部署。

實作：日期下方共用工具列，左側文字檢視切換、右側 AI 匯入；目前項目顯示黃色短底線。切換控制組只約 90px 寬，40px 點擊高度，沒有大膠囊。Timeline 原日期 rendering 抽出至 TimelineDays，保留其日期樣式；控制組維持在同一個 DOM 位置，切換不丟鍵盤焦點。排序說明改用 aria-description，長按行為保留。

實際驗證：

- npm run build：TypeScript／Vite／PWA 成功；既有 >500 kB bundle 提示仍存在。git diff --check 通過。
- Chromium：320／390px 深淺色，清單及時間軸可雙向切換，重載仍記住檢視；兩者都能開關 AI 匯入。檢查黃色底線、日期下方同列工具列、小尺寸與無水平溢出。
- 日期切換、空日期、未排景點庫轉時間軸回第一天、空旅程入口維持原行為；1280px 仍只顯示桌機多日規劃。
- 切換後鍵盤焦點留在對應按鈕。單純操作前後 items 完全一致，無 pageerror。
- 本次為視覺／控制位置調整，未重跑完整單元測試；前項 66 個通過是歷史結果。未測真實 iPhone／Safari。

截圖：docs/handoff-assets/compact-view-switch/toolbar.png、list.png、timeline.png，均為示範資料、目前只在本機 commit，尚未推送圖片。

下一個 AI：先讀使用者新回覆；本次實作已完成，不要依 planned checkpoint 重做。未獲合併／部署授權則維持待審核。獲准後確認本機 commits 都在，fetch 最新 main 再整合、推送及驗證 Vercel。前面航廈／工具列／卡片與地標均保留在本機祖先 commits，還未推送程式。純文件 checkpoint 不是程式備份；原始碼仍在 /workspace/travel-notebook，換機無法只靠交接檔恢復這些 commit。

## Checkpoint 紀錄

- 修改前計畫：分支 [handoff/2026-11-06-compact-view-switch-20261106-122750-235231](https://github.com/unnn3ing-oss/travel-notebook/tree/handoff/2026-11-06-compact-view-switch-20261106-122750-235231/docs/handoffs)，commit `0d670b2d27a76266e78e04b5b12bbdf2e267eaed`，已確認 pushed。
- 完成後再保存純文件交接，以工具實際輸出與讀回為準；不包含應用程式與截圖。
