# 任務交接：訂單狀態移到卡片右上角

> 2026-11-06 發布確認：使用者已明確要求「併入 部署 vercel」。本任務已隨 `7ab3dcf0abdd2bda6f338053696c65541c13e3ea` 併入 main，Vercel 成功且正式站已驗證。原始碼與圖片現已保存 GitHub；下方「只在本機／待授權」是當時審核階段的歷史紀錄，已由本次發布取代。請讀 [最新發布交接](2026-11-06-release-approved-ui.md)，不要重做本任務。

- 日期：2026-11-06（Asia/Taipei）
- 狀態：completed（使用者已確認；已併入 main 並部署，見最新發布紀錄）
- 正式版基準：0381130d4fa9feff219864fac756e1044023e889
- 本機基準／分支：c70192a／work，包含先前待審核修改，程式尚未推送。
- 授權：實作並提供截圖；尚未授權程式合併 main／部署。純文件 checkpoint 已授權。

## 使用者需求

將旅程行程卡片的訂單狀態放到右上角，沿用現有「還沒訂／已訂購／訂單確認」文字與配色。

## 修改方向

1. 共用 ItineraryCard 的航班、一般類型與 compact 版本使用相同右上角狀態標籤；移除原本標題旁、內容下方的重複狀態。
2. 標題保留標籤空間，長標題自動換行，不與狀態重疊。拖曳把手移到卡片右側中央，與狀態及箭頭分開。
3. 沒有 booking 的卡片（例如退房卡）不補猜狀態；保持原資料與點卡、長按、日期排序行為。
4. 僅調整共用卡片元件及 CSS，保留前項 D 方案與地標／插圖；資料庫、依賴及部署設定不變。

## 驗收與驗證

- 320／390px 深淺色、桌機與時間軸：三種狀態在右上角、每卡一個，與標題及拖曳把手不重疊；無狀態不新增標籤。
- 使用示範長標題與各類卡片、點卡與資料不變檢查，提供截圖。執行 npm run build，不為純樣式改動新增鏡像測試。
- 未測真實 iPhone／Safari 時如實記錄。

## 接手狀態

已確認計畫 checkpoint pushed 才實作。完成於本機 work commit `a0451824bf364e747e0f9dd18fc67c529b776428`，只改共用 ItineraryCard、CSS 與示範截圖。所有先前修改均保留，沒有程式推送／合併／部署。

結果：三種狀態沿用 BookingPill 配色，統一在共用卡片右上角，只顯示一次。標題保留右側空間，把手移到右側中央；compact 時間軸與桌機卡片亦適用。沒有 booking 的卡片不增加標籤。資料與事件處理不變。

實際驗證：

- npm run build：TypeScript／Vite／PWA 成功，既有 >500 kB bundle 提示仍存在。git diff --check 通過。
- Chromium：320／390px 深淺色、時間軸與 1280px 桌機；三種狀態均只顯示一次，幾何檢查位於右上角 9px 內、與長中英文標題及把手不重疊，沒有水平溢出。
- 點卡進航班資訊再返回正常；單純顯示／切換前後 items 完全一致，無 pageerror。無 booking 的卡片沒有狀態標籤。
- 純樣式工作未重跑完整單元測試、未測真實 iPhone／Safari。

截圖：docs/handoff-assets/card-booking-corner/flight.png、all-cards.png、mobile.png，均為示範資料且僅在本機。原使用者資料不曾被測試腳本存取。

下一個 AI：先讀最新使用者回覆。此項已實作完成，不要依 planned checkpoint 重做；若未授權合併部署則維持待審核。獲准後檢查本機祖先 commits（含前面 D 方案、插圖與地標、底部工具列、航廈／PDF）、fetch 最新 main，再整合／推送及驗證 Vercel。文件 checkpoint 不包含未推送程式與圖片，原始碼仍只在 /workspace/travel-notebook；換機無法僅靠文字恢復這些 commit。

## Checkpoint 紀錄

- 修改前計畫已 pushed：分支 [handoff/2026-11-06-card-booking-corner-20261106-123729-780916](https://github.com/unnn3ing-oss/travel-notebook/tree/handoff/2026-11-06-card-booking-corner-20261106-123729-780916/docs/handoffs)，commit `1fe0babda8ae33794d99fb3f27e2ca090288aa65`。
- 完成後另存純文件交接，實際分支／SHA 以發布工具輸出與讀回為準；不包含應用程式或截圖。
