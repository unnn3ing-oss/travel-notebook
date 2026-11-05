import type { Item } from '../types';
import { toMin } from './time';

/** Sort cards of one day by start time; cards without a time go last. */
export function byTime(a: Item, b: Item): number {
  const x = toMin(a.start), y = toMin(b.start);
  if (isNaN(x) && isNaN(y)) return 0;
  if (isNaN(x)) return 1;
  if (isNaN(y)) return -1;
  return x - y;
}

/** Split a day's cards around `now` (HH:MM): what's happening, what's next, the rest. */
export function splitDay(items: Item[], now: string) {
  const n = toMin(now);
  const sorted = items.filter((i) => !isNaN(toMin(i.start))).sort(byTime);
  const current = sorted.find((i) => toMin(i.start) <= n && n < toMin(i.end || i.start)) ?? null;
  const upcoming = sorted.filter((i) => i !== current && toMin(i.start) >= n);
  return { current, next: upcoming[0] ?? null, later: upcoming.slice(1), done: sorted.filter((i) => toMin(i.end || i.start) <= n && i !== current) };
}

/** Cards whose start overlaps the previous card's end. */
export function overlaps(items: Item[]): Set<string> {
  const s = items.filter((i) => !isNaN(toMin(i.start))).sort(byTime);
  const out = new Set<string>();
  for (let k = 1; k < s.length; k++) {
    const prevEnd = toMin(s[k - 1].end);
    if (!isNaN(prevEnd) && toMin(s[k].start) < prevEnd) out.add(s[k].id);
  }
  return out;
}
