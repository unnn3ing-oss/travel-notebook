import type { Item } from '../types';

export interface ImportMatch { id: string; title: string; date: string; reason: string; revision: string }
const normalized = (s?: string) => (s || '').normalize('NFKC').replace(/\s/g, '').toUpperCase();
const name = (i: Partial<Item>) => normalized(i.hotel?.name || i.title).replace(i.type === 'hotel' ? /(?:入住|退房)$/ : /$^/, '');
const day = (i: Partial<Item>) => i.flight?.departureDate || i.hotel?.checkinDate || i.ticket?.date || i.date || i.originalDate || '';
const reference = (i: Partial<Item>) => normalized(i.flight?.reference || i.hotel?.reference || i.ticket?.reference || i.orderNumber);
const flightNo = (i: Partial<Item>) => normalized(i.flight?.airline) + ':' + normalized(i.flight?.flightNo).replace(/^0+(?=\d)/, '');

/** A shared reservation alone never identifies a flight leg. */
export function sameImportedEntry(a: Partial<Item>, b: Partial<Item>): boolean {
  if (a.type !== b.type || a.linkedStayId || b.linkedStayId) return false;
  const ar = reference(a), br = reference(b);
  if (ar && br && ar !== br) return false;
  if (ar && ar === br) {
    if (a.type !== 'flight') return true;
    const af = normalized(a.flight?.from || a.from), at = normalized(a.flight?.to || a.to), bf = normalized(b.flight?.from || b.from), bt = normalized(b.flight?.to || b.to);
    if ((af && bf && af !== bf) || (at && bt && at !== bt)) return false;
    if (af && at && bf && bt) return af === bf && at === bt;
    if (a.flight?.flightNo && b.flight?.flightNo) return flightNo(a) === flightNo(b) && !!day(a) && day(a) === day(b);
    return !!day(a) && day(a) === day(b) && !!name(a) && name(a) === name(b);
  }
  if (!day(a) || day(a) !== day(b) || !name(a) || name(a) !== name(b)) return false;
  if (a.type === 'flight') {
    if (a.flight?.flightNo && b.flight?.flightNo && flightNo(a) !== flightNo(b)) return false;
    for (const key of ['from', 'to'] as const) if (a.flight?.[key] && b.flight?.[key] && normalized(a.flight[key]) !== normalized(b.flight[key])) return false;
  }
  return true;
}
export function importMatches(fields: Partial<Item>, existing: Item[]): ImportMatch[] {
  return existing.filter(i => sameImportedEntry(fields, i)).map(i => ({ id: i.id, title: i.title, date: day(i), reason: reference(fields) && reference(fields) === reference(i) ? '相同訂單編號' : '同日、同類型、同名稱', revision: JSON.stringify(i) }));
}
