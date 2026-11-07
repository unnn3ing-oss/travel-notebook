import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db';
import type { Item, Trip } from '../types';
import { materializeImport, parseImport } from './importer';
import { orderedDay, saveEntries } from './entryStore';
import { saveImport } from './importStore';
const trip: Trip = { id: 'demo-trip', name: '示範旅行', start: '2026-11-20', end: '2026-11-24', people: 2, currency: 'JPY' };
const days = ['2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23', '2026-11-24'];
const flight = { type: 'flight', title: '示範去程', booking: 'confirmed', notes: '原筆記', flight: { airline: 'CI', flightNo: '0100', from: 'TPE', to: 'NRT', departureDate: trip.start, departureTime: '09:00', departureZone: 'Asia/Taipei', arrivalDate: trip.start, arrivalTime: '13:00', arrivalZone: 'Asia/Tokyo', reference: 'DEMO-PNR', seat: '12A', bags: 1, bagKg: 23, carryKg: 7, checkinMinutes: 60, remind: false } };
const hotel = { type: 'hotel', title: '示範旅宿', booking: 'confirmed', hotel: { name: '示範旅宿', checkinDate: trip.start, checkoutDate: '2026-11-22', checkinTime: '15:00', checkoutTime: '11:00', address: '示範住宿地址', phone: 'DEMO-PHONE', reference: 'DEMO-HOTEL', room: '禁菸雙人房', guests: 2, breakfast: true, total: 'JPY 8,000', payment: 'later', cancelBy: '2026-11-17', remind: false, note: '原入住筆記' } };
function parse(items: unknown[], existing: Item[] = []) {
  const result = parseImport(JSON.stringify({ version: 2, items }), days, existing);
  if ('error' in result) throw Error(result.error);
  return result.rows;
}
async function seed(items: unknown[]) { await db.open(); const bundle = materializeImport(parse(items), trip, (() => { let id = 0; return () => 'seed-' + ++id; })()); await saveEntries(bundle.items, bundle.routes); return db.items.where({ tripId: trip.id }).toArray(); }
async function preview(items: unknown[]) { return parse(items, await db.items.where({ tripId: trip.id }).toArray()); }
async function snapshot() { return { items: await db.items.toArray(), routes: await db.routes.toArray(), documents: await db.documents.toArray() }; }
afterEach(async () => { vi.restoreAllMocks(); await db.delete(); });

describe('duplicate identification and choices', () => {
  it('defaults existing entries to ignore without writing cards or routes', async () => {
    await seed([flight, hotel]); const before = await snapshot(); const rows = await preview([flight, hotel]);
    expect(rows.every(r => !r.checked && r.duplicates?.length === 1)).toBe(true);
    const write = vi.spyOn(db.items, 'bulkPut'); const result = await saveImport(rows, trip);
    expect(result.added).toBe(0); expect(result.overwritten).toBe(0); expect(write).not.toHaveBeenCalled(); expect(await snapshot()).toEqual(before);
  });
  it('finds renamed/re-dated reservations but separates return legs, distinct references and types', async () => {
    const current = await seed([flight, hotel]);
    const changed = parse([{ ...flight, title: '新版名稱', flight: { ...flight.flight, departureDate: '2026-11-21' } }, { ...hotel, title: '新版旅宿', hotel: { ...hotel.hotel, name: '新版旅宿', checkinDate: '2026-11-21' } }], current);
    expect(changed.map(r => r.duplicates?.length)).toEqual([1, 1]);
    for (const item of [{ ...flight, flight: { ...flight.flight, from: 'NRT', to: 'TPE' } }, { ...flight, flight: { ...flight.flight, reference: 'DEMO-OTHER' } }, { type: 'restaurant', title: '示範去程', date: trip.start }]) expect(parse([item], current)[0].duplicates).toHaveLength(0);
    expect(parse([{ type: 'hotel', title: '示範旅宿', date: trip.start }], current)[0].duplicates).toHaveLength(1);
    expect(parse([{ type: 'hotel', title: '示範旅宿 退房', date: '2026-11-22' }], current)[0].duplicates).toHaveLength(0);
  });
  it('requires a target for ambiguous matches and updates only the selected original', async () => {
    await db.open(); const base: Item = { id: 'a', tripId: trip.id, type: 'place', title: '同名景點', date: trip.start, start: '10:00', end: '' };
    await db.items.bulkAdd([base, { ...base, id: 'b' }]);
    const rows = await preview([{ type: 'place', title: base.title, date: trip.start, notes: '新提醒' }]); rows[0].checked = true;
    expect(rows[0].duplicates).toHaveLength(2); expect(rows[0].overwriteId).toBeUndefined();
    await expect(saveImport(rows, trip)).rejects.toThrow('目標');
    rows[0].overwriteId = 'b'; await saveImport(rows, trip);
    expect((await db.items.get('a'))?.note).toBeUndefined(); expect((await db.items.get('b'))?.note).toBe('新提醒'); expect(await db.items.count()).toBe(2);
  });
  it('blocks duplicate choices within a batch and fresh duplicates appearing after preview', async () => {
    await db.open(); const data = { type: 'place', title: '公園', date: trip.start };
    const rows = parse([data, data]); expect(rows[1].batchDuplicate).toBe(true); rows[1].checked = true;
    await expect(saveImport(rows, trip)).rejects.toThrow('只保留一筆'); expect(await db.items.count()).toBe(0);
    await db.items.add({ ...data, type: 'place', id: 'appeared', tripId: trip.id, start: '', end: '' });
    await expect(saveImport([rows[0]], trip)).rejects.toThrow('剛剛'); expect(await db.items.count()).toBe(1);
  });
  it('rechecks changes, deleted targets and cross-trip records before overwriting', async () => {
    const old = (await seed([flight]))[0]; const rows = await preview([flight]); rows[0].checked = true;
    await db.items.update(old.id, { note: '預覽後的手動修改' }); await expect(saveImport(rows, trip)).rejects.toThrow('已變更');
    expect((await db.items.get(old.id))?.note).toBe('預覽後的手動修改');
    const current = await preview([flight]); current[0].checked = true; await db.items.delete(old.id); await expect(saveImport(current, trip)).rejects.toThrow('已變更');
    await db.items.add({ ...old, tripId: 'other-trip' }); const foreign = parse([flight], [{ ...old, tripId: 'other-trip' }]); foreign[0].checked = true;
    await expect(saveImport(foreign, trip)).rejects.toThrow('已變更'); expect((await db.items.get(old.id))?.tripId).toBe('other-trip');
  });
});

describe('atomic overwrite preserving linked information', () => {
  it('keeps known flight facts and reminders for unknown values, accepts explicit zero and replaces notes', async () => {
    const old = (await seed([flight]))[0]; await db.documents.add({ id: 'flight-pdf', tripId: trip.id, itemId: old.id, name: 'demo.pdf', file: new Blob(['demo']) });
    await db.items.update(old.id, { watch: [{ text: '手動待辦', done: false }], alts: [{ name: '手動備案', status: 'none' }], cancelLead: 5 });
    const rows = await preview([{ ...flight, title: '新版去程', notes: '• 攜帶證件。', flight: { ...flight.flight, departureDate: '2026-11-21', arrivalDate: '2026-11-21', seat: '12C', bags: null, bagKg: null, carryKg: 0, checkinMinutes: null, remind: null } }]); rows[0].checked = true;
    const result = await saveImport(rows, trip); const saved = (await db.items.get(old.id))!;
    expect(result).toMatchObject({ added: 0, overwritten: 1 }); expect(await db.items.count()).toBe(1);
    expect(saved).toMatchObject({ id: old.id, title: '新版去程', date: '2026-11-21', note: '• 攜帶證件。', cancelLead: 5, watch: [{ text: '手動待辦' }], alts: [{ name: '手動備案' }] });
    expect(saved.flight).toMatchObject({ flightNo: '0100', seat: '12C', bags: 1, bagKg: 23, carryKg: 0, checkinMinutes: 60, remind: false });
    expect(saved.missingFields).not.toContain('託運件數'); expect(await db.documents.count()).toBe(1);
  });
  it('updates both existing stay IDs, preserves PDF/checkout note, and does not guess breakfast or reminder', async () => {
    const stored = await seed([hotel]); const main = stored.find(i => i.hotel)!; const checkout = stored.find(i => i.linkedStayId)!;
    await db.items.update(checkout.id, { note: '手寫退房提醒' });
    await db.documents.bulkAdd([main, checkout].map((item, k) => ({ id: 'doc-' + k, tripId: trip.id, itemId: item.id, name: 'demo.pdf', file: new Blob(['demo']) })));
    const rows = await preview([{ type: 'hotel', title: '新版旅宿', notes: null, hotel: { name: '新版旅宿', reference: 'DEMO-HOTEL', checkinDate: '2026-11-21', checkoutDate: '2026-11-24', checkoutTime: '10:00', address: null, room: null, guests: null, breakfast: null, remind: null, note: '• 晚到先致電。' } }]); rows[0].checked = true;
    await saveImport(rows, trip); expect(await db.items.count()).toBe(2); expect(await db.documents.count()).toBe(2);
    expect(await db.items.get(main.id)).toMatchObject({ date: '2026-11-21', note: '• 晚到先致電。', hotel: { checkoutId: checkout.id, checkoutDate: '2026-11-24', room: '禁菸雙人房', address: '示範住宿地址', guests: 2, breakfast: true, remind: false } });
    expect(await db.items.get(checkout.id)).toMatchObject({ date: '2026-11-24', start: '10:00', title: '新版旅宿 退房', linkedStayId: main.id, note: '手寫退房提醒' });
  });
  it('accepts explicit false and keeps previously unknown baggage unknown', async () => {
    const current = await seed([{ ...flight, flight: { ...flight.flight, bags: null, bagKg: null, remind: true } }, hotel]);
    const rows = await preview([{ ...flight, flight: { ...flight.flight, bags: null, bagKg: null, remind: false } }, { ...hotel, hotel: { ...hotel.hotel, breakfast: false, remind: false } }]); rows.forEach(r => r.checked = true); await saveImport(rows, trip);
    const f = (await db.items.get(current.find(i => i.flight)!.id))!; const h = (await db.items.get(current.find(i => i.hotel)!.id))!;
    expect(f.flight?.remind).toBe(false); expect(f.missingFields).toContain('託運件數'); expect(f.missingFields).toContain('託運重量'); expect(h.hotel?.breakfast).toBe(false);
  });
  it('merges partial ticket kinds by label and recalculates known totals', async () => {
    const ticket = { type: 'ticket', title: '示範票券', ticket: { name: '示範票券', date: trip.start, time: '10:00', reference: 'DEMO-TICKET', pickup: 'counter', early: 15, kinds: [{ label: '成人', price: 1000, quantity: 2 }] } };
    const old = (await seed([ticket]))[0]; const rows = await preview([{ type: 'ticket', title: ticket.title, ticket: { name: ticket.title, date: trip.start, reference: 'DEMO-TICKET', early: null, pickup: null, kinds: [{ label: '成人', price: null, quantity: 3 }] } }]); rows[0].checked = true;
    await saveImport(rows, trip); expect(await db.items.get(old.id)).toMatchObject({ cost: 3000, ticket: { early: 15, pickup: 'counter', kinds: [{ label: '成人', price: 1000, quantity: 3 }] } });
  });
  it('replaces only selected transit routes, keeps manual route details, and preserves routes for empty input', async () => {
    const transit = { type: 'transit', title: '示範交通', date: trip.start, routes: [{ name: '電車路線', primary: true, legs: [{ mode: 'train', label: '到目的地', minutes: 20, fare: 200 }] }] };
    const items = await seed([transit, { ...transit, title: '其他交通' }]); const first = items.find(i => i.title === transit.title)!; const other = items.find(i => i.id !== first.id)!;
    const route = (await db.routes.where({ itemId: first.id }).toArray())[0]; await db.routes.update(route.id, { ticket: { ref: 'MANUAL-DEMO' } }); const otherRoutes = await db.routes.where({ itemId: other.id }).toArray();
    const rows = await preview([{ ...transit, routes: [{ name: route.name, primary: true, legs: [{ mode: 'train', label: '更新路段', minutes: 30, fare: 300 }] }] }]); rows[0].checked = true;
    const result = await saveImport(rows, trip); expect(result.undo.routeOwners).toEqual([first.id]); expect(result.undo.routes[0].fare).toBe(200);
    expect(await db.routes.get(route.id)).toMatchObject({ itemId: first.id, fare: 300, minutes: 30, ticket: { ref: 'MANUAL-DEMO' } }); expect(await db.routes.where({ itemId: other.id }).toArray()).toEqual(otherRoutes);
    const empty = await preview([{ ...transit, routes: [] }]); empty[0].checked = true; await saveImport(empty, trip); expect((await db.routes.get(route.id))?.fare).toBe(300);
    const bad = await preview([{ ...transit, routes: [{ name: route.name, legs: [{ mode: 'train', label: '缺費用', minutes: 30, fare: null }] }] }]); bad[0].checked = true; await expect(saveImport(bad, trip)).rejects.toThrow('不完整'); expect((await db.routes.get(route.id))?.fare).toBe(300);
  });
  it('retains manually reordered unchanged cards and inserts only new or retimed cards by time', async () => {
    await seed([flight, { type: 'place', title: '上午', date: trip.start, start: '08:00' }, { type: 'place', title: '下午', date: trip.start, start: '18:00' }]);
    const stored = await db.items.toArray(), f = stored.find(i => i.flight)!; await db.items.update(f.id, { order: 0 }); await db.items.update(stored.find(i => i.title === '上午')!.id, { order: 1 });
    const before = orderedDay(await db.items.toArray(), trip.start).map(i => i.id);
    const rows = await preview([{ ...flight, flight: { ...flight.flight, seat: '12D' } }]); rows[0].checked = true; await saveImport(rows, trip); expect(orderedDay(await db.items.toArray(), trip.start).map(i => i.id)).toEqual(before);
    const moved = await preview([{ ...flight, flight: { ...flight.flight, departureTime: '19:00', arrivalTime: '23:00' } }, { type: 'place', title: '新午餐', date: trip.start, start: '12:00' }]); moved[0].checked = true; await saveImport(moved, trip);
    expect(orderedDay(await db.items.toArray(), trip.start).map(i => i.title)).toEqual(['上午', '新午餐', '下午', flight.title]);
  });
  it('rolls back a mixed add/overwrite transaction when a route write fails', async () => {
    await seed([flight]); const before = await snapshot();
    const rows = await preview([{ ...flight, notes: '不該留下的覆蓋' }, { type: 'transit', title: '不該留下的新卡', date: trip.start, routes: [{ name: '路線', legs: [{ mode: 'bus', label: '路段', minutes: 10, fare: 100 }] }] }]); rows[0].checked = true;
    vi.spyOn(db.routes, 'bulkPut').mockRejectedValueOnce(new Error('simulated database write failure'));
    await expect(saveImport(rows, trip)).rejects.toThrow(); expect(await snapshot()).toEqual(before);
  });
  it('rejects a broken stay association without touching either trip', async () => {
    const stored = await seed([hotel]); const main = stored.find(i => i.hotel)!;
    await db.items.update(main.id, { hotel: { ...main.hotel!, checkoutId: 'foreign' } });
    await db.items.add({ id: 'foreign', tripId: 'other-trip', type: 'place', title: '不可動', date: trip.start, start: '', end: '' });
    const rows = await preview([hotel]); rows[0].checked = true; const before = await snapshot();
    await expect(saveImport(rows, trip)).rejects.toThrow('關聯'); expect(await snapshot()).toEqual(before);
  });
});

it('adds the missing checkout for a manual stay and counts the generated card without duplicating the main card', async () => {
  await db.open(); await db.items.add({ id: 'manual-stay', tripId: trip.id, type: 'hotel', title: hotel.title, date: trip.start, start: '15:00', end: '', orderNumber: 'DEMO-HOTEL' });
  const rows = await preview([hotel]); rows[0].checked = true; const result = await saveImport(rows, trip);
  expect(result).toMatchObject({ added: 1, overwritten: 1 }); expect(await db.items.count()).toBe(2);
  const main = (await db.items.get('manual-stay'))!; expect((await db.items.get(main.hotel!.checkoutId!))?.linkedStayId).toBe(main.id);
});
it('rejects a changed check-in later than the preserved check-out instead of deleting the stay pair', async () => {
  await seed([hotel]); const before = await snapshot(); const rows = await preview([{ type: 'hotel', title: hotel.title, hotel: { name: hotel.title, reference: 'DEMO-HOTEL', checkinDate: trip.end, checkoutDate: null } }]); rows[0].checked = true;
  await expect(saveImport(rows, trip)).rejects.toThrow('退房日'); expect(await snapshot()).toEqual(before);
});

it('does not replace known flight quantities with parser fallback zero for invalid negative or nonnumeric input', async () => {
  const old = (await seed([flight]))[0]; const rows = await preview([{ ...flight, flight: { ...flight.flight, bags: -1, bagKg: 'unknown', carryKg: false, checkinMinutes: 1e20 } }]); rows[0].checked = true;
  await saveImport(rows, trip); expect((await db.items.get(old.id))?.flight).toMatchObject({ bags: 1, bagKg: 23, carryKg: 7, checkinMinutes: 60 });
});

it('rejects a flight date change that would leave a preserved arrival before the new departure', async () => {
  await seed([flight]); const before = await snapshot(); const rows = await preview([{ ...flight, flight: { ...flight.flight, departureDate: '2026-11-22', arrivalDate: null } }]); rows[0].checked = true;
  await expect(saveImport(rows, trip)).rejects.toThrow('抵達時間早於起飛'); expect(await snapshot()).toEqual(before);
});
