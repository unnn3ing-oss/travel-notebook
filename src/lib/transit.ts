import { toMin, fmt } from './time';

export interface Departure { dep: string; arr: string; info: string }
export type DepKind = 'gone' | 'miss' | 'late' | 'hurry' | 'ok';
export interface Judged extends Departure { leave: string; slack: number; kind: DepKind; status: string }

/**
 * Decide, for each departure, whether you can still make it.
 * `walk` = minutes needed to reach the boarding place; `arriveBy` may be empty.
 */
export function judgeDepartures(o: { now: string; walk: number; arriveBy: string; departures: Departure[] }): Judged[] {
  const now = toMin(o.now);
  const deadline = toMin(o.arriveBy);
  return o.departures.map((d) => {
    const dep = toMin(d.dep);
    const leave = dep - o.walk;
    const slack = leave - now;
    let kind: DepKind;
    let status: string;
    if (dep < now) { kind = 'gone'; status = '已開走'; }
    else if (slack < 0) { kind = 'miss'; status = '走過去來不及'; }
    else if (!isNaN(deadline) && toMin(d.arr) > deadline) { kind = 'late'; status = d.arr + ' 才到，可能會太晚'; }
    else if (slack === 0) { kind = 'hurry'; status = '現在出發'; }
    else if (slack < 10) { kind = 'hurry'; status = '剩下 ' + slack + ' 分鐘，要抓準時間出發了！'; }
    else { kind = 'ok'; status = '還有 ' + slack + ' 分鐘可以準備出發了！'; }
    return { ...d, leave: fmt(leave), slack, kind, status };
  });
}

/** Index of the first departure you can still catch on time, or -1. */
export function firstCatchable(j: Judged[]): number {
  return j.findIndex((x) => x.kind === 'ok' || x.kind === 'hurry');
}

export function leaveNote(o: { place: string; walk: number; leave: string; dep: string }): string {
  if (!o.place) return '這條路線沒有填步行時間，請在 ' + o.dep + ' 前到站。';
  if (o.walk) return '前往 ' + o.place + '需要 ' + o.walk + ' 分鐘，最好在 ' + o.leave + ' 就出發。';
  return '最好在 ' + o.dep + ' 前到' + o.place + '。';
}
