import type { Item, Route } from '../types';
import { departuresOf } from './plan';
import { addDays, fmt, md, toMin } from './time';

export interface Rules { lead: number; transitOn: boolean; cancelLead: number; off: string[] }
export const DEFAULT_RULES: Rules = { lead: 30, transitOn: true, cancelLead: 2, off: [] };
export interface Reminder { id: string; date: string; time: string; text: string; why: string; kind: 'transit' | 'item' | 'cancel'; warn?: boolean }

const TYPE: Record<string, string> = { flight: '航班', hotel: '住宿', restaurant: '餐廳', ticket: '門票', place: '景點', transit: '交通', car: '租車', other: '行程' };
const leadText = (m: number) => (m >= 60 && m % 60 === 0 ? m / 60 + ' 小時' : m + ' 分鐘');

/** 依行程、交通、預訂排出提醒（由早到晚） */
export function buildReminders(items: Item[], routes: Route[], rules: Rules, from: string): Reminder[] {
  const out: Reminder[] = [];
  for (const i of items) {
    if (i.date && i.start) {
      if (i.type === 'transit') {
        const rs = routes.filter((r) => r.itemId === i.id);
        const r = rs.find((x) => x.primary) ?? rs[0];
        if (r) {
          const deps = departuresOf(r, i);
          const d = deps.find((x) => x.dep >= i.start) ?? deps[0];
          if (d) {
            const walking = !r.departures.length;
            const leave = fmt(toMin(d.dep) - (walking ? 0 : r.walk));
            out.push({ id: 't-' + i.id, date: i.date, time: leave, kind: 'transit',
              text: walking ? '出發去' + (i.to || i.title) : '出發去搭 ' + r.name + (i.to ? ' 往' + i.to : ''),
              why: walking ? '交通：' + r.name + ' ' + r.minutes + ' 分鐘，' + i.end + ' 要到'
                : '交通：' + (r.place && r.walk ? '前往' + r.place + '需要 ' + r.walk + ' 分鐘，' : '') + '搭 ' + d.dep + ' 那班' });
          }
        }
      } else {
        const t = toMin(i.start) - rules.lead;
        const none = i.booking === 'none';
        out.push({ id: 'i-' + i.id, date: t < 0 ? addDays(i.date, -1) : i.date, time: fmt((t + 1440) % 1440), kind: 'item', warn: none,
          text: i.title + ' ' + i.start,
          why: none ? TYPE[i.type] + '：還沒訂' + (i.alts?.length ? '，有 ' + i.alts.length + ' 個備案' : '') : '行程開始前 ' + leadText(rules.lead) });
      }
    }
    if (i.cancelBefore && /^\d{4}-\d{2}-\d{2}$/.test(i.cancelBefore)) {
      out.push({ id: 'c-' + i.id, date: addDays(i.cancelBefore, -rules.cancelLead), time: '09:00', kind: 'cancel',
        text: i.title + ' 免費取消到 ' + md(i.cancelBefore), why: '預訂的免費取消期限前 ' + rules.cancelLead + ' 天' });
    }
  }
  return out.filter((r) => r.date >= from).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

export const isOn = (r: Reminder, rules: Rules) => !rules.off.includes(r.id) && !(r.kind === 'transit' && !rules.transitOn);

/** 安靜時段 23:00 – 06:00 */
export const quiet = (time: string) => time >= '23:00' || time < '06:00';

export function loadRules(): Rules {
  try { return { ...DEFAULT_RULES, ...JSON.parse(localStorage.getItem('travel-reminder-rules') || '{}') }; } catch { return DEFAULT_RULES; }
}
export function saveRules(r: Rules) { try { localStorage.setItem('travel-reminder-rules', JSON.stringify(r)); } catch { /* 無痕模式存不了就算了 */ } }
