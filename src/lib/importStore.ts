import { db, uid } from '../db';
import type { Item, Route, Trip } from '../types';
import { saveEntries } from './entryStore';
import { flightMinutes } from './entries';
import { importMatches, sameImportedEntry } from './importDuplicates';
import { materializeImport, normalizeImportItem, validImportDate, type ImportRow } from './importer';

type Obj = Record<string, unknown>;
const object = (v: unknown): Obj => v && typeof v === 'object' && !Array.isArray(v) ? v as Obj : {};
export class ImportConflict extends Error {}
export interface ImportUndo { put: Item[]; del: string[]; routes: Route[]; routeOwners: string[] }
const numericMissing: Record<string, Record<string, string>> = {
  flight: { bags: '託運件數', bagKg: '託運重量', carryKg: '手提重量', checkinMinutes: '報到截止時間' },
  hotel: { guests: '入住人數', breakfast: '早餐' }, ticket: { early: '提前抵達時間', pickup: '取票方式' },
};
/** Remove parser defaults representing missing facts, but keep explicit zero and false. */
function knownFields(fields: Partial<Item>, source?: unknown): Obj {
  const clean = (v: unknown): unknown => {
    if (v === undefined || v === null || v === '' || Array.isArray(v) && !v.length) return undefined;
    if (Array.isArray(v)) return v.map(clean);
    if (typeof v === 'object') return Object.fromEntries(Object.entries(object(v)).map(([k, x]) => [k, clean(x)]).filter(([, x]) => x !== undefined));
    return v;
  };
  const result = object(clean(fields)), missing = fields.missingFields || [];
  delete result.missingFields; delete result.cancelLead; delete result.cost;
  for (const [kind, keys] of Object.entries(numericMissing)) for (const [key, label] of Object.entries(keys)) if (missing.includes(label)) delete object(result[kind])[key];
  const ticket = object(result.ticket);
  if (Array.isArray(ticket.kinds)) ticket.kinds = ticket.kinds.map(raw => { const k = { ...object(raw) }; for (const [key, suffix] of [['price', '單價'], ['quantity', '張數']]) if (missing.includes(String(k.label) + suffix)) delete k[key]; return k; });
  if (source !== undefined) {
    const raw = object(source);
    const validNumber = (v:unknown, integer=false) => { const value=typeof v==='string'?v.replace(/[,，]/g,'').trim().replace(/^(?:[A-Z]{2,3}\$?|[$¥￥€₩฿])\s*/i,''):v; const n=typeof value==='number'||typeof value==='string'&&value!==''?Number(value):NaN; return Number.isFinite(n)&&n>=0&&n<=1e9&&(!integer||Number.isInteger(n)); };
    const aliases: Record<string,Record<string,string[]>> = { flight:{bags:['bags','checkedBags'],bagKg:['bagKg','checkedBaggageKg'],carryKg:['carryKg','carryOnKg'],checkinMinutes:['checkinMinutes','checkinCloseMinutes','close']},hotel:{guests:['guests','people']},ticket:{early:['early']} };
    for(const [kind,keys] of Object.entries(aliases)){ const original={...raw,...object(raw[kind])}; for(const [key,names]of Object.entries(keys)){const v=names.map(k=>original[k]).find(v=>v!==undefined&&v!==null&&v!=='');if(!validNumber(v,key==='bags'||key==='guests'))delete object(result[kind])[key];} }
    const originalTicket={...raw,...object(raw.ticket)};
    if(!['qr','counter','voucher'].includes(String(originalTicket.pickup||originalTicket.pick||'')))delete ticket.pickup;
    if(Array.isArray(ticket.kinds)&&Array.isArray(originalTicket.kinds))ticket.kinds=ticket.kinds.map(rawKind=>{const kind={...object(rawKind)};const candidates=(originalTicket.kinds as unknown[]).map(object).filter(k=>String(k.label||'').trim()===kind.label);const original=candidates.length===1?candidates[0]:{};if(!validNumber(original.price))delete kind.price;if(!validNumber(original.quantity??original.qty,true))delete kind.quantity;return kind;});
    for (const kind of ['flight', 'hotel']) {
      const prefs = { ...raw, ...object(raw[kind]) };
      if (typeof prefs.remind !== 'boolean' && (kind !== 'hotel' || typeof prefs.cancelRemind !== 'boolean')) { delete object(result[kind]).remind; if (kind === 'hotel') delete result.cancelRemind; }
    }
  }
  // Canonical importer source names, rather than database names.
  result.notes = result.note; delete result.note;
  result.place = result.address; delete result.address;
  if (result.hotel) { const h = object(result.hotel); if (result.notes && !h.note) h.note = result.notes; delete result.notes; }
  return result;
}
function mergeKnown(old: Obj, incoming: Obj): Obj {
  const result = { ...old };
  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined) continue;
    if (key === 'kinds' && Array.isArray(value)) {
      const previous = Array.isArray(old.kinds) ? old.kinds.map(object) : [];
      result.kinds = value.map(raw => { const next = object(raw), matching = previous.filter(p => p.label === next.label); return mergeKnown(matching.length === 1 ? matching[0] : {}, next); });
    } else result[key] = value && typeof value === 'object' && !Array.isArray(value) ? mergeKnown(object(old[key]), object(value)) : value;
  }
  return result;
}
export function mergeImportedItem(old: Item, row: ImportRow): Item {
  const normalized = normalizeImportItem(mergeKnown(knownFields({ ...old, date: old.date || old.originalDate || null }), knownFields(row.fields, row.source)));
  if (!normalized) throw new ImportConflict('資料不完整，請重新檢查匯入內容。');
  const item: Item = { ...old, ...normalized.fields, id: old.id, tripId: old.tripId, type: old.type, date: row.target, originalDate: row.date, start: normalized.fields.start || '', end: normalized.fields.end || '' };
  if (old.cancelLead !== undefined) item.cancelLead = old.cancelLead;
  if (item.hotel) { item.hotel.checkoutId = old.hotel?.checkoutId; item.address = item.hotel.address || item.address; item.note = item.hotel.note || undefined; }
  if (item.flight) item.price = item.flight.price || item.price;
  if (item.ticket) item.cost = normalized.fields.cost;
  return item;
}
function completeRoutes(row: ImportRow): boolean {
  const source = object(row.source);
  if (!Array.isArray(source.routes)) return false;
  const modes = ['walk', 'train', 'subway', 'tram', 'bus', 'car', 'taxi', 'ferry', 'rental', 'plane'];
  return source.routes.every(raw => { const route = object(raw); return Array.isArray(route.legs) && route.legs.length > 0 && route.legs.every(rawLeg => { const leg = object(rawLeg); const min = leg.minutes ?? leg.min; return modes.includes(String(leg.mode)) && typeof leg.label === 'string' && !!leg.label.trim() && typeof min === 'number' && Number.isFinite(min) && min >= 0 && typeof leg.fare === 'number' && Number.isFinite(leg.fare) && leg.fare >= 0; }); });
}

/** A preview is a proposal: recheck live records, then write all choices in one transaction. */
export async function saveImport(rows: ImportRow[], trip: Trip) {
  return db.transaction('rw', db.items, db.routes, db.documents, async () => {
    const before = await db.items.where({ tripId: trip.id }).toArray(), updates: Item[] = [], routes: Route[] = [], routeOwners: string[] = [];
    const selected = rows.filter(r => r.checked), claimed = new Set<string>();
    let overwritten = 0;
    for (let i = 0; i < selected.length; i++) {
      const row = selected[i];
      if (selected.slice(0, i).some(previous => sameImportedEntry(row.fields, previous.fields))) throw new ImportConflict('這批內容有相同行程，請只保留一筆再匯入。');
      const matches = importMatches(row.fields, before);
      if (row.duplicates?.length) {
        const preview = row.duplicates.find(m => m.id === row.overwriteId), match = matches.find(m => m.id === row.overwriteId);
        if (!preview || !match || preview.revision !== match.revision) throw new ImportConflict('原行程已變更或覆蓋目標尚未選好，請重新檢查內容。');
        if (claimed.has(match.id)) throw new ImportConflict('同一行程不能同時覆蓋兩次，請只選一筆。');
        claimed.add(match.id);
        const old = before.find(item => item.id === match.id)!;
        const item = mergeImportedItem(old, row);
        if (item.flight && Number.isFinite(flightMinutes(item.flight)) && flightMinutes(item.flight)<0) throw new ImportConflict('航班抵達時間早於起飛，請補齊改期後的抵達日期時間。');
        updates.push(item);
        if (item.hotel) {
          const h = item.hotel;
          if (h.checkoutDate && (!validImportDate(h.checkoutDate) || h.checkoutDate <= h.checkinDate)) throw new ImportConflict('住宿退房日必須晚於入住日，請補齊日期再覆蓋。');
          const children = before.filter(i => i.linkedStayId === old.id);
          if (children.length > 1) throw new ImportConflict('這筆住宿有多張退房卡，請先核對後再匯入。');
          const checkout = h.checkoutId ? before.find(i => i.id === h.checkoutId) : children[0];
          if (h.checkoutId && (!checkout || checkout.linkedStayId !== old.id || checkout.type !== 'hotel')) throw new ImportConflict('住宿關聯資料已變更，請先核對退房卡。');
          item.title = h.name + ' 入住';
          if (h.checkoutDate) {
            h.checkoutId = checkout?.id || uid();
            updates.push({ ...checkout, id: h.checkoutId, tripId: trip.id, type: 'hotel', title: h.name + ' 退房', date: h.checkoutDate >= trip.start && h.checkoutDate <= trip.end ? h.checkoutDate : null, originalDate: h.checkoutDate, start: h.checkoutTime, end: h.checkoutTime, linkedStayId: item.id });
          }
        }
        overwritten++;
        if (row.type === 'transit' && row.routes.length) {
          if (!completeRoutes(row)) throw new ImportConflict('交通路段的工具、時間或費用不完整，請補齊後再覆蓋。');
          const previous = await db.routes.where({itemId:item.id}).toArray();
          routeOwners.push(item.id); routes.push(...row.routes.map(r => { const matching=previous.filter(p=>p.name===r.name); const old=matching.length===1?matching[0]:undefined; return { ...r, id:old?.id||uid(), itemId:item.id, booking:r.booking??old?.booking, pay:r.pay||old?.pay, ...(old?.ticket?{ticket:old.ticket}:{}), ...(old?.noBookNote?{noBookNote:old.noBookNote}:{}) }; }));
        }
      } else {
        if (matches.length) throw new ImportConflict('剛剛已出現相同行程，請重新檢查並選擇忽略或覆蓋。');
        const bundle = materializeImport([row], trip, uid); updates.push(...bundle.items); routes.push(...bundle.routes);
      }
    }
    if (!updates.length) return { items: [] as Item[], added: 0, overwritten: 0, undo: { put: [], del: [], routes: [], routeOwners: [] } as ImportUndo };
    const oldRoutes = routeOwners.length ? await db.routes.where('itemId').anyOf(routeOwners).toArray() : [];
    const moved = updates.filter(item => { const old = before.find(i => i.id === item.id); return !old || old.date !== item.date || old.start !== item.start; });
    await db.items.bulkPut(updates.filter(item => !moved.some(m => m.id === item.id)));
    if (moved.length) await saveEntries(moved);
    if (routeOwners.length) await db.routes.where('itemId').anyOf(routeOwners).delete();
    if (routes.length) await db.routes.bulkPut(routes);
    const after = await db.items.where({ tripId: trip.id }).toArray();
    const undo: ImportUndo = { put: before.filter(old => JSON.stringify(old) !== JSON.stringify(after.find(i => i.id === old.id))), del: updates.filter(i => !before.some(old => old.id === i.id)).map(i => i.id), routes: oldRoutes, routeOwners };
    return { items: updates, added: undo.del.length, overwritten, undo };
  });
}
