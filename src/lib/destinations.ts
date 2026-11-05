import type { Item } from '../types';

export type Destination = 'japan' | 'korea' | 'taiwan' | 'singapore' | 'hongkong' | 'malaysia';
export const DESTINATIONS: Record<Destination, { name: string; landmarks: string }> = {
 japan: { name: '日本', landmarks: '富士山・櫻花' },
 korea: { name: '韓國', landmarks: '首爾塔・景福宮' },
 taiwan: { name: '台灣', landmarks: '台北 101' },
 singapore: { name: '新加坡', landmarks: '濱海灣・魚尾獅' },
 hongkong: { name: '香港', landmarks: '維多利亞港・帆船' },
 malaysia: { name: '馬來西亞', landmarks: '雙子星塔' },
};
const AIRPORTS: Record<string, Destination> = {};
for (const [destination, codes] of Object.entries({
 japan: 'NRT HND KIX ITM NGO FUK CTS OKA UKB HIJ SDJ KOJ KMJ TAK KMQ',
 korea: 'ICN GMP PUS CJU TAE CJJ',
 taiwan: 'TPE TSA KHH RMQ TNN HUN TTT MZG KNH',
 singapore: 'SIN XSP', hongkong: 'HKG', malaysia: 'KUL SZB PEN LGK BKI KCH JHB IPH',
})) for (const code of codes.split(' ')) AIRPORTS[code] = destination as Destination;

export function airportDestination(airport: string): Destination | undefined {
 const code = airport.trim().toUpperCase();
 return Object.hasOwn(AIRPORTS, code) ? AIRPORTS[code] : undefined;
}

/** Use the first dated arrival, not manual card order or the return flight. */
export function tripDestination(items: Item[], tripId: string): { airport: string; destination?: Destination } | undefined {
 const first = items.filter(i => i.tripId === tripId && i.type === 'flight')
  .map(item => ({ item, day: item.flight?.departureDate || item.date || item.originalDate || '', time: item.flight?.departureTime || item.start || '' }))
  .sort((a, b) => (a.day || '9999').localeCompare(b.day || '9999') || (a.time || '99:99').localeCompare(b.time || '99:99') || a.item.id.localeCompare(b.item.id))[0];
 if (!first) return;
 const airport = (first.item.flight?.to?.trim() || first.item.to?.trim() || '').toUpperCase();
 if (!airport) return;
 return { airport, destination: airportDestination(airport) };
}
