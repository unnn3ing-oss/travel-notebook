import type { Leg, LegTime, Route } from '../types';
import { fmt, toMin } from './time';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** 這一段所有班次（主班次＋備案），依發車時間排序。沒有填完整時間的不列入。 */
export function legOptions(leg: Leg): LegTime[] {
  const all: LegTime[] = [];
  if (leg.dep && leg.arr) all.push({ dep: leg.dep, arr: leg.arr });
  for (const a of leg.alts ?? []) if (a.dep && a.arr) all.push(a);
  return all.sort((a, b) => toMin(a.dep) - toMin(b.dep));
}

export const hasLegTimes = (route: Route) => route.legs.some((l) => legOptions(l).length > 0);

/** 兩個時間都填且抵達晚於發車時，分鐘數＝抵達－發車；否則回傳 undefined。 */
export function minutesBetween(dep?: string, arr?: string): number | undefined {
  if (!dep || !arr) return undefined;
  const m = toMin(arr) - toMin(dep);
  return Number.isFinite(m) && m > 0 ? m : undefined;
}

function pairError(dep: string | undefined, arr: string | undefined, name: string): string {
  if (!dep && !arr) return '';
  if (!dep || !arr) return name + '請同時填發車與抵達時間。';
  if (!TIME.test(dep) || !TIME.test(arr)) return name + '請確認時間格式。';
  if (toMin(arr) <= toMin(dep)) return name + '抵達時間要晚於發車時間（不支援跨午夜）。';
  return '';
}

/** 回傳第一個錯誤訊息；沒問題回傳空字串。 */
export function legTimesError(leg: Leg): string {
  const main = pairError(leg.dep, leg.arr, '');
  if (main) return main;
  for (const [k, a] of (leg.alts ?? []).entries()) {
    const e = pairError(a.dep, a.arr, '備案 ' + (k + 1) + '：');
    if (e) return e;
    if (!a.dep) return '備案 ' + (k + 1) + '：請填發車與抵達時間。';
  }
  return '';
}

/**
 * 從「第一段搭乘」的每個班次往後模擬各段，算出最後抵達時間。
 * 後面某段有時刻就搭不早於前段抵達的最早一班，沒有時刻就累加分鐘數；接不上的班次不列入。
 * 第一段搭乘沒有填時間時回傳 null，由呼叫端保留原本手動加的班次。
 */
export function deriveDepartures(route: Route): Route['departures'] | null {
  const first = route.legs.findIndex((l) => l.mode !== 'walk');
  if (first < 0) return null;
  const start = legOptions(route.legs[first]);
  if (!start.length) return null;
  const out: Route['departures'] = [];
  for (const s of start) {
    let t = toMin(s.arr);
    let ok = true;
    for (const next of route.legs.slice(first + 1)) {
      const options = legOptions(next);
      if (!options.length) { t += next.minutes; continue; }
      const pick = options.find((o) => toMin(o.dep) >= t);
      if (!pick) { ok = false; break; }
      t = toMin(pick.arr);
    }
    if (ok && t < 1440) out.push({ dep: s.dep, arr: fmt(t), info: [route.legs[first].label, s.info].filter(Boolean).join('，') });
  }
  return out;
}

/** 有各段時間就以它重算路線層級班次，否則原樣回傳。 */
export function withDerivedDepartures(route: Route): Route {
  const departures = deriveDepartures(route);
  return departures ? { ...route, departures } : route;
}
