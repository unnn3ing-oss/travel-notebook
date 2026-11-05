import type { ItemType, Trip } from '../types';

export interface ImportRow { title: string; date: string; start: string; end: string; type: ItemType; orderNumber: string; place: string; target: string | null; checked: boolean; flag: string }
export type ImportResult = { error: string } | { rows: ImportRow[]; skipped: number };

const TYPES = ['flight', 'train', 'hotel', 'ticket', 'restaurant', 'other'];

/** 給能讀信箱的 AI 用的提示詞 */
export function importPrompt(trip: Trip) {
  return ['請幫我整理一趟旅行的行程資料。', '',
    `1. 搜尋我信箱裡和這趟旅行有關的信：機票、訂房、車票、門票、餐廳訂位。旅行日期是 ${trip.start} 到 ${trip.end}，旅程名稱「${trip.name}」。`,
    '2. 每一筆訂單整理成一個項目。只用信裡寫的內容，查不到的欄位填 null，不要猜。',
    '3. 同一筆訂單有更改或取消信時，以最新的那封為準；已取消的不要列。',
    '4. 只回傳一個 JSON 程式碼區塊，不要加其他說明：', '', '```json',
    `{"version": 1, "items": [{"date": "${trip.start}", "start": "09:10", "end": null, "type": "flight", "title": "去程 TPE → KIX", "place": "關西機場", "orderNo": "訂位代號", "price": "金額與幣別", "notes": null}]}`,
    '```', '', 'type 只能填 flight、train、hotel、ticket、restaurant、other。date 用 YYYY-MM-DD，start 和 end 用 24 小時制 HH:MM。'].join('\n');
}

export function sampleResult(trip: Trip) {
  const d = (n: number) => { const x = new Date(trip.start + 'T00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  return '```json\n' + JSON.stringify({ version: 1, items: [
    { date: d(1), start: '15:00', type: 'ticket', title: '嵐山小火車', place: '嵯峨站', orderNo: '[訂單編號]' },
    { date: d(3), start: '10:00', type: 'ticket', title: '金閣寺參觀', place: '金閣寺', orderNo: null },
    { date: d(3), start: '18:00', type: 'restaurant', title: '晚餐　先斗町', place: '先斗町', orderNo: '[訂位代號]' },
  ] }, null, 2) + '\n```';
}

/** 解析 AI 貼回來的內容；existing = 每天已有的卡片名稱 */
export function parseImport(raw: string, days: string[], existing: Record<string, string[]>): ImportResult {
  let text = String(raw || '').trim();
  if (!text) return { error: '還沒有貼上內容。' };
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1];
  else { const a = text.indexOf('{'), b = text.lastIndexOf('}'); if (a >= 0 && b > a) text = text.slice(a, b + 1); }
  let obj: { items?: unknown };
  try { obj = JSON.parse(text); } catch { return { error: '看不懂這段內容。請 AI 照提示詞的格式只回傳 JSON，再貼一次。' }; }
  if (!obj || !Array.isArray(obj.items)) return { error: '內容裡找不到 items 清單，請確認是用這份提示詞產生的。' };
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const norm = (s: string) => s.replace(/\s/g, '');
  const rows: ImportRow[] = [];
  let skipped = 0;
  for (const it of (obj.items as Record<string, unknown>[]).slice(0, 100)) {
    const title = str(it?.title, 60);
    const date = str(it?.date, 10);
    if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { skipped++; continue; }
    const start = /^\d{2}:\d{2}$/.test(str(it.start, 5)) ? str(it.start, 5) : '';
    const end = /^\d{2}:\d{2}$/.test(str(it.end, 5)) ? str(it.end, 5) : '';
    let type = (TYPES.includes(it.type as string) ? it.type : 'other') as string;
    if (type === 'train') type = 'transit';
    const inTrip = days.includes(date);
    const dup = inTrip && (existing[date] ?? []).some((t) => norm(t) === norm(title));
    rows.push({ title, date, start, end, type: type as ItemType, orderNumber: str(it.orderNo, 40), place: str(it.place, 40), target: inTrip ? date : null, checked: !dup,
      flag: dup ? '這天已有同名卡片，預設不加入' : inTrip ? '' : '日期不在旅程內，會放到未排程' });
  }
  if (!rows.length) return { error: '沒有可以加入的項目：每一筆都要有 date 和 title。' };
  return { rows, skipped };
}
