# 給提示詞設計者：目前 App 可填寫與可匯入的資料

核對日期：2026-11-06。依欄位基準 `f5ccc64` 的程式、表單與 parser 整理，後續四時段背景發布不改這些欄位。此文件已隨 `8aa76d7` 保存 GitHub main；是現有能力清單，不代表建議擴增欄位，不含使用者訂單資料。

## 1. 類型

| JSON type | 畫面名稱 | 目前能力 |
| --- | --- | --- |
| flight | 航班 | 專屬航班表單，機票卡片 |
| hotel | 住宿 | 專屬住宿表單，自動產生入住、退房關聯卡 |
| transit | 交通 | 專屬交通表單，主要／備用路線、多段轉乘與班次 |
| ticket | 門票 | 專屬場次、票種、張數、取票表單 |
| restaurant | 餐廳 | 通用行程／預訂欄位，沒有獨立人數或桌號欄位 |
| place | 景點 | 通用行程、地址、開放時間、網址、標籤、想看清單 |
| car | 租車 | 通用行程欄位，沒有專屬租車物件或跨日還車欄位 |
| other | 其他 | 通用行程／預訂欄位 |

快速新增主要顯示景點、餐廳、交通、住宿、門票、航班；其他預訂表單可選八種類型。UI 能填不等於 AI parser 支援同名 JSON，例如備案、想看清單並未接入本次匯入器。

## 2. 共通格式與欄位

旅程建立可填目的地、出發／回程日期、1–20 人、當地時區與幣別。目前幣別下拉為 JPY／KRW／THB／TWD／EUR；單筆 price 仍可保存其他明確幣別的自由文字。旅程本身不是 items，AI 不能透過 items.currency 更改整趟旅程幣別。

匯入根層：`{"version":2,"items":[...],"review":[]}`。輸出一個 JSON 程式碼區塊，版本 2，舊格式仍可讀。`review` 是外部 AI 對話的核對區，App 只匯入 `items`，不會顯示或存成筆記。

| 欄位 | 格式／用途 |
| --- | --- |
| type | 上表八種英文代碼 |
| title | 字串，卡片名稱；提示詞應明確提供 |
| date | `YYYY-MM-DD`；可由該類型的 departureDate／checkinDate／ticket.date 提供 |
| start、end | 24 小時 `HH:MM`，例如 `06:50`；缺少可用 null |
| booking | `none` 還沒訂、`ordered` 已付款但未確認、`confirmed` 訂單確認；未知 null |
| orderNumber | 字串，保留前導 0；航班／住宿／門票優先使用各自 reference |
| price | 字串，保留幣別，例如 `JPY 8,000`、`TWD 2,500.00` |
| place | 完整地址／地點字串，解析後存入 item.address；也接受 address，但提示詞統一用 place |
| from、to | 字串，通用出發地／目的地；租車可保存取還車門市 |
| notes | 一般行程筆記字串，建議 `• 第一項\n• 第二項`；無額外提醒 null |
| cancelBefore | 免費取消日期，僅 `YYYY-MM-DD` |
| cancelRemind | 布林 true／false，取消提醒可關閉 |
| hours | 開放時間字串，例如 `09:00–17:00，週一休館` |
| url | http／https 網址字串 |
| tags | 字串陣列；景點 UI 目前提供「喜歡、想去、想看、必去」 |

訂單狀態不代表付款方式。例如收到確認信但尚待平台自動扣款，可為 booking=confirmed，但不能因此填「已付清」。

AI 匯入每筆仍須能取得有效日期及名稱；缺少時會略過。App 本身有 date=null 的未排程卡，但不要在匯入 JSON 用 null 日期代替不知道的日期。匯入日期超出旅程期間時會放到未排程，保留原日期。

未知資料用 null，不用空泛的「未確認」字串填入數字或日期欄位；null、0、false 的意義不同。UI 預設行李、入住時間等，不是訂單已提供的證據。

## 3. 航班 flight

放在每筆 item 的 `flight` 物件內：

| 欄位 | 型別／選項 |
| --- | --- |
| airline | 航空公司代碼字串，2–3 個英數字，如 CI、TR、7C |
| flightNo | 航班號碼字串，如 `0156`，不可拿 PNR 代替 |
| from、to | 三個英文字母機場代碼，如 TPE、NRT |
| fromTerminal、toTerminal | 航廈字串，如 T1、T2；數字 1 會顯示成 T1，具名航廈保留 |
| departureDate、arrivalDate | `YYYY-MM-DD`，跨日抵達保留實際隔日日期 |
| departureTime、arrivalTime | 各自當地時間 `HH:MM` |
| departureZone、arrivalZone | IANA 時區，如 Asia/Taipei、Asia/Tokyo；不可寫 UTC+8 代替 |
| reference | PNR／訂位代號字串 |
| seat | 座位字串，如 `12A、12B`；parser 也接受字串陣列並合併 |
| cabin | economy 經濟艙、premium 豪華經濟艙、business 商務艙、first 頭等艙 |
| bags | 非負整數，託運件數；新增表單按鈕提供 0–9 件 |
| bagKg | 每件託運公斤數，非負數字 |
| carryKg | 手提行李合計重量上限，非負數字；不是每件重量 |
| checkinMinutes | 報到截止在起飛前幾分鐘，數字；新增快捷選項 40／50／60／90 |
| remind | true／false，起飛前 3 小時出發去機場提醒 |
| price | 含幣別費用字串 |
| rules | 此張機票重要退改規則的簡短字串 |

重量欄位的新增表單提示範圍為 0–100 kg；同頁編輯與匯入並非僅允許快捷值。要保留訂單真實數字，不依表單預設猜值。

目前沒有專屬欄位：每位旅客物件、每人不同 PNR、手提件數、登機門號、登機門關閉時間、票價品牌／機型、電子機票號碼。必要行動可用短筆記；來源及完整個別核對留 review。不要臆造 passengers、gate 等 JSON 欄位並以為 App 會保存。

## 4. 住宿 hotel

放在 `hotel` 物件內；只輸出一筆住宿，App 依日期建立入住／退房兩張卡。

| 欄位 | 型別／選項 |
| --- | --- |
| name | 住宿名稱字串 |
| checkinDate、checkoutDate | `YYYY-MM-DD`，退房日須晚於入住日 |
| checkinTime | 最早入住 `HH:MM`，不是最晚入住期限 |
| checkoutTime | 最晚退房 `HH:MM` |
| address | 完整當地語言地址，不要只放 notes |
| phone | 電話字串，保留 + 與國碼 |
| reference | 訂單編號字串 |
| room | 房型字串 |
| guests | 入住人數整數，手動表單 1–99 |
| breakfast | true 含早餐／false 不含早餐；未知 null |
| total | 含幣別總金額字串；每晚約多少由 UI 計算 |
| payment | now 已付清、later 明確現場付款；未知或待平台自動扣款 null |
| cancelBy | 免費取消日期 `YYYY-MM-DD`，只支援日期，不接受完整 timestamp |
| remind | true／false，取消期限前 3 天提醒 |
| note | 住宿短筆記；頂層 notes 建議填 null，避免重複 |

目前沒有專屬欄位：最晚入住、付款日期／自動扣款日期、預估匯率調整、稅費拆分、住宿參照第二組編號、門禁密碼、每間房的住客名單。必要的自助入住方式、精確取消時間與時區、扣款待確認，可用短筆記；不是把整份核對報告塞進 note。

入住／退房的關聯 ID、晚數、每晚均價由 App 處理，不要讓 AI 生成 checkoutId、linkedStayId。

## 5. 門票 ticket

放在 `ticket` 物件內：

| 欄位 | 型別／選項 |
| --- | --- |
| name | 活動／景點名稱 |
| venue | 場館或入口字串 |
| date、time | `YYYY-MM-DD`、`HH:MM` |
| early | 提前幾分鐘到，非負數字；新增快捷選項 0／15／30／60 |
| kinds | 票種陣列，每筆為 `{label,price,quantity}` |
| kinds[].label | 票種名稱字串；新增預設成人／兒童，AI 可匯入其他明確票種 |
| kinds[].price | 單價數字；幣別由旅程 currency 決定 |
| kinds[].quantity | 非負整數，表單按鈕 0–99；手動新增至少合計 1 張 |
| pickup | qr 電子票 QR、counter 現場取票、voucher 兌換券 |
| place | 取票／兌換地點；counter／voucher 手動新增時需填 |
| reference | 訂單編號字串 |

票種單價與張數都有資料才可靠計算總價；不要把未知單價當免費。電子票圖檔或 PDF 需手動附檔，不是 JSON 中的檔案路徑。

## 6. 交通 transit

item 使用 `date、start、end、from、to、notes` 與 `routes` 陣列。

手動新增先填從哪裡、到哪裡、日期、最晚抵達時間；由主要路線的總分鐘數回推開始時間。AI JSON 則提供明確 start／end，不存在 arriveBy 這個匯入欄位。

每條路線：

| 欄位 | 格式 |
| --- | --- |
| name | 路線名稱 |
| primary | true 主要／false 備用；同時只有一條主要路線 |
| booking | none／ordered／confirmed／null，路線的訂票狀態 |
| pay | 付款方式自由文字，如 IC 卡、現金、信用卡 |
| legs | 路段陣列，可混合步行、電車等轉乘 |
| legs[].mode | 下表的九種代碼 |
| legs[].label | 路段說明／方向字串 |
| legs[].minutes | 分鐘數字，新增路段需大於 0 |
| legs[].fare | 非負費用數字；不寫貨幣符號，使用旅程幣別 |
| legs[].place | 上車地點／月台字串 |
| departures | 班次陣列：`{dep:"HH:MM",arr:"HH:MM",info:"說明"}` |

| mode | 畫面意思 |
| --- | --- |
| walk | 步行 |
| train | 電車／鐵路 |
| subway | 地鐵 |
| bus | 巴士 |
| tram | 路面電車 |
| car | 計程車／汽車路段 |
| ferry | 渡輪 |
| rental | 租車路段 |
| plane | 飛機路段 |

總分鐘、總費用、步行前置時間、轉乘次數由路段計算。交通表單可新增／刪除路段、備用路線與切換主要；班次可在儲存後加。

注意：交通 minutes／fare 的 null 目前會落為底層 0，沒有完整的未知數值標示；資料不足應先補查，不要讓 AI 虛構 0 分鐘或免費。跨午夜班次沒有獨立 arrivalDate；不要以同日 HH:MM 硬塞造成誤判。

路線詳細頁可手動保存業者、預約編號、電話、取消規則等 r.ticket 與 noBookNote，但目前 AI routes parser 不匯入這兩組欄位；提示詞不可承諾保存它們。必要時摘要於 item.notes。

## 7. 租車 car／餐廳 restaurant／景點 place／其他 other

使用第 2 節共通欄位，沒有 rental、restaurant 或 sightseeing 專屬巢狀物件。

- 租車：date／start 放取車，place 放取車地址，from／to 放取還車門市與地址；跨日還車 end 填 null，還車完整日期時間放短筆記。price 為同筆預約總價，ETC 附加服務不要另建重複訂單。
- 餐廳：名稱、日期時間、訂位代號、費用、地址與筆記；用餐人數、套餐、桌位需求目前沒有獨立欄位，有明確需要才簡記於 notes。
- 景點：名稱、日期時間、地址、開放時間、網站、標籤與筆記。想看清單可手動維護，但不能靠 AI items.watch 匯入。
- 其他：相同通用欄位；不要用未知 type 代碼替代。

## 8. 可手動填但目前不支援 AI JSON 的項目

- 備案 alts：目前新增 UI 可填名稱與訂購狀態，能調順序／刪除；資料模型雖有備註、取消期限，不代表表單已完整提供輸入。AI importer 不讀 alts。
- 景點想看清單 watch／建議停留 stay：部分畫面可用，不代表 importer 接受。
- 照片／PDF／QR 截圖：App 可手動附檔並儲存在裝置 IndexedDB，但 App 不替外部 AI 讀信箱／解析 PDF；JSON 無法附帶本機檔案路徑。
- App 自行產生 id、tripId、order、imported、missingFields、checkoutId、linkedStayId 等；不用 AI 產生。
- 證件、費用帳本、準備清單、備份與設定屬其他功能，不在目前 items 匯入格式。

## 9. 筆記、來源與 PDF 的規則

1. 一般用 notes，住宿用 hotel.note，預設最多三個短項；沒有額外提醒填 null，不湊滿。
2. 不重複專屬欄位、不放全文條款、搜尋過程或 PDF 檔名。不硬截斷必要限制。
3. root.review 每筆 `{itemTitle,kind,detail,source}`，kind=source／missing／conflict／excluded；只供外部 AI 對話核對，App 不顯示。
4. 已取消排除、同一有效訂位採最新版本；確認訂單與付款狀態分開。
5. Gmail 讀不到機票 PDF 且座位等仍缺漏，先請使用者把原始 PDF 上傳同一 AI 對話；讀完才產生 JSON。真的未載明則 null，不推測。
6. Notion 個人安排不是已購票／已訂位證據。只有 Notion 引述的附件資訊要保留其未核驗性質。
7. 不要產生 UI／parser 不支援的欄位後假裝資料已保存；上述限制須一併提供給優化提示詞的 AI。

## 10. 完整欄位骨架

八種類型骨架與 App「複製提示詞」共用 `src/lib/importPrompt.ts` 來源；使用方式與限制見[提示詞架構](import-prompt-framework.md)。骨架不是真實資料，日期／名稱需依來源填寫，交通路段缺少必要數字時不能直接匯入。

以下從目前 importPrompt 的 IMPORT_SCHEMA 直接擷取，是欄位範例，不是訂單。請選用實際類型，替換 YYYY-MM-DD、HH:MM 與示範資料；不要照抄成旅程事實。完整 App 提示詞另見 [範例](handoff-assets/concise-import-notes/prompt-example.txt)。

```json
{
  "version": 2,
  "items": [
    {
      "type": "flight",
      "title": "航段名稱",
      "date": "YYYY-MM-DD",
      "start": "HH:MM",
      "end": "HH:MM",
      "booking": null,
      "orderNumber": null,
      "price": null,
      "notes": null,
      "flight": {
        "airline": null,
        "flightNo": null,
        "from": null,
        "fromTerminal": null,
        "departureDate": "YYYY-MM-DD",
        "departureTime": "HH:MM",
        "departureZone": null,
        "to": null,
        "toTerminal": null,
        "arrivalDate": "YYYY-MM-DD",
        "arrivalTime": "HH:MM",
        "arrivalZone": null,
        "reference": null,
        "seat": null,
        "cabin": null,
        "bags": null,
        "bagKg": null,
        "carryKg": null,
        "checkinMinutes": null,
        "remind": null,
        "price": null,
        "rules": null
      }
    },
    {
      "type": "hotel",
      "title": "住宿名稱",
      "booking": null,
      "notes": null,
      "hotel": {
        "name": "住宿名稱",
        "checkinDate": "YYYY-MM-DD",
        "checkoutDate": "YYYY-MM-DD",
        "checkinTime": null,
        "checkoutTime": null,
        "address": null,
        "phone": null,
        "reference": null,
        "room": null,
        "guests": null,
        "breakfast": null,
        "total": null,
        "payment": null,
        "cancelBy": null,
        "remind": null,
        "note": null
      }
    },
    {
      "type": "transit",
      "title": "出發地 → 目的地",
      "date": "YYYY-MM-DD",
      "start": null,
      "end": null,
      "from": null,
      "to": null,
      "place": null,
      "booking": null,
      "orderNumber": null,
      "price": null,
      "notes": null,
      "routes": [
        {
          "name": "路線名稱",
          "primary": true,
          "booking": null,
          "pay": null,
          "legs": [
            {
              "mode": "train",
              "label": "路段說明",
              "minutes": null,
              "fare": null,
              "place": null
            }
          ],
          "departures": [
            {
              "dep": "HH:MM",
              "arr": "HH:MM",
              "info": null
            }
          ]
        }
      ]
    },
    {
      "type": "ticket",
      "title": "活動名稱",
      "booking": null,
      "price": null,
      "notes": null,
      "ticket": {
        "name": "活動名稱",
        "venue": null,
        "date": "YYYY-MM-DD",
        "time": null,
        "early": null,
        "kinds": [
          {
            "label": "票種名稱",
            "price": null,
            "quantity": null
          }
        ],
        "pickup": null,
        "place": null,
        "reference": null
      }
    },
    {
      "type": "restaurant",
      "title": "餐廳名稱",
      "date": "YYYY-MM-DD",
      "start": null,
      "end": null,
      "booking": null,
      "orderNumber": null,
      "price": null,
      "place": null,
      "cancelBefore": null,
      "cancelRemind": null,
      "notes": null
    },
    {
      "type": "place",
      "title": "景點名稱",
      "date": "YYYY-MM-DD",
      "start": null,
      "end": null,
      "booking": null,
      "orderNumber": null,
      "price": null,
      "place": null,
      "hours": null,
      "url": null,
      "tags": [],
      "notes": null
    },
    {
      "type": "car",
      "title": "租車名稱",
      "date": "YYYY-MM-DD",
      "start": "HH:MM",
      "end": null,
      "booking": null,
      "orderNumber": null,
      "price": null,
      "place": null,
      "from": null,
      "to": null,
      "cancelBefore": null,
      "cancelRemind": null,
      "notes": null
    },
    {
      "type": "other",
      "title": "行程名稱",
      "date": "YYYY-MM-DD",
      "start": null,
      "end": null,
      "booking": null,
      "orderNumber": null,
      "price": null,
      "place": null,
      "notes": null
    }
  ],
  "review": []
}
```
