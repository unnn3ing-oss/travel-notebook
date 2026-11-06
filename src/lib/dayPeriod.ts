import { useEffect, useState } from 'react';
import { readOverride } from './clock';

export type DayPeriod = 'morning' | 'noon' | 'afternoon' | 'night';
export const DAY_PERIOD_LABEL: Record<DayPeriod, string> = { morning:'早上', noon:'中午', afternoon:'下午', night:'晚上' };

/** The device's wall clock, deliberately independent of the trip timezone. */
export function dayPeriodAt(date: Date): DayPeriod {
 const hour = date.getHours();
 return hour < 6 || hour >= 18 ? 'night' : hour < 11 ? 'morning' : hour < 14 ? 'noon' : 'afternoon';
}
function currentPeriod(): DayPeriod {
 const preview = typeof window === 'undefined' ? null : readOverride();
 return dayPeriodAt(preview ?? new Date());
}
export function useDeviceDayPeriod(): DayPeriod {
 const [period, setPeriod] = useState(currentPeriod);
 useEffect(() => {
  const refresh = () => setPeriod(currentPeriod());
  const interval = window.setInterval(refresh, 30_000);
  window.addEventListener('focus', refresh);
  window.addEventListener('pageshow', refresh);
  document.addEventListener('visibilitychange', refresh);
  return () => {
   window.clearInterval(interval);
   window.removeEventListener('focus', refresh);
   window.removeEventListener('pageshow', refresh);
   document.removeEventListener('visibilitychange', refresh);
  };
 }, []);
 return period;
}
