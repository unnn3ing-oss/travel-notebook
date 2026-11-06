# 地標四時段背景：實作截圖（待確認）

對應 [任務交接](../../handoffs/2026-11-06-destination-day-period.md)。本機實作完成，尚未合併／部署。

- [four-periods.png](four-periods.png)：日本地標的早上、中午、下午與晚上實際元件總覽。
- [six-destinations.png](six-destinations.png)：六個目的地 × 四時段完整比較。
- 個別：[早上](morning.png)、[中午](noon.png)、[下午](afternoon.png)、[晚上](night.png)。

時間使用設備當地時鐘：06:00–10:59 早上、11:00–13:59 中午、14:00–17:59 下午、18:00–05:59 晚上。不是目的地時間，也不隨作業系統深淺色改變時段。開頁後每 30 秒檢查，回到前景／取得焦點／pageshow 即時更新；支援既有 ?now= 預覽。

圖片是 Chromium 真正渲染的元件，以模擬設備時鐘截取；比較圖將同一批實際 DOM 排列在審核頁，非 AI 重新生成。資料與旅程名均為示範。已檢查六國與中性背景、320／390／1280px、深淺色、減少動態偏好及文字對比（至少 4.5:1）；未測真實 iPhone／Safari。
