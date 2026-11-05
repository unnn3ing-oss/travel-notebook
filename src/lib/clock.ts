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

export function useClock(): Clock {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 20_000);
    return () => clearInterval(t);
  }, []);
  const o = readOverride();
  const d = o ?? new Date();
  return { date: isoDate(d), time: fmt(d.getHours() * 60 + d.getMinutes()), simulated: !!o };
}
