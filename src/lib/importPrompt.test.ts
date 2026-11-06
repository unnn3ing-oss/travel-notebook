import { describe, expect, it } from 'vitest';
import { IMPORT_SCHEMA, importPrompt } from './importPrompt';
import { materializeImport, parseImport } from './importer';
import type { Trip } from '../types';

const trip: Trip = { id: 'framework-demo', name: '示範日本旅行', start: '2026-11-20', end: '2026-11-24', timezone: 'Asia/Tokyo', currency: 'JPY', people: 2 };

describe('copy prompt field contract', () => {
  it('embeds current trip context and one JSON catalog covering all eight import types', () => {
    const prompt = importPrompt(trip);
    const fences = [...prompt.matchAll(/```json\n([\s\S]*?)\n```/g)];
    expect(fences).toHaveLength(1);
    expect(JSON.parse(fences[0][1])).toEqual(IMPORT_SCHEMA);
    expect(IMPORT_SCHEMA.items.map(item => item.type).sort()).toEqual(['car', 'flight', 'hotel', 'other', 'place', 'restaurant', 'ticket', 'transit']);
    for (const value of [trip.name, trip.start, trip.end, trip.timezone!, trip.currency, '"people": 2']) expect(prompt).toContain(value);
    expect(importPrompt({ ...trip, timezone: undefined })).toContain('"timezone": null');
    expect(IMPORT_SCHEMA.items.every(item => item.booking === null)).toBe(true);
  });

  it('materializes all eight documented types without mixing review into cards', () => {
    const result = parseImport(JSON.stringify({ version: 2, items: [
      { type: 'flight', title: '示範航班', booking: 'confirmed', flight: { airline: 'CI', flightNo: '0100', from: 'TPE', fromTerminal: 'T2', departureDate: trip.start, departureTime: '06:50', departureZone: 'Asia/Taipei', to: 'NRT', toTerminal: 'T1', arrivalDate: trip.start, arrivalTime: '10:55', arrivalZone: 'Asia/Tokyo', reference: 'DEMO-FLIGHT', seat: '12A、12B', cabin: 'economy', bags: 1, bagKg: 23, carryKg: 7, checkinMinutes: 60, remind: false } },
      { type: 'hotel', title: '示範旅宿', notes: null, hotel: { name: '示範旅宿', checkinDate: trip.start, checkoutDate: '2026-11-21', checkinTime: '15:00', checkoutTime: '11:00', address: '示範町1番地', phone: '+81-DEMO', reference: 'DEMO-HOTEL', room: '禁菸雙人房', guests: 2, breakfast: false, total: 'JPY 8,000', payment: 'later', cancelBy: '2026-11-17', remind: false, note: '• 晚到先聯絡櫃台。' } },
      { type: 'transit', title: '示範轉乘', date: trip.start, start: '12:00', routes: [{ name: '主要地鐵路線', primary: true, pay: '交通卡', legs: [{ mode: 'walk', label: '到車站', minutes: 5, fare: 0 }, { mode: 'subway', label: '到旅宿', minutes: 20, fare: 240, place: '2 號月台' }], departures: [{ dep: '12:05', arr: '12:25', info: '示範班次' }] }, { name: '備用巴士', primary: false, legs: [{ mode: 'bus', label: '巴士直達', minutes: 35, fare: 300 }] }] },
      { type: 'ticket', title: '示範展覽', ticket: { name: '示範展覽', venue: '示範展館', date: '2026-11-21', time: '10:00', early: 15, kinds: [{ label: '成人', price: 500, quantity: 2 }], pickup: 'counter', place: '展館售票櫃台', reference: 'DEMO-TICKET' } },
      { type: 'restaurant', title: '示範餐廳', date: trip.start, start: '18:00', place: '示範町2番地', orderNumber: 'DEMO-MEAL', booking: 'confirmed', cancelBefore: '2026-11-18', cancelRemind: false, notes: '• 預約兩人，遲到先致電。' },
      { type: 'place', title: '示範公園', date: '2026-11-21', place: '示範町3番地', hours: '09:00–17:00', url: 'https://example.com/park', tags: ['想去'], booking: null },
      { type: 'car', title: '示範租車', date: '2026-11-21', start: '14:00', end: null, place: '示範取車地址', from: 'A 門市', to: 'B 門市（示範還車地址）', price: 'JPY 12,000', orderNumber: 'DEMO-CAR', notes: '• 11/22 16:00 在 B 門市還車。' },
      { type: 'other', title: '示範集合', date: trip.start, start: '05:00', place: '示範集合處', notes: '• 出發前確認同行人到齊。' },
    ], review: [{ itemTitle: '示範航班', kind: 'source', detail: '只供對話核對', source: 'demo-flight.pdf' }] }), [trip.start, '2026-11-21', '2026-11-22', '2026-11-23', trip.end], {});
    if ('error' in result) throw new Error(result.error);
    expect(result.skipped).toBe(0);
    expect(result.rows).toHaveLength(8);
    let id = 0;
    const bundle = materializeImport(result.rows, trip, () => `demo-${++id}`);
    expect(bundle.items).toHaveLength(9);
    expect(bundle.items[0].flight).toMatchObject({ flightNo: '0100', fromTerminal: 'T2', toTerminal: 'T1', seat: '12A、12B', remind: false });
    expect(bundle.items[1].hotel).toMatchObject({ address: '示範町1番地', breakfast: false, payment: 'later', remind: false });
    expect(bundle.items[2]).toMatchObject({ linkedStayId: bundle.items[1].id, date: '2026-11-21', start: '11:00' });
    expect(bundle.routes).toHaveLength(2);
    expect(bundle.routes[0]).toMatchObject({ itemId: bundle.items[3].id, minutes: 25, fare: 240, primary: true, pay: '交通卡' });
    expect(bundle.routes[1].primary).toBe(false);
    expect(bundle.items[4]).toMatchObject({ cost: 1000, ticket: { pickup: 'counter', reference: 'DEMO-TICKET' } });
    expect(bundle.items[5]).toMatchObject({ cancelRemind: false, orderNumber: 'DEMO-MEAL' });
    expect(bundle.items[6]).toMatchObject({ address: '示範町3番地', tags: ['想去'], hours: '09:00–17:00', url: 'https://example.com/park' });
    expect(bundle.items[7]).toMatchObject({ end: '', price: 'JPY 12,000', note: '• 11/22 16:00 在 B 門市還車。' });
    expect(bundle.items[8].type).toBe('other');
    expect(JSON.stringify(bundle)).not.toContain('demo-flight.pdf');
    expect(JSON.stringify(bundle)).not.toContain('只供對話核對');
  });
});
