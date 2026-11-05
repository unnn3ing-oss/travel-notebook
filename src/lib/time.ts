/** "HH:MM" → minutes after midnight. Returns NaN for anything else. */
export function toMin(t: string | null | undefined): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t ?? '').trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}

/** minutes after midnight → "HH:MM" */
export function fmt(min: number): string {
  const n = ((Math.round(min) % 1440) + 1440) % 1440;
  return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
}

/** Date → "YYYY-MM-DD" in the device's local time. */
export function isoDate(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function parseIsoDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, n: number): string {
  const d = parseIsoDate(iso);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

/** Whole calendar days from a to b (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseIsoDate(b).getTime() - parseIsoDate(a).getTime()) / 86400000);
}

const WEEK = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
export function weekday(iso: string): string {
  return WEEK[parseIsoDate(iso).getDay()];
}

/** "2026-11-21" → "11/21" */
export function md(iso: string): string {
  const d = parseIsoDate(iso);
  return d.getMonth() + 1 + '/' + String(d.getDate()).padStart(2, '0');
}
