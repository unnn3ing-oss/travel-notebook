# 行程卡片與目的地頁首

對應 [任務交接](../../handoffs/2026-11-06-itinerary-art-destinations.md)。**使用者已確認視覺提案並授權開始實作；實作截圖仍待確認，程式尚未合併／部署。**

## 已確認的視覺提案

- [卡片提案](approved-designs/cards.png)：航班保留飛機與雲，其他圖案縮小約一半，只作點綴。
- [地標提案](approved-designs/destinations.png)：日本、韓國、台灣、新加坡、香港、馬來西亞的目的地地標。

這兩張為 AI 生成的概念圖，日期、航班、地標比例等僅為視覺示範，不是實際資料或額外指令。

## 實際程式截圖（待確認）

- [手機首屏](screenshots/mobile-top.png)、[完整清單](screenshots/list-japan.png)、[退房／門票／租車／其他](screenshots/list-other-types.png)
- [六款地標總覽](screenshots/six-destinations.png)：將真實元件渲染的 DOM 排列在同一審核頁截圖，非重新生成的概念圖。
- [日本](screenshots/header-japan.png)、[韓國](screenshots/header-korea.png)、[台灣](screenshots/header-taiwan.png)、[新加坡](screenshots/header-singapore.png)、[香港](screenshots/header-hongkong.png)、[馬來西亞](screenshots/header-malaysia.png)、[中性頁首](screenshots/header-neutral.png)
- [深色清單](screenshots/list-dark.png)、[時間軸](screenshots/timeline.png)、[桌機](screenshots/desktop.png)、[320px 長標題](screenshots/narrow-long-title.png)

示範資料含虛構訂位代號 DEMO-ART，沒有使用者真實信件或訂單。Chromium 檢查包含 320px／390px／1280px 深淺色、清單／時間軸、點卡查看、手機長按重排、桌機原生拖曳與空旅程。長截圖會使用延長視窗高度讓工具列出現在圖片底部，不讓固定導覽擋住中段內容；另保留 390×844 的首屏截圖。沒有宣稱真實 iPhone／Safari 已驗證。
