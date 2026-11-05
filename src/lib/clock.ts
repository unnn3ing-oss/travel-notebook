import { useEffect, useState } from 'react';
import { isoDate, fmt } from './time';

/**
 * The time the app reasons with. `?now=2026-11-21T13:44` in the URL pins it,
 * so a trip day can be tried out before the trip.
 */
export function readOverride(): Date | null {
  const q = new URLSearchParams(location.search).get('now');
  if (!q) return null;
  const d = new Date(q);
  return isNaN(d.getTime()) ? null : d;
}

export interface Clock { date: string; time: string; simulated: boolean }

export function useClock(timezone?: string): Clock {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 20_000);
    return () => clearInterval(t);
  }, []);
  const o = readOverride();
  const d = o ?? new Date();
  if (timezone && !o) {
    const parts = new Intl.DateTimeFormat('en-CA', {timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d);
    const part = (type:string) => parts.find(p=>p.type===type)!.value;
    return {date:`${part('year')}-${part('month')}-${part('day')}`,time:`${part('hour')}:${part('minute')}`,simulated:false};
  }
  return { date: isoDate(d), time: fmt(d.getHours() * 60 + d.getMinutes()), simulated: !!o };
}
