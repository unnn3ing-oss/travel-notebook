import type { Item, Route, Task, Trip } from './types';

export function seedKyoto(): { trip: Trip; items: Item[]; routes: Route[]; tasks: Task[] } {
  const tripId = 'kyoto';
  const trip: Trip = { id: tripId, name: '京都 5 日', start: '2026-11-20', end: '2026-11-24', people: 2, currency: 'JPY' };
  const it = (id: string, date: string | null, start: string, end: string, title: string, type: Item['type'], extra: Partial<Item> = {}): Item =>
    ({ id, tripId, date, start, end, title, type, ...extra });
  const items: Item[] = [
    it('a1', '2026-11-20', '06:00', '09:30', '去程 TPE → KIX', 'flight', { booking: 'confirmed', note: 'CI 156' }),
    it('a2', '2026-11-20', '10:30', '11:45', '關西機場 → 京都車站', 'transit', { from: '關西機場', to: '京都車站', booking: 'none' }),
    it('a3', '2026-11-20', '15:00', '16:00', '京都車站飯店入住', 'hotel', { booking: 'confirmed', alts: [{ name: 'Hotel B 烏丸', status: 'confirmed', note: '11/18 前可免費取消' }, { name: '河原町民宿', status: 'none' }] }),
    it('b1', '2026-11-21', '07:00', '09:30', '清水寺', 'place', { watch: [{ text: '清水舞台', done: true }, { text: '音羽之瀧', done: false }], note: '清晨人少，舞台要往右走才拍得到全景。' }),
    it('b2', '2026-11-21', '09:50', '10:30', '清水寺 → 二年坂', 'transit', { from: '清水寺', to: '二年坂' }),
    it('b3', '2026-11-21', '10:30', '12:40', '二年坂・產寧坂', 'place'),
    it('b4', '2026-11-21', '12:50', '13:40', '午餐　祇園割烹', 'restaurant', { booking: 'confirmed' }),
    it('b5', '2026-11-21', '13:40', '14:50', '京都車站 → 嵯峨嵐山', 'transit', { from: '京都車站', to: '嵯峨嵐山站' }),
    it('b6', '2026-11-21', '15:00', '15:30', '嵐山小火車', 'ticket', { booking: 'none', alts: [{ name: '保津川遊船', status: 'none' }, { name: '嵐山竹林小徑散步', status: 'none', note: '不用預約' }] }),
    it('c1', '2026-11-22', '07:00', '09:00', '伏見稻荷大社', 'place', { watch: [{ text: '千本鳥居', done: false }, { text: '稻荷山頂', done: false }, { text: '狐狸繪馬', done: false }], note: '清晨人少比較好拍照，記得帶零錢買繪馬。' }),
    it('e1', '2026-11-24', '11:00', '11:30', '退房', 'hotel'),
    it('e2', '2026-11-24', '16:30', '20:00', '回程 KIX → TPE', 'flight', { booking: 'confirmed' }),
    it('p1', null, '', '', '錦市場', 'restaurant', { note: '下午 5 點前去，很多店早收' }),
    it('p2', null, '', '', '哲學之道', 'place'),
    it('p3', null, '', '', '金閣寺', 'place'),
  ];
  const routes: Route[] = [
    { id: 'r-walk', itemId: 'b2', name: '步行', mode: 'walk', minutes: 12, walk: 0, place: '', legs: [{ mode: 'walk', label: '步行經松原通', minutes: 12 }], departures: [], fare: 0, primary: true },
    { id: 'r-jr', itemId: 'b5', name: 'JR 嵯峨野線', mode: 'train', minutes: 25, walk: 5, place: '32 號月台',
      legs: [{ mode: 'walk', label: '步行到 JR 京都站 32 號月台', minutes: 5 }, { mode: 'train', label: 'JR 嵯峨野線，往園部', minutes: 16 }, { mode: 'walk', label: '步行出站', minutes: 3 }],
      departures: [{ dep: '13:42', arr: '13:58', info: '普通車，32 號月台' }, { dep: '13:52', arr: '14:08', info: '普通車，32 號月台' }, { dep: '14:07', arr: '14:23', info: '快速，32 號月台' }, { dep: '14:38', arr: '14:54', info: '普通車，33 號月台' }],
      fare: 240, primary: true },
    { id: 'r-taxi', itemId: 'b5', name: '預約計程車', mode: 'car', minutes: 30, walk: 0, place: '八條口上車處',
      legs: [{ mode: 'car', label: '京都車站八條口上車', minutes: 0 }, { mode: 'car', label: '經國道 9 號往嵐山', minutes: 30 }],
      departures: [{ dep: '13:45', arr: '14:15', info: '訂單確認，八條口上車' }], fare: 4500, booking: 'confirmed', primary: false },
    { id: 'r-bus', itemId: 'b5', name: '市巴士 28 號', mode: 'bus', minutes: 50, walk: 4, place: 'D3 巴士站',
      legs: [{ mode: 'walk', label: '步行到 D3 巴士站', minutes: 4 }, { mode: 'bus', label: '市巴士 28 號，往大覺寺', minutes: 42 }, { mode: 'walk', label: '步行到嵯峨嵐山站', minutes: 6 }],
      departures: [{ dep: '13:50', arr: '14:42', info: 'D3 站，約每 15 分鐘一班' }, { dep: '14:05', arr: '14:57', info: 'D3 站' }], fare: 230, primary: false },
    { id: 'r-haruka', itemId: 'a2', name: 'Haruka 機場快線', mode: 'train', minutes: 75, walk: 10, place: '關西機場站',
      legs: [{ mode: 'walk', label: '步行到關西機場站', minutes: 10 }, { mode: 'train', label: 'Haruka，往京都', minutes: 75 }],
      departures: [{ dep: '10:46', arr: '12:01', info: '指定席' }, { dep: '11:16', arr: '12:31', info: '指定席' }], fare: 2200, booking: 'none', primary: true },
  ];
  const task = (id: string, group: string, title: string, daysBefore: number, done = false): Task => ({ id, tripId, group, title, daysBefore, done });
  const tasks: Task[] = [
    task('t1', '證件', '護照效期確認', 30, true),
    task('t2', '證件', '登錄 Visit Japan Web', 3),
    task('t3', '交通', '訂 Haruka 機場快線', 12),
    task('t4', '金錢', '信用卡開通海外刷卡', 7, true),
    task('t5', '金錢', '換日圓現金', 5),
    task('t6', '通訊', '買日本 eSIM', 2),
    task('t7', '行李', '行動電源放隨身行李', 0),
    task('t8', '行李', '充電線與轉接頭', 0, true),
  ];
  return { trip, items, routes, tasks };
}
