# 任務交接：交通多段轉乘的發車／抵達時間與備案班次

- 日期：2026-11-08（Asia/Taipei）
- 狀態：in_progress
- 正式版基準：c39e99e6970bb412cdca2becf01295cb23ffe7f8（origin/main，與本地 HEAD 相同）
- 工作分支：claude/zealous-sagan-009vbb
- 本次授權：僅「交接文件 checkpoint」。程式只推到工作分支 `claude/zealous-sagan-009vbb`（本 Session 指定）；**未授權**合併 main 與部署。介面修改完成後附示範資料截圖，待使用者確認。
- 相關使用者設計／來源：無新設計稿；沿用現有交通表單（`TransitFields.tsx`）與路線頁（`Transit.tsx`）樣式。

## 使用者需求

新增行程的交通功能要支援「多段轉乘」。範例：成田機場搭列車到日暮里，再轉 JR 山手線往新宿。成田機場那一段可能有不同搭車時間點的備案（錯過一班就改搭下一班），所以每一段要有**發車時間**與**預計抵達時間**。使用者要求快速修改。

## 現況（已讀程式確認）

- `Route.legs[]` 已能多段：`{mode,label,minutes,fare?,place?}`，已有主要／備用路線、轉乘次數、上移／刪除段落。
- 發車時間只存在路線層級 `Route.departures[]`（`dep/arr/info`），要存好後到「路線與班次」頁手動加；`planTransit`／`judgeDepartures`／提醒（`reminders.ts`）都以它判斷「還趕得上哪一班、錯過就看下一班」。
- 缺口：各段沒有自己的發車／抵達時間，也不能在新增交通時就填備案班次；多段時 `departures` 無法表達後面轉乘的連線。

## 修改方向

1. `Route.legs[]` 新增**選填**欄位：`dep?`、`arr?`（HH:mm）、`alts?: {dep,arr,info?}[]`（該段的備案班次）。選填、不升 IndexedDB schema；舊資料沒有這些欄位照常運作。
2. 新增 `src/lib/legs.ts`：
   - `legOptions(leg)`：該段主班次＋備案，依發車時間排序。
   - `deriveDepartures(route)`：以第一段非步行的搭乘為起點，對每個候選班次模擬後面各段（後段有時刻就取「不早於前段抵達」的最早班次，沒有就加分鐘數），得到最終抵達時間；接不上的候選不列入。結果寫回 `route.departures`，讓既有判斷與提醒不用改。第一段沒填時間時，**保留**使用者原本手動加的 `departures`，不覆寫。
3. `TransitFields.tsx` 新增／編輯路段表單加「發車」「預計抵達」與「備案班次」（可加多筆，含備註）。填了兩個時間時，分鐘數自動＝抵達－發車；未填則維持現行必填分鐘。路段清單顯示時間與備案。
4. `entries.ts` 的 `transitEntry`：驗證時間格式、抵達須晚於發車、備案同樣規則；呼叫 `deriveDepartures`；主要路線有班次時，卡片 `start` 以第一個可搭班次的發車時間扣步行時間（沒有班次維持原公式）。
5. `detailDraft.ts` 的 `updateRouteDraft` 與驗證：改段落時間時重算 `departures`；`ItemDetail.tsx` 的同頁編輯補上發車／抵達／備案欄位（取消不寫 DB 的規則不變）。有段落時間時，「已存班次」改為唯讀並註明由各段時間產生。
6. `Transit.tsx` 路段清單顯示每段發車→抵達與備案；既有班次判斷 UI 不重做。
7. 不動：住宿雙卡、時區、排序、提醒規則本身、備份格式（多出的選填欄位需確認備份／還原不丟失）。

## 範圍外（需使用者另行同意才做）

- AI 匯入提示詞與 `importer.ts` 解析各段 `dep/arr/alts`（目前未知欄位會被忽略，不會壞）。
- 跨午夜班次（現有 `departures` 亦無跨日欄位）；抵達不晚於發車一律拒絕。
- 即時班次、延誤資料。

## 驗收與驗證

- 單元測試：`legOptions`、`deriveDepartures`（成田→日暮里→新宿；備案；後段接不上；無時間保留舊 departures）、`transitEntry` 驗證、`updateRouteDraft` 重算、備份／還原不丟新欄位。
- `npm test`、`npm run build`。
- 示範資料（成田 N'EX／Skyliner 多班 → 日暮里 → 山手線 → 新宿）於 390px／320px 截圖：新增表單、路段清單、路線頁判斷錯過後改下一班。
- 未測真實 iPhone／Safari；不會宣稱已測。

## 接手狀態

修改前：尚未改程式，先保存此計畫。

## Checkpoint 紀錄

- 待發布後補上實際 handoff 分支、SHA 與連結。
