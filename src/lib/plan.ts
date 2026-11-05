import type { Item, Route } from '../types';
import { judgeDepartures, firstCatchable, leaveNote, type Judged } from './transit';
import { fmt, toMin } from './time';

/** Departures for a route. A walking route has no timetable: you leave at the card's start. */
export function departuresOf(route: Route, item: Item) {
  if (route.departures.length) return route.departures;
  const s = toMin(item.start);
  if (isNaN(s)) return [];
  return [{ dep: item.start, arr: fmt(s + route.minutes), info: route.name + ' ' + route.minutes + ' 分鐘' }];
}

export interface TransitPlan { route: Route; judged: Judged[]; pick: number; note: string; leave: string | null }

/** The primary route's departures judged against `now` (only meaningful on the trip day). */
export function planTransit(item: Item, routes: Route[], now: string, pickIndex?: number): TransitPlan | null {
  const route = routes.find((r) => r.primary) ?? routes[0];
  if (!route) return null;
  const walking = !route.departures.length;
  const judged = judgeDepartures({ now, walk: walking ? 0 : route.walk, arriveBy: item.end, departures: departuresOf(route, item) });
  const catchable = firstCatchable(judged);
  const pick = pickIndex ?? Math.max(catchable, 0);
  const j = judged[pick];
  const note = !j ? '' : walking
    ? route.name + ' ' + route.minutes + ' 分鐘，最好在 ' + j.leave + ' 就出發。'
    : leaveNote({ place: route.place, walk: route.walk, leave: j.leave, dep: j.dep });
  return { route, judged, pick, note, leave: catchable >= 0 ? judged[catchable].leave : null };
}
