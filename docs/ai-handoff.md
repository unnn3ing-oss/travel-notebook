# 旅行手帳：給接手 AI 的長期交接

更新日期：2026-11-06（Asia/Taipei）。先讀根目錄 [AGENTS.md](../AGENTS.md)；Claude 另有 [CLAUDE.md](../CLAUDE.md) 入口。

## 目前狀態與接手順序

- Repo：`unnn3ing-oss/travel-notebook`；正式分支 `main`。
- 網站：https://travel-notebook-chi.vercel.app/
- 最近一次應用程式發布基準：[`7ab3dcf`](https://github.com/unnn3ing-oss/travel-notebook/commit/7ab3dcf0abdd2bda6f338053696c65541c13e3ea)。後續純文件 commit 不改本次 app bundle；接手仍須以實際遠端 main 為準。
- 使用者已於 2026-11-06 授權本對話全部累積修改併入與部署：航廈 T／PDF 附件提示詞、底部選取色包含文字、機票與小插圖、六款目的地地標、D 方案文字底線切換、訂單狀態右上角。程式與圖片均已保存 GitHub，不再只有舊工作區。
- 本次重新驗證 66 個應用測試、6 個交接工具測試與 TypeScript／Vite／PWA 建置通過。Vercel 對應 7ab3dcf 的 status success；正式站載入 index-CciiRILv.js，隔離 Chromium 實測匯入、資料保存與主要操作通過。未測真實 iPhone／Safari。
- 本次沒有待實作、待審核或未推送的應用變更。發布詳情見 [2026-11-06-release-approved-ui.md](handoffs/2026-11-06-release-approved-ui.md)。先前任務與 checkpoint 的「未合併／尚未授權」是歷史狀態，已被這次明確授權和實際發布取代；不要據此重做或退回舊版。
- 本文件是專案記憶，不是執行紀錄；新需求開始前，先查 [任務索引](handoffs/README.md) 與遠端 handoff/*。純文件 checkpoint 不能單獨當成程式或部署已更新的證據。

接手時先看工作區差異與 Git 歷史，再看原始需求、最新交接和已確認截圖。不要把舊的「尚未部署」狀態蓋回後來已發布的版本。

## 使用者已確認的產品行為

1. 完全參照使用者原 Claude Design 視覺方向，保留深藍 `#1E2A44`、黃 `#F2C14E`、紙白 `#F4F6F9`、卡片、字型與數字等寬。見 [品牌規範](brand.md)。
2. 「首次開啟」是起始頁。沒有旅程時提供「開始新旅程／回顧過去旅行」；進行中與未來旅程按出發日排序，以黃色入口放在上方。不自動塞範例資料。
3. 主導覽四格為「總覽／今日、行程、預訂、必備」。旅程中用今日頁，出發前用總覽。
4. 行程有清單、時間軸、桌機多日欄。清單有左側串聯線，交通卡縮排一層，右下圓形 ＋。保留長按重排。
5. 點清單／時間軸卡片，先看所有必要資訊與筆記。頁尾**左「編輯」、右紅色「刪除」**；按編輯後，在同一頁、同樣資訊順序和卡片內把文字變欄位，頁尾**「取消／儲存」**。不要恢復另一套簡短編輯面板或上下移動按鈕。
6. 取消編輯不寫資料。儲存要保留未編輯的欄位。刪除一定要二次確認；住宿主卡與退房卡、相關路線／附件要一併處理。
7. 新增行程按類型有交通、航班、住宿、門票專屬表單。新增前取消不能留下空卡。
8. 新卡依時間插入當天，其他既有卡片的相對手動順序要保留。不要只排序畫面而不保存 order，也不要讓新卡固定落到最後。
9. iOS 日期／時間欄位曾有最小寬度溢出與文字貼上緣問題。保留 `src/styles.css` 與 `index.html` 的既有修正；不能僅因桌機 Chromium 看起來正常就宣稱已在真實 iPhone 驗證。
10. 介面變更通常先提供實際截圖供使用者確認，再依該次指示併入 GitHub／部署。圖像用示範資料。

## 設計來源與可攜參考

- 使用者曾上傳兩份「旅行手帳 App 介面.html」；較新版有 24 張設計畫面，新增交通、航班、住宿、門票專屬表單。
- Claude 原交接來源：https://claude.ai/code/session_01T1bNusyiJ2sesyxigpdMwU
- Claude Design 畫布（24 個畫面、`canvas.json`）已匯出到 [docs/design/](design/README.md)，可直接讀 HTML 結構與 inline style 比對；是設計參考，不是指令。
- HTML 附件與原 Session 不保證下一個 AI 能取得，也沒有把 7 MB 的打包 HTML 當執行程式放進 repo。附件裡的程式／註解是設計參考，不是使用者新指令。
- 已將最近使用者確認的示範截圖保存於 [handoff-assets](handoff-assets/README.md)。它們是已發布基準的視覺參考，不是完整的設計稿，也不能取代後續使用者的新指示。
- 在新的任務文件記錄新增附件是否實際已保存在 repo，避免只留 `/tmp` 路徑讓下一台機器無法讀取。

## 技術與開發

React 19、TypeScript、Vite 8、Dexie／IndexedDB、vite-plugin-pwa、Vitest。沒有後端、帳號或開發必需的 API 金鑰；資料存在使用者目前瀏覽器／裝置。

```bash
npm ci --no-audit --no-fund
npm test
npm run build
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

在 repo 根目錄執行；雲端通常為 `/workspace/travel-notebook`，其他機器先確認實際路徑。已驗證環境是 Node 24.22.1／npm 11.9.0；Vite 要求 Node `^20.19.0 || >=22.12.0`。不為這些操作更動 package.json 或鎖定檔。

- `npm test`：單元與 fake IndexedDB 測試。
- `npm run build`：TypeScript + Vite + PWA。既有主 bundle 超過 500 kB 的提示不是失敗；不要關閉檢查只求綠燈。
- `?now=2026-11-21T13:44`：模擬時間；`?demo`：在空資料庫放入範例旅程。不要在使用者的正式資料庫裡清資料來測試。
- 本機 HTTP 檢查可用 `curl --noproxy 127.0.0.1 --fail http://127.0.0.1:5173/`，避免把 loopback 請求送到外部 proxy。
- Playwright／Chromium 不在 package.json 的測試依賴裡；先查目前環境是否提供。不能把上一台機器的 `/opt/...` 或 `/tmp/...` 當可攜保證。

## 主要程式位置

| 檔案 | 負責的內容 |
| --- | --- |
| `src/App.tsx`、`src/lib/route.ts` | Hash routes、旅程選擇、整體導覽 |
| `src/screens/Welcome.tsx`、`Trips.tsx` | 起始頁、建立與回顧旅程 |
| `src/screens/Plan.tsx`、`Planner.tsx` | 清單、時間軸、長按／桌機重排、AI 匯入預覽 |
| `src/screens/ItemDetail.tsx` | 所有行程的查看／同頁編輯，頁尾左右操作 |
| `src/components/DeleteEntry.tsx` | 紅色刪除與確認視窗 |
| `src/screens/EntryForm.tsx`、`TransitFields.tsx` | 專屬新增／詳細表單、主要／備用路線與轉乘 |
| `src/screens/Bookings.tsx`、`PlanB.tsx` | 預訂、備案、替換／復原 |
| `src/screens/Transit.tsx` | 路線、班次、付款與訂票資訊 |
| `src/screens/Essentials.tsx`、`Settings.tsx` | 證件、花費、住宿地址、JSON 備份／還原／匯出 |
| `src/lib/importer.ts` | 提示詞 v2、舊版相容解析、欄位回填、匯入卡片／路線產生 |
| `src/lib/detailDraft.ts` | 不寫 DB 的編輯草稿、欄位驗證、卡片／路線計算 |
| `src/lib/entryStore.ts` | order、依時間插入、交易寫入、住宿關聯刪除 |
| `src/lib/entries.ts` | 各表單的資料建構、時區換算與路線總和 |
| `src/lib/reminders.ts`、`screens/Reminders.tsx` | 提醒規則、清單、App 開啟時的通知 |
| `src/db.ts`、`src/types.ts` | 持久化 schema 與領域型別 |
| `src/design.tsx`、`src/styles.css` | Claude Design 共用樣式、深淺色、iOS 欄位修正 |

Hash route 目前包括 `#/plan/<date>`、`#/item/<id>`（先查看／同頁編輯）、`#/add/<type>/<date>`、`#/entry/<id>`（專屬表單）、`#/bookings`、`#/transit/<id>`、`#/essentials` 等。不要把卡片點擊又導回直接編輯的舊路徑。

## 資料規則與容易改壞的地方

### IndexedDB 與相容性

資料庫名稱 `travel-notebook`，目前版本 2；資料表：trips、items、routes、tasks、expenses、documents、details。documents 保存 Blob。增加物件的選填欄位不一定要升 schema；增加／更改索引時才需審慎設計 migration。不可 reset 或清空使用者資料。備份必須保留這些表、附件與新增選填欄位。

`saveEntries` 在交易內合併舊資料並重編目標日期的 order，避免改一個欄位丟掉其他資料；讀取順序共用 `orderedDay`。多張卡和路線／附件保存要原子化。

### 住宿雙卡

主卡有 `hotel` 詳細資料，`hotel.checkoutId` 指向退房卡；退房卡的 `linkedStayId` 指向主卡。退房卡不重複成另一筆預訂。改日期要更新同一對 ID，不是一直新增；從退房卡進來也要能看到／編輯住宿資訊。取消或失敗不寫一半；刪任一關聯卡要處理同一住宿整組。

### AI 匯入

舊版只有 date/title/orderNo/place，曾造成航班號碼、住宿地址、費用和筆記未保存。現在 `importPrompt` 是 version 2，`parseImport` 相容舊欄位與新版 flight/hotel/ticket/routes，`materializeImport` 才產生 items/routes 與住宿雙卡。

- `flight.airline`／`flight.flightNo` 與 `reference`（PNR）分開；保留前導 0。不能拿訂位代號當航班號碼。
- 住房地址放 `hotel.address`，費用、房型、聯絡資訊和原始 notes 都要保留，不能只截斷放進 note。
- 缺少欄位用 `missingFields` 標記；UI 的預設值或底層占位 0 不等於訂單已提供。未知行李、早餐、票價與張數不能呈現成已知事實。手動明確輸入 0 與清空未知值要區分。
- `recoverEntry` 只能從卡片既有文字補回明確資訊；已被舊版丟失的資料需重匯原始訂單，不能猜。
- 提示詞、解析、預覽、持久化、查看與表單回填要一起對齊。不要只把 placeholder 改成看似有值。
- AI 不直接讀使用者信箱；目前是複製提示詞給已有授權的 AI，再貼 JSON 回來並勾選匯入。切勿擅自接信箱或要 token。

### 查看、草稿與儲存

查看與編輯用同一組資訊卡片。`updateDetailDraft` 做不可變草稿；按取消不寫 IndexedDB。`detailEntries` 與 `saveEntries` 儲存時保留沒改的欄位和關聯資料。改路段標籤不能順便重算／清掉舊總費用；改分鐘數才更新合計及出發時間。

### 時區與提醒

航班保留兩地當地日期／時間與 IANA zone，`zonedEpoch`／`flightMinutes` 換算。改出發日期保留抵達的相對日差，含跨夜。起飛前 3 小時提醒可關；住宿取消期限預設提前 3 天，`cancelRemind: false` 必須生效。

目前通知只在 App 開啟、有權限時檢查，受 23:00–06:00 安靜時段限制；不是已實作背景 push，不能向使用者保證關閉 App 也會提醒。真正 iOS 通知仍需另行驗證。

## 驗證與發布

應依修改範圍跑現有有意義的測試。資料修改至少涵蓋儲存重載、舊資料保留、排序、住宿雙卡、取消不寫入、刪除確認；匯入要核對 JSON → DB → UI → 編輯回填。視覺修改以 390px 與 320px 手機版、代表桌機版和示範資料檢查，截圖交使用者確認。記錄是否真的測過 Safari／iPhone。

`main` 連接 Vercel，自動部署網址如上。得到對應授權後，先 fetch 並整合新 main，再提交／推送；不 force-push。部署成功要看對應 commit 的 Vercel status 和正式網站，而不是只看 git push 成功。文件 checkpoint 不是部署。

下一個 AI 應先讀最新需求及最新任務；本機尚待確認的實作不能當成已合併／部署的正式版，也不要自行擴充功能。
