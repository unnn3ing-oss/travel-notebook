# 任務交接：行程卡片插圖與六款目的地頁首

- 日期：2026-11-06（Asia/Taipei）
- 狀態：awaiting_review（實作與驗證完成，待使用者確認實際截圖及合併／部署）
- 正式版基準：0381130d4fa9feff219864fac756e1044023e889
- 本機基準：c90204a（已保留航廈／PDF 與底部選取色修改，尚未推送程式）
- 工作分支：work
- 授權：使用者已確認圖片並說「開始改」，授權本次實作與驗證；仍沿用先提供實際截圖，再確認合併／部署的流程。純文件 checkpoint 已授權。
- 設計來源：對話中已確認生成圖片 exec-4e73fa52-49e4-4522-8c56-ce0e1ac4ee7c.png 與 exec-3c958fe2-8d99-4d18-928d-b2c44d18ee7b.png。已保存副本至 docs/handoff-assets/itinerary-art/approved-designs/，目前僅在本機 commit，尚未推送圖片。以使用者最新確認優先於舊 docs/design。

## 使用者需求

各旅程的行程清單依類型呈現個別樣式：航班是狹長機票，左側有較明顯的飛機與雲、票根與虛線；其他類型圖案縮小約一半，僅作點綴。交通、住宿入住／退房、門票、景點、餐廳、租車與其他行程皆須有合適圖案。頂部根據填入航班目的地顯示日本、韓國、台灣、新加坡、香港、馬來西亞的知名地標。

## 修改方向

1. 製作輕量共用 SVG 插圖：航班機票較大，其他類型僅 28–32px 小圖，文字優先；住宿入住與退房可區分。
2. 清單以時間標籤、左側串聯線、小圖卡片呈現，航班有完整機票造型；交通保持縮排。未知航班代碼／時間不補猜值。
3. 共用插圖套用時間軸、桌機卡片，維持原有空間限制和互動。航班資訊取現有欄位，航廈沿用 formatTerminal。
4. 行程頁頂部共用目的地頁首，標題仍為使用者旅程名稱，地標靠右不遮文字。按起飛日期／時間取旅程最早的航班，避免回程或手動排序改變主題。明確 IATA 代碼對應六款地標；首班目的地未知、空白或無航班時顯示中性旅途圖案，不憑旅程名稱或時區猜測，也不改用較晚的回程目的地。
5. 多國旅程先以時間最早的航班為固定主題，不隨選取日期跳動；不新增國家選單或修改資料庫。
6. 預計檔案：src/lib/destinations.ts 與測試、src/components/TravelArt.tsx、目的地頁首／行程卡片共用元件、src/screens/Plan.tsx、Planner.tsx、src/styles.css 及交接／設計參考。
7. 保留先前航廈、PDF 提示詞與底部選取黃底；保留 IndexedDB、清單排序、住宿雙卡、資訊先看再編輯和刪除確認。不改 schema、依賴或部署設定。

## 驗收與驗證

- 對照兩張已確認設計圖，提供真正實作的 390px 手機、六款地標、時間軸及桌機截圖。
- 非航班插圖約 28–32px，機票主圖較大；機票資料來自使用者欄位，沒有補範例事實。
- 六款已知目的地、其他機場、缺資料、往返／多國、跨日日期與手動排序不影響主題的測試。
- npm test、npm run build；Chromium 320px、390px、1280px 深淺色、長標題、空旅程／未排、全部類型；核對點卡、重排、頁首隨航班資料更新與既有資料未被寫入。
- 未實測真實 iPhone／Safari 時如實記錄。

## 接手狀態

已確認修改前 checkpoint pushed 才開始實作。完成於本機 work commit `7ad28f1a15705122179557db9a12502bb30cc6ef`，**沒有推送任何程式分支、沒有合併 main 或部署**。

已完成檔案：

- src/components/TravelArt.tsx：飛機與雲、其餘 28–32px 點綴插圖、住宿入住／退房區分、六款地標及中性旅途圖；小圖線條隨深淺色變化，無外部圖片請求。
- src/components/DestinationHeader.tsx、src/lib/destinations.ts：以最早航班目的地 IATA 對應六款主題，含常見區域機場；Trip 名稱與資料均不改。
- src/components/ItineraryCard.tsx、src/screens/Plan.tsx、Planner.tsx、src/styles.css：清單機票造型、各類小圖卡、時間軸／桌機共用插圖，原有點卡與排序互動保留；修正桌機因 CSS 規則順序同時出現手機清單的問題。
- src/lib/destinations.test.ts：4 個有意義的主題判斷測試。docs/handoff-assets/itinerary-art/ 保存已確認概念圖與實際審核截圖，兩者狀態分開標示。

最終驗證：

- npm test：12 個檔案、66 個測試全數通過。
- npm run build：TypeScript／Vite／PWA 成功，既有 bundle >500 kB 提示仍存在。
- Chromium 320／390／1280px 深淺色：清單、時間軸、長中英文名稱、六款目的地與未知主題、航班資料更新、未排景點庫及空白旅程皆正常，無水平溢出或 pageerror。桌機不重複顯示手機清單。
- 滑鼠模擬長按 380ms 後重排可保存 order，主題不隨順序改變；桌機原生拖曳餐廳卡到另一天可保存日期與排序。
- 透過清單卡片鍵盤 Enter 進入既有資訊頁再返回；純查看／切換清單與時間軸前後資料庫 items 完全相同。先前航廈、PDF 提示詞、底部選取背景皆保留。
- git diff --check 通過。未測真實 iPhone／Safari，未改 schema、依賴或 Vercel 設定。

截圖在 docs/handoff-assets/itinerary-art/screenshots/：list-japan.png、list-other-types.png、mobile-top.png、six-destinations.png、各 header-*.png、list-dark.png、timeline.png、desktop.png、narrow-long-title.png。長截圖以延長視窗高度讓導覽出現在圖底；six-destinations 是實際元件 DOM 的比較截圖，不是 AI 再次生成。

接手第一步：讀最新使用者回覆，確認是否已核准本次及先前修改、是否授權合併部署。若仍只是在確認截圖，維持待審核；獲授權後先確認本機 commits 尚在、fetch 最新 main、整合變更，再推送及驗證 Vercel 對應 commit／正式網站。此任務實作已完成，不要依舊 planned checkpoint 重做。

先前航廈／PDF：c474a19 + c30d673；底部工具列：a5e91a6 + c90204a，皆為本機祖先 commit，保留且尚未推送。所有尚未推送的程式與圖片只在 /workspace/travel-notebook；純文件 checkpoint 不包含其 diff，另一台機器不能只靠交接文件恢復這些 commit。沒有新的待實作功能；下一步是使用者審核。

## Checkpoint 紀錄

- 修改前計畫已 pushed：分支 [handoff/2026-11-06-itinerary-art-destinations-20261105-230410-048126](https://github.com/unnn3ing-oss/travel-notebook/tree/handoff/2026-11-06-itinerary-art-destinations-20261105-230410-048126/docs/handoffs)，commit `ba3007c581d70fd82548cfffa5548d115aa19439`。
- 完成後交接已確認 pushed：分支 [handoff/2026-11-06-itinerary-art-destinations-20261105-231735-742915](https://github.com/unnn3ing-oss/travel-notebook/tree/handoff/2026-11-06-itinerary-art-destinations-20261105-231735-742915/docs/handoffs)，commit `43c6ac08c63d487fd173ef9b727c099cc4f500b7`。程式與圖片未隨 checkpoint 推送。
