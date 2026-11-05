import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid } from '../db';
import type { Item, ItemType, Route, Trip } from '../types';
import { addDays, daysBetween, fmt, md, toMin, weekday } from '../lib/time';
import { byTime } from '../lib/day';
import { href } from '../lib/route';
import { importPrompt, parseImport, sampleResult, type ImportRow } from '../lib/importer';
import { BOOKING_LABEL } from '../components/ui';
import { css, DSheet, DToast, FIELD_LABEL, I, pill, PILL_NONE, PILL_OK, PILL_ORDERED, TabPage } from '../design';
import { PlanBoard } from './Planner';

export const TYPE_LABEL: Record<ItemType, string> = { flight: '航班', transit: '交通', hotel: '住宿', ticket: '門票', restaurant: '餐廳', place: '景點', car: '租車', other: '其他' };
const NEWNAME: Record<ItemType, string> = { place: '新的景點', restaurant: '新的餐廳', transit: '從哪裡到哪裡', hotel: '住宿', flight: '航班', ticket: '門票', car: '租車', other: '新的行程' };
const MODE: Record<string, string> = { walk: '步行', train: '電車', bus: '巴士', car: '計程車', ferry: '渡輪', plane: '飛機' };
const POOL = 'pool';
type Snap = { put: Item[]; del: string[]; routes?: Route[] };

/** 一天的卡片：手動排過（order）就照手動順序，否則照時間 */
export function dayCards(items: Item[], key: string) {
  const list = items.filter((i) => (key === POOL ? i.date === null : i.date === key)).sort(byTime);
  const idx = new Map(list.map((x, k) => [x.id, k]));
  return list.sort((a, b) => (a.order ?? idx.get(a.id)!) - (b.order ?? idx.get(b.id)!) || idx.get(a.id)! - idx.get(b.id)!);
}

function routeMeta(i: Item, routes: Route[]) {
  const rs = routes.filter((r) => r.itemId === i.id);
  const r = rs.find((x) => x.primary) ?? rs[0];
  if (!r) return '';
  return r.mode === 'walk' ? '步行 ' + r.minutes + ' 分鐘' : (MODE[r.mode] ?? r.name) + '，約 ' + r.minutes + ' 分鐘';
}
function meta(i: Item, routes: Route[]) {
  if (i.type === 'transit') return routeMeta(i, routes);
  const bits: string[] = [];
  if (i.orderNumber) bits.push('訂單 ' + i.orderNumber);
  else if (i.booking) bits.push(BOOKING_LABEL[i.booking]);
  if (i.alts?.length) bits.push(i.alts.length + ' 個備案');
  return bits.join('，');
}

/** 設計稿「行程」：清單 (PlanList)、時間軸 (Itinerary)、空白 (EmptyPlan) */
export function Plan({ trip, day }: { trip: Trip; day?: string }) {
  const days = Array.from({ length: daysBetween(trip.start, trip.end) + 1 }, (_, i) => addDays(trip.start, i));
  const sel = day && (day === POOL || days.includes(day)) ? day : days[0];
  const items = useLiveQuery(() => db.items.where({ tripId: trip.id }).toArray(), [trip.id]);
  const routes = useLiveQuery(() => db.routes.toArray(), []);
  const [view, setView] = useState<'list' | 'timeline'>(() => (sessionStorage.getItem('plan-view') === 'timeline' ? 'timeline' : 'list'));
  const [sheet, setSheet] = useState<null | 'add' | 'import' | { edit: string }>(null);
  const [toast, setToast] = useState<{ text: string; undo?: Snap } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  if (!items || !routes) return <TabPage><span /></TabPage>;

  const say = (text: string, undo?: Snap) => { setToast({ text, undo }); clearTimeout(timer.current); timer.current = setTimeout(() => setToast(null), 6000); };
  const snap = (ids: string[]): Snap => ({ put: items.filter((i) => ids.includes(i.id)).map((i) => ({ ...i })), del: [] });
  const undo = async (s: Snap) => {
    await db.transaction('rw', db.items, db.routes, async () => {
      if (s.del.length) await db.items.bulkDelete(s.del);
      await db.items.bulkPut(s.put);
      if (s.routes?.length) await db.routes.bulkPut(s.routes);
    });
    say('已復原');
  };
  const pick = (k: string) => { location.hash = href('plan', k); };
  const setV = (v: 'list' | 'timeline') => { setView(v); try { sessionStorage.setItem('plan-view', v); } catch { /* ignore */ } };
  const list = dayCards(items, sel);
  const poolCount = items.filter((i) => i.date === null).length;
  const label = (k: string) => (k === POOL ? '未排程' : md(k) + ' ' + weekday(k));

  const reorder = async (from: number, to: number) => {
    const next = list.slice();
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    const before = snap(list.map((i) => i.id));
    await db.transaction('rw', db.items, async () => { for (const [k, i] of next.entries()) await db.items.update(i.id, { order: k }); });
    say('已移動「' + m.title + '」', before);
  };
  /** 換到另一天：依時間插入，重編該天順序 */
  const moveTo = async (it: Item, to: string) => {
    const target = dayCards(items, to).filter((x) => x.id !== it.id);
    const t = toMin(it.start);
    let at = isNaN(t) ? -1 : target.findIndex((x) => !isNaN(toMin(x.start)) && toMin(x.start) > t);
    if (at < 0) at = target.length;
    target.splice(at, 0, it);
    const before = snap([it.id, ...target.map((x) => x.id)]);
    await db.transaction('rw', db.items, async () => {
      for (const [k, x] of target.entries()) await db.items.update(x.id, { order: k, ...(x.id === it.id ? { date: to === POOL ? null : to } : {}) });
    });
    setSheet(null);
    say('已移到 ' + label(to), before);
  };
  const remove = async (it: Item) => {
    const rs = await db.routes.where({ itemId: it.id }).toArray();
    await db.transaction('rw', db.items, db.routes, async () => { await db.items.delete(it.id); await db.routes.where({ itemId: it.id }).delete(); });
    setSheet(null);
    say('已刪除「' + it.title + '」', { put: [it], del: [], routes: rs });
  };
  const add = async (type: ItemType) => {
    const it: Item = { id: uid(), tripId: trip.id, date: sel === POOL ? null : sel, start: '', end: '', title: NEWNAME[type], type, order: list.length, ...(type !== 'place' && type !== 'other' && type !== 'transit' ? { booking: 'none' as const } : {}) };
    if (type === 'transit') await db.routes.add({ id: uid(), itemId: it.id, name: '步行', mode: 'walk', minutes: 10, walk: 0, place: '', legs: [], departures: [], fare: 0, primary: true });
    await db.items.add(it);
    setSheet({ edit: it.id });
  };
  const doImport = async (rows: ImportRow[]) => {
    const made: Item[] = rows.map((r, k) => ({ id: uid() + k, tripId: trip.id, date: r.target, start: r.start, end: r.end, title: r.title, type: r.type, orderNumber: r.orderNumber || undefined,
      ...(r.type !== 'other' ? { booking: 'confirmed' as const } : {}), ...(r.place ? { note: r.place } : {}) }));
    await db.items.bulkAdd(made);
    setSheet(null);
    if (made[0]) pick(made[0].date ?? POOL);
    say('已加入 ' + made.length + ' 張卡片', { put: [], del: made.map((m) => m.id) });
  };

  const editItem = sheet && typeof sheet === 'object' ? items.find((i) => i.id === sheet.edit) : undefined;
  const tripEmpty = items.length === 0;

  const header = view === 'timeline' && !tripEmpty ? (
    <header style={css('display: flex; justify-content: space-between; align-items: center')}>
      <h1 style={css('margin: 0; font-size: 28px; font-weight: 700')}>行程</h1>
      <Segment view={view} setView={setV} tall />
    </header>
  ) : (
    <header style={css('display: flex; justify-content: space-between; align-items: flex-start; gap: 12px')}>
      <div>
        <a href={href('')} style={css('font-size: 13px; color: #5B6578; text-decoration: none')}>所有旅程</a>
        <h1 style={css('margin: 2px 0 0; font-size: 26px; font-weight: 700')}>{trip.name}</h1>
        <p className="num" style={css('margin: 2px 0 0; font-size: 13px; color: #5B6578')}>{md(trip.start)} – {md(trip.end)}，{trip.people} 人</p>
      </div>
      {!tripEmpty && <Segment view={view} setView={setV} />}
    </header>
  );

  return (
    <TabPage pad="52px 20px 16px" gap={14}>
      <div className="desktop-board"><PlanBoard trip={trip} days={days} items={items} edit={(i) => (i === 'new' ? setSheet('add') : setSheet({ edit: i.id }))} /></div>
      <div className="mobile-plan">
        {header}
        {view === 'timeline' && !tripEmpty
          ? <Timeline days={days} sel={sel === POOL ? days[0] : sel} items={items} routes={routes} pick={pick} poolCount={poolCount} onAdd={() => setSheet('add')} />
          : <>
            <DayTabs days={days} sel={sel} pick={pick} />
            {tripEmpty ? <EmptyTrip first={sel === days[0]} onImport={() => setSheet('import')} onAdd={() => setSheet('add')} /> : <>
              <div style={css('display: flex; align-items: center; justify-content: space-between; gap: 8px')}>
                <p style={css('margin: 0; display: flex; align-items: center; gap: 6px; font-size: 13px; color: #5B6578')}>
                  <span style={css('color: #8A94A6; display: flex')}>{I.grip}</span>長按卡片，上下拖曳排序
                </p>
                <button onClick={() => setSheet('import')} style={css('height: 40px; flex-shrink: 0; padding: 0 14px; border-radius: 10px; border: 1px solid #DCE1E8; background: #FFFFFF; color: #1E2A44; font: inherit; font-size: 13px; font-weight: 500')}>AI 匯入訂單</button>
              </div>
              <CardList key={sel} list={list} routes={routes} pool={sel === POOL} label={label(sel)} open={(i) => setSheet({ edit: i.id })} reorder={reorder} />
              {!list.length && <p style={css('margin: 0; padding: 24px 12px; border: 1.5px dashed #B8C0CC; border-radius: 12px; text-align: center; font-size: 14px; color: #5B6578')}>{sel === POOL ? '景點庫是空的，想去的地方可以先放這裡' : '這天還沒有行程'}</p>}
              <div style={css('display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; flex-shrink: 0')}>
                <button onClick={() => setSheet('add')} style={css('height: 48px; border-radius: 12px; border: 1px dashed #B8C0CC; background: transparent; color: #1E2A44; font: inherit; font-size: 15px')}>＋ 新增行程</button>
                <a href={href('library')} style={css('height: 48px; box-sizing: border-box; border-radius: 12px; border: 1px solid #DCE1E8; background: #FFFFFF; font-size: 15px; text-decoration: none; display: flex; align-items: center; justify-content: center')}>從景點庫加入</a>
              </div>
            </>}
          </>}
      </div>

      {toast && <DToast text={toast.text} action={toast.undo ? '復原' : undefined} onAction={() => { const u = toast.undo!; setToast(null); undo(u); }} bottom={view === 'timeline' ? 164 : 100} />}

      {editItem && <EditSheet key={editItem.id} item={editItem} list={dayCards(items, editItem.date ?? POOL)} days={days} label={label} routes={routes}
        close={() => setSheet(null)} moveTo={(to) => moveTo(editItem, to)} remove={() => remove(editItem)}
        swap={async (dir) => { const l = dayCards(items, editItem.date ?? POOL); const k = l.findIndex((x) => x.id === editItem.id); if (l[k + dir]) await reorderList(l, k, k + dir); }} />}
      {sheet === 'add' && (
        <DSheet title={'新增到 ' + label(sel)} onClose={() => setSheet(null)}>
          <div style={css('display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px')}>
            {(['place', 'restaurant', 'transit', 'hotel', 'ticket', 'flight'] as ItemType[]).map((t) => (
              <button key={t} onClick={() => add(t)} style={css('height: 64px; border-radius: 14px; border: 1px solid #DCE1E8; background: #FFFFFF; color: #1E2A44; font: inherit; font-size: 15px; font-weight: 700')}>{TYPE_LABEL[t]}</button>
            ))}
          </div>
        </DSheet>
      )}
      {sheet === 'import' && <ImportSheet trip={trip} days={days} items={items} close={() => setSheet(null)} done={doImport} />}
    </TabPage>
  );
}

async function reorderList(list: Item[], from: number, to: number) {
  const next = list.slice();
  const [m] = next.splice(from, 1);
  next.splice(to, 0, m);
  await db.transaction('rw', db.items, async () => { for (const [k, i] of next.entries()) await db.items.update(i.id, { order: k }); });
}

function Segment({ view, setView, tall }: { view: string; setView: (v: 'list' | 'timeline') => void; tall?: boolean }) {
  const h = tall ? '38px; padding: 0 14px' : '36px; padding: 0 12px';
  const on = 'height: ' + h + '; border: 0; border-radius: 10px; background: #FFFFFF; color: #1E2A44; font: inherit; font-size: 14px; font-weight: 700';
  const off = 'height: ' + h + '; border: 0; border-radius: 10px; background: transparent; color: #5B6578; font: inherit; font-size: 14px';
  return (
    <div role="group" aria-label="檢視方式" style={css('display: flex; flex-shrink: 0; background: #E4E8EE; border-radius: 12px; padding: 3px')}>
      <button aria-pressed={view === 'list'} onClick={() => setView('list')} style={css(view === 'list' ? on : off)}>清單</button>
      <button aria-pressed={view === 'timeline'} onClick={() => setView('timeline')} style={css(view === 'timeline' ? on : off)}>時間軸</button>
    </div>
  );
}

function DayTabs({ days, sel, pick }: { days: string[]; sel: string; pick: (k: string) => void }) {
  const tab = (k: string, top: string, bottom: string) => {
    const on = k === sel;
    return (
      <button key={k} role="tab" aria-selected={on} onClick={() => pick(k)} style={css('flex: 0 0 auto; min-width: 56px; height: 56px; padding: 0 10px; border-radius: 12px; font: inherit; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; ' + (on ? 'border: 0; background: #1E2A44; color: #FFFFFF' : k === POOL ? 'border: 1px dashed #B8C0CC; background: transparent; color: #1E2A44' : 'border: 0; background: #FFFFFF; color: #1E2A44'))}>
        <span className="num" style={css('font-size: 16px; font-weight: 700')}>{top}</span><span style={css('font-size: 11px')}>{bottom}</span>
      </button>
    );
  };
  return (
    <div role="tablist" aria-label="選擇日期" className="noscrollbar" style={css('display: flex; gap: 6px; overflow-x: auto; margin: 0 -20px; padding: 0 20px')}>
      {tab(POOL, '未排', '景點庫')}
      {days.map((d) => tab(d, md(d).split('/')[1], weekday(d)))}
    </div>
  );
}

/** 卡片清單：長按 380ms 後可上下拖曳排序 */
function CardList({ list, routes, pool, label, open, reorder }: { list: Item[]; routes: Route[]; pool: boolean; label: string; open: (i: Item) => void; reorder: (from: number, to: number) => void }) {
  const [drag, setDrag] = useState<{ from: number; over: number } | null>(null);
  const p = useRef<{ x: number; y: number } | null>(null);
  const t = useRef<ReturnType<typeof setTimeout>>(undefined);
  const just = useRef(false);
  const ol = useRef<HTMLOListElement>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;
  useEffect(() => {
    const el = ol.current;
    if (!el) return;
    const stop = (e: TouchEvent) => { if (dragRef.current) e.preventDefault(); };
    el.addEventListener('touchmove', stop, { passive: false });
    return () => { el.removeEventListener('touchmove', stop); clearTimeout(t.current); };
  }, []);
  const view = drag ? (() => { const a = list.slice(); const [m] = a.splice(drag.from, 1); a.splice(drag.over, 0, m); return a; })() : list;
  const draggedId = drag ? list[drag.from].id : null;
  const finish = (apply: boolean) => {
    clearTimeout(t.current);
    p.current = null;
    const d = dragRef.current;
    if (!d) return;
    just.current = true;
    setDrag(null);
    if (apply && d.from !== d.over) reorder(d.from, d.over);
  };
  let prev: number | null = null;
  return (
    <ol ref={ol} aria-label={label + ' 的行程'} style={css('list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; ' + (drag ? 'touch-action: none' : ''))}
      onPointerMove={(e) => {
        if (!p.current) return;
        if (!dragRef.current) { if (Math.abs(e.clientX - p.current.x) + Math.abs(e.clientY - p.current.y) > 8) { clearTimeout(t.current); p.current = null; } return; }
        const li = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest('[data-idx]');
        if (li) { const k = +li.getAttribute('data-idx')!; if (k !== dragRef.current.over) setDrag({ ...dragRef.current, over: k }); }
      }}
      onPointerUp={() => finish(true)} onPointerCancel={() => finish(false)}>
      {view.map((it, i) => {
        const tm = toMin(it.start);
        const warn = !drag && !pool && !isNaN(tm) && prev != null && tm < prev;
        if (!isNaN(tm)) prev = tm;
        const lifted = it.id === draggedId;
        const realIdx = list.findIndex((x) => x.id === it.id);
        const rs = routes.filter((r) => r.itemId === it.id).length;
        const m = meta(it, routes);
        return (
          <li key={it.id} data-idx={i} tabIndex={0} role="button" aria-label={'編輯 ' + it.title}
            onPointerDown={(e) => {
              if (e.button) return;
              p.current = { x: e.clientX, y: e.clientY };
              clearTimeout(t.current);
              t.current = setTimeout(() => { if (!p.current) return; try { navigator.vibrate?.(12); } catch { /* ignore */ } setDrag({ from: realIdx, over: realIdx }); }, 380);
            }}
            onClick={() => { if (just.current) { just.current = false; return; } open(it); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(it); } }}
            onContextMenu={(e) => e.preventDefault()}
            style={css('display: flex; align-items: flex-start; gap: 12px; padding: 14px; border-radius: 14px; background: #FFFFFF; cursor: grab; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; transition: box-shadow 120ms, transform 120ms; ' +
              (lifted ? 'box-shadow: 0 0 0 2px #1E2A44, 0 12px 24px rgba(30,42,68,0.22); transform: scale(1.02); position: relative; z-index: 2' : warn ? 'box-shadow: inset 0 0 0 1.5px #E8B4AF' : ''))}>
            <span className="num" style={css('width: 48px; flex-shrink: 0; padding-top: 2px; font-size: 15px; font-weight: 700; ' + (it.start ? '' : 'color: #8A94A6; font-size: 13px'))}>{it.start || '未定'}</span>
            <span style={css('flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px')}>
              <span style={css('font-size: 16px; font-weight: 700; line-height: 1.35')}>{it.title}</span>
              <span style={css('font-size: 12px; color: #5B6578')}>{TYPE_LABEL[it.type]}{m && '，' + m}</span>
              {it.type === 'transit' && <a href={href('transit', it.id)} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} style={css('align-self: flex-start; margin-top: 4px; padding: 6px 10px; border-radius: 8px; background: #EEF1F5; font-size: 12px; font-weight: 700; text-decoration: none')}>{rs ? rs + ' 條路線，看班次' : '加入交通方式與班次'}</a>}
              {warn && <span style={css('font-size: 12px; font-weight: 700; color: #B83A32')}>時間比上一張早，改時間或換順序</span>}
            </span>
            <span style={css('flex-shrink: 0; margin-top: 2px; color: #B8C0CC; display: flex')}>{I.grip}</span>
          </li>
        );
      })}
    </ol>
  );
}

function EditSheet({ item, list, days, label, routes, close, moveTo, remove, swap }: { item: Item; list: Item[]; days: string[]; label: (k: string) => string; routes: Route[]; close: () => void; moveTo: (to: string) => void; remove: () => void; swap: (dir: number) => void }) {
  const [title, setTitle] = useState(item.title);
  const idx = list.findIndex((x) => x.id === item.id);
  const save = () => { if (title.trim() && title.trim() !== item.title) db.items.update(item.id, { title: title.trim() }); };
  const retime = (v: string) => {
    const dur = toMin(item.end) - toMin(item.start);
    db.items.update(item.id, { start: v, end: v && dur > 0 ? fmt(Math.min(toMin(v) + dur, 1439)) : item.end && v && toMin(item.end) > toMin(v) ? item.end : v ? fmt(Math.min(toMin(v) + 60, 1439)) : '' });
  };
  const sel = 'height: 48px; border: 1px solid #DCE1E8; border-radius: 12px; padding: 0 10px; font: inherit; font-size: 16px; color: #1E2A44; background: #FFFFFF';
  const arrow = 'width: 48px; height: 44px; flex-shrink: 0; border-radius: 10px; border: 1px solid #DCE1E8; background: #FFFFFF; color: #1E2A44; display: flex; align-items: center; justify-content: center';
  const done = () => { save(); close(); };
  const rs = routes.filter((r) => r.itemId === item.id).length;
  return (
    <div className="dsheet" style={css('position: fixed; inset: 0; z-index: 40; display: flex; flex-direction: column; justify-content: flex-end; max-width: 480px; margin: 0 auto')}>
      <div aria-hidden="true" onClick={done} style={css('position: absolute; inset: 0; background: rgba(30,42,68,0.55)')} />
      <section role="dialog" aria-modal="true" aria-labelledby="edit-h" style={css('position: relative; max-height: 92dvh; overflow-y: auto; background: #FFFFFF; border-radius: 24px 24px 0 0; padding: 10px 20px max(34px, env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 14px')}>
        <span aria-hidden="true" style={css('align-self: center; width: 40px; height: 5px; border-radius: 3px; background: #DCE1E8')} />
        <div style={css('display: flex; justify-content: space-between; align-items: center')}>
          <h2 id="edit-h" style={css('margin: 0; font-size: 18px; font-weight: 700')}>編輯行程</h2>
          <button onClick={done} style={css('height: 40px; padding: 0 16px; border-radius: 10px; border: 0; background: #1E2A44; color: #FFFFFF; font: inherit; font-size: 14px; font-weight: 700')}>完成</button>
        </div>
        <label style={css(FIELD_LABEL)}>名稱
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={save} style={css('height: 48px; box-sizing: border-box; border: 1px solid #DCE1E8; border-radius: 12px; padding: 0 12px; font: inherit; font-size: 17px; font-weight: 700; color: #1E2A44; background: #FFFFFF')} />
        </label>
        <div style={css('display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px')}>
          <label style={css(FIELD_LABEL)}>開始時間
            <input type="time" value={item.start} onChange={(e) => retime(e.target.value)} className="num" style={css('height: 48px; box-sizing: border-box; border: 1px solid #DCE1E8; border-radius: 12px; padding: 0 10px; font-size: 16px; color: #1E2A44; background: #FFFFFF; width: 100%')} />
          </label>
          <label style={css(FIELD_LABEL)}>類型
            <select value={item.type} onChange={(e) => db.items.update(item.id, { type: e.target.value as ItemType })} style={css(sel)}>
              {(['place', 'restaurant', 'transit', 'hotel', 'flight', 'ticket', 'other'] as ItemType[]).map((k) => <option key={k} value={k}>{TYPE_LABEL[k]}</option>)}
            </select>
          </label>
        </div>
        {item.type === 'transit'
          ? <a href={href('transit', item.id)} onClick={save} style={css('min-height: 52px; box-sizing: border-box; padding: 0 14px; border-radius: 12px; background: #EEF1F5; text-decoration: none; display: flex; align-items: center; justify-content: space-between; font-size: 15px; font-weight: 700')}>交通方式、路線與班次{rs ? '（' + rs + ' 條）' : ''}{I.chev}</a>
          : <a href={href('place', item.id)} onClick={save} style={css('min-height: 52px; box-sizing: border-box; padding: 0 14px; border-radius: 12px; background: #EEF1F5; text-decoration: none; display: flex; align-items: center; justify-content: space-between; font-size: 15px; font-weight: 700')}>筆記、想看清單與標籤{I.chev}</a>}
        {item.booking && <a href={href('bookings', 'edit', item.id)} onClick={save} style={css('min-height: 52px; box-sizing: border-box; padding: 0 14px; border-radius: 12px; border: 1px solid #DCE1E8; text-decoration: none; display: flex; align-items: center; justify-content: space-between; font-size: 15px; font-weight: 500')}><span>預訂與備案<span style={{ ...(item.booking === 'none' ? PILL_NONE : item.booking === 'ordered' ? PILL_ORDERED : PILL_OK), marginLeft: 8 }}>{BOOKING_LABEL[item.booking]}</span></span>{I.chev}</a>}
        <div style={css('display: flex; gap: 8px; align-items: center')}>
          <button aria-label="上移" disabled={idx <= 0} onClick={() => swap(-1)} style={{ ...css(arrow), opacity: idx <= 0 ? 0.4 : 1 }}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 15l6-6 6 6" /></svg></button>
          <button aria-label="下移" disabled={idx >= list.length - 1} onClick={() => swap(1)} style={{ ...css(arrow), opacity: idx >= list.length - 1 ? 0.4 : 1 }}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg></button>
          <label style={css('flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px; font-size: 13px; color: #5B6578')}>移到
            <select value={item.date ?? POOL} onChange={(e) => moveTo(e.target.value)} style={css('flex: 1; min-width: 0; height: 44px; border: 1px solid #DCE1E8; border-radius: 10px; padding: 0 8px; font: inherit; font-size: 15px; color: #1E2A44; background: #FFFFFF')}>
              <option value={POOL}>{label(POOL)}</option>
              {days.map((d) => <option key={d} value={d}>{label(d)}</option>)}
            </select>
          </label>
        </div>
        <button onClick={remove} style={css('height: 44px; border-radius: 12px; border: 0; background: transparent; color: #B83A32; font: inherit; font-size: 15px; font-weight: 700')}>刪除這張卡片</button>
      </section>
    </div>
  );
}

function ImportSheet({ trip, days, items, close, done }: { trip: Trip; days: string[]; items: Item[]; close: () => void; done: (rows: ImportRow[]) => void }) {
  const [raw, setRaw] = useState('');
  const [copied, setCopied] = useState(false);
  const [res, setRes] = useState<ReturnType<typeof parseImport> | null>(null);
  const rows = res && 'rows' in res ? res.rows : [];
  const checked = rows.filter((r) => r.checked);
  const existing: Record<string, string[]> = {};
  for (const i of items) if (i.date) (existing[i.date] ??= []).push(i.title);
  const btn = 'height: 48px; border-radius: 12px; border: 1px solid #DCE1E8; background: #FFFFFF; color: #1E2A44; font: inherit; font-size: 14px';
  return (
    <DSheet title="用 AI 匯入訂單" onClose={close}>
      {!rows.length ? <>
        <p style={css('margin: 0; font-size: 14px; line-height: 1.6; color: #5B6578')}>App 不會讀你的信箱。複製提示詞給能讀信箱的 AI，再把結果貼回來。</p>
        <button onClick={async () => { try { await navigator.clipboard.writeText(importPrompt(trip)); setCopied(true); } catch { setCopied(false); alert(importPrompt(trip)); } }} style={css('height: 48px; border-radius: 12px; border: 0; background: #1E2A44; color: #FFFFFF; font: inherit; font-size: 15px; font-weight: 700')}>{copied ? '已複製提示詞' : '複製提示詞'}</button>
        <label htmlFor="raw-m" style={css('font-size: 14px; font-weight: 700')}>貼回 AI 的結果</label>
        <textarea id="raw-m" rows={5} value={raw} onChange={(e) => { setRaw(e.target.value); setRes(null); }} placeholder="長按貼上" className="num" style={css('font-size: 14px; line-height: 1.5; color: #1E2A44; border: 1px solid #DCE1E8; border-radius: 12px; padding: 10px 12px; resize: none; background: #FFFFFF')} />
        {res && 'error' in res && <p role="alert" style={css('margin: 0; padding: 10px 12px; border-radius: 10px; background: #F9E1DF; color: #B83A32; font-size: 13px; line-height: 1.6')}>{res.error}</p>}
        <div style={css('display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px')}>
          <button onClick={() => { setRaw(sampleResult(trip)); setRes(null); }} style={css(btn)}>貼上示範結果</button>
          <button onClick={() => setRes(parseImport(raw, days, existing))} style={css('height: 48px; border-radius: 12px; border: 0; background: #1E2A44; color: #FFFFFF; font: inherit; font-size: 15px; font-weight: 700')}>檢查內容</button>
        </div>
      </> : <>
        <p style={css('margin: 0; font-size: 14px; color: #5B6578')}>勾選要加入的卡片{res && 'skipped' in res && res.skipped ? '（' + res.skipped + ' 筆缺日期或名稱，已略過）' : ''}</p>
        <div style={css('display: flex; flex-direction: column')}>
          {rows.map((r, i) => (
            <label key={i} style={css('display: flex; align-items: flex-start; gap: 12px; padding: 12px 0; border-top: 1px solid #DCE1E8')}>
              <input type="checkbox" checked={r.checked} onChange={() => setRes({ rows: rows.map((x, k) => (k === i ? { ...x, checked: !x.checked } : x)), skipped: 'skipped' in res! ? res.skipped : 0 })} style={css('width: 22px; height: 22px; margin: 0; flex-shrink: 0; accent-color: #1E2A44')} />
              <span style={css('flex: 1; display: flex; flex-direction: column; gap: 2px')}>
                <span style={css('font-size: 15px; font-weight: 700')}>{r.title}</span>
                <span className="num" style={css('font-size: 13px; color: #5B6578')}>{r.date.slice(5).replace('-', '/')}{r.start && ' ' + r.start}，{TYPE_LABEL[r.type]}</span>
                {r.flag && <span style={css('font-size: 12px; font-weight: 700; color: #B83A32')}>{r.flag}</span>}
              </span>
            </label>
          ))}
        </div>
        <div style={css('display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px')}>
          <button onClick={() => setRes(null)} style={css(btn)}>重新貼上</button>
          <button disabled={!checked.length} onClick={() => done(checked)} style={css('height: 48px; border-radius: 12px; border: 0; font: inherit; font-size: 15px; font-weight: 700; ' + (checked.length ? 'background: #1E2A44; color: #FFFFFF' : 'background: #DCE1E8; color: #5B6578'))}>加入 {checked.length} 張</button>
        </div>
      </>}
    </DSheet>
  );
}

function EmptyTrip({ first, onImport, onAdd }: { first: boolean; onImport: () => void; onAdd: () => void }) {
  const b = 'height: 48px; box-sizing: border-box; border-radius: 12px; border: 1px solid #DCE1E8; background: #FFFFFF; color: #1E2A44; font: inherit; font-size: 14px; font-weight: 500; text-decoration: none; display: flex; align-items: center; justify-content: center';
  return <>
    <section aria-labelledby="empty-h" style={css('margin-top: 8px; padding: 28px 20px; border: 1.5px dashed #B8C0CC; border-radius: 18px; display: flex; flex-direction: column; gap: 14px')}>
      <svg aria-hidden="true" width="56" height="56" viewBox="0 0 56 56" fill="none"><rect x="6" y="12" width="44" height="34" rx="6" stroke="currentColor" strokeWidth="2.5" /><path d="M6 22h44M18 6v10M38 6v10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /><circle cx="28" cy="34" r="5" fill="#F2C14E" /></svg>
      <div>
        <h2 id="empty-h" style={css('margin: 0; font-size: 20px; font-weight: 700')}>{first ? '第一天還是空的' : '這天還是空的'}</h2>
        <p style={css('margin: 6px 0 0; font-size: 14px; line-height: 1.6; color: #5B6578')}>先把訂好的機票和飯店放進來，再慢慢加想去的地方。</p>
      </div>
      <button onClick={onImport} style={css('height: 52px; border-radius: 14px; border: 0; background: #1E2A44; color: #FFFFFF; font: inherit; font-size: 15px; font-weight: 700')}>用 AI 匯入訂單</button>
      <div style={css('display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px')}>
        <a href={href('library')} style={css(b)}>從景點庫加入</a>
        <button onClick={onAdd} style={css(b)}>自己新增</button>
      </div>
    </section>
    <a href={href('past')} style={css('font-size: 14px; color: #5B6578; text-align: center; padding: 12px')}>或從過去的旅行複製景點</a>
  </>;
}

/** 時間軸 (Itinerary)：每小時 50px */
function Timeline({ days, sel, items, routes, pick, poolCount, onAdd }: { days: string[]; sel: string; items: Item[]; routes: Route[]; pick: (k: string) => void; poolCount: number; onAdd: () => void }) {
  const list = items.filter((i) => i.date === sel && !isNaN(toMin(i.start))).sort(byTime);
  const untimed = items.filter((i) => i.date === sel && isNaN(toMin(i.start)));
  const PX = 50 / 60;
  const startH = list.length ? Math.floor(Math.min(...list.map((i) => toMin(i.start))) / 60) : 8;
  const endH = list.length ? Math.ceil(Math.max(...list.map((i) => toMin(i.end || i.start) || toMin(i.start) + 30)) / 60) : 18;
  const hours = Array.from({ length: Math.max(endH - startH, 4) + 1 }, (_, k) => startH + k);
  const y = (m: number) => (m - startH * 60) * PX;
  const many = days.length > 5;

  const shift = async (fromId: string, mins: number) => {
    const later = list.slice(list.findIndex((i) => i.id === fromId));
    const f = (t: string) => (isNaN(toMin(t)) ? t : fmt(Math.min(toMin(t) + mins, 1439)));
    await db.transaction('rw', db.items, async () => { for (const i of later) await db.items.update(i.id, { start: f(i.start), end: f(i.end) }); });
  };

  return <>
    <div role="tablist" aria-label="選擇日期" className="noscrollbar" style={css(many ? 'display: flex; gap: 6px; overflow-x: auto; margin: 0 -20px; padding: 0 20px' : 'display: grid; grid-template-columns: repeat(' + days.length + ', minmax(0, 1fr)); gap: 6px')}>
      {days.map((d) => {
        const on = d === sel;
        const empty = !items.some((i) => i.date === d);
        return (
          <button key={d} role="tab" aria-selected={on} onClick={() => pick(d)} style={css((many ? 'flex: 0 0 auto; min-width: 56px; ' : '') + 'height: 56px; border-radius: 12px; font: inherit; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; ' + (on ? 'border: 0; background: #1E2A44; color: #FFFFFF' : empty ? 'border: 1px dashed #B8C0CC; background: transparent; color: #1E2A44' : 'border: 0; background: #FFFFFF; color: #1E2A44'))}>
            <span className="num" style={css('font-size: 18px; font-weight: 700' + (on ? '; color: var(--ticket)' : ''))}>{md(d).split('/')[1]}</span>
            <span style={css('font-size: 11px' + (on ? '' : '; color: #5B6578'))}>{empty && !on ? '還沒排' : weekday(d)}</span>
          </button>
        );
      })}
    </div>

    {!list.length && <p style={css('margin: 0; padding: 24px 12px; border: 1.5px dashed #B8C0CC; border-radius: 12px; text-align: center; font-size: 14px; color: #5B6578')}>這天還沒有排時間的行程</p>}
    {!!list.length && (
      <section aria-label={md(sel) + ' 時間軸'} style={{ position: 'relative', height: (hours.length - 1) * 50 + 10, marginBottom: 76 }}>
        <ol aria-hidden="true" style={css('list-style: none; margin: 0; padding: 0; position: absolute; inset: 0')}>
          {hours.map((h, k) => <li key={h} className="num" style={{ ...css('position: absolute; left: 0; right: 0; height: 50px; border-top: 1px solid #DCE1E8; font-size: 11px; color: #5B6578; padding-top: 2px; box-sizing: border-box'), top: k * 50 }}>{String(h).padStart(2, '0')}:00</li>)}
        </ol>
        {list.map((it, k) => {
          const s = toMin(it.start), e = toMin(it.end) > s ? toMin(it.end) : s + 30;
          const top = y(s) + 2, h = Math.max((e - s) * PX - 4, 44);
          const prev = list[k - 1];
          const overlap = prev ? toMin(prev.end) - s : 0;
          const alert = overlap > 0 ? <p role="alert" style={{ ...css('position: absolute; left: 52px; right: 0; margin: 0; height: 30px; box-sizing: border-box; display: flex; align-items: center; gap: 6px; padding: 0 2px 0 10px; border-radius: 8px; background: #F9E1DF; color: #B83A32; font-size: 12px; font-weight: 700; z-index: 1'), top: top - 32 }}>
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9L2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>
            <span style={css('flex: 1')}>{prev.type === 'transit' ? '交通要 ' + (toMin(prev.end) - toMin(prev.start)) + ' 分，只排了 ' + (s - toMin(prev.start)) + ' 分' : '和上一個行程重疊 ' + overlap + ' 分鐘'}</span>
            <button onClick={() => shift(it.id, overlap)} style={css('height: 26px; padding: 0 8px; border-radius: 6px; border: 0; background: #B83A32; color: #fff; font: inherit; font-size: 11px; font-weight: 700')}>後面全部延後 {overlap} 分</button>
          </p> : null;
          if (it.type === 'transit') {
            const rs = routes.filter((r) => r.itemId === it.id).length;
            return <div key={it.id}>{alert}
              <a href={href('transit', it.id)} style={{ ...css('position: absolute; left: 52px; right: 0; height: 44px; display: flex; align-items: center; gap: 8px; padding-left: 12px; font-size: 12px; color: #5B6578; text-decoration: none'), top: top + Math.max(0, (h - 44) / 2) }}>
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13" cy="4" r="2" /><path d="M10 22l2-7 3 3v4M8 12l3-4 3 3 3 1" /></svg>
                <span>{routeMeta(it, routes) || it.title}</span>
                <span style={css('margin-left: auto; font-weight: 700; color: #1E2A44; background: #EEF1F5; padding: 3px 8px; border-radius: 10px')}>{rs ? rs + ' 條路線，看班次' : '加入交通方式'}</span>
              </a>
            </div>;
          }
          const none = it.booking === 'none';
          const sub = [it.watch?.length ? '想看 ' + it.watch.length + ' 項' : '', it.note ? '筆記 1 則' : ''].filter(Boolean).join('，');
          return <div key={it.id}>{alert}
            <a href={none ? href('bookings') : href('place', it.id)} style={{ ...css('position: absolute; left: 52px; right: 0; box-sizing: border-box; background: #FFFFFF; border-radius: 12px; padding: 10px 12px; text-decoration: none; color: #1E2A44; display: flex; justify-content: space-between; gap: 8px; overflow: hidden; box-shadow: 0 1px 2px rgba(30,42,68,0.12)' + (none ? '; border: 1.5px solid #E8B4AF' : '')), top, height: h }}>
              <span style={css('display: flex; flex-direction: column; gap: 4px; min-width: 0')}>
                <span className="num" style={css('font-size: 12px; color: #5B6578')}>{it.start} – {it.end || fmt(e)}</span>
                <span style={css('font-size: 16px; font-weight: 700')}>{it.title}</span>
                {sub && h > 80 && <span style={css('font-size: 12px; color: #5B6578')}>{sub}</span>}
              </span>
              {it.booking && <span style={{ ...pill(none ? '#F9E1DF' : it.booking === 'ordered' ? '#FBE9C0' : '#DDF1E8', none ? '#B83A32' : it.booking === 'ordered' ? '#8A5A00' : '#1F7A5C'), fontSize: 11, padding: '3px 8px', borderRadius: 10, alignSelf: 'flex-start' }}>{none ? '還沒訂' + (it.alts?.length ? '・' + it.alts.length + ' 個備案' : '') : BOOKING_LABEL[it.booking]}</span>}
            </a>
          </div>;
        })}
      </section>
    )}
    {!!untimed.length && <p style={css('margin: 0; font-size: 13px; color: #5B6578')}>另有 {untimed.length} 張卡片還沒設定時間，切到清單可以編輯。</p>}

    <div style={css('position: fixed; left: 0; right: 0; bottom: calc(100px + env(safe-area-inset-bottom) * 0); z-index: 20; max-width: 480px; margin: 0 auto; padding: 0 20px; box-sizing: border-box; display: flex; gap: 10px; pointer-events: none')}>
      <a href={href('library')} style={css('flex: 1; height: 52px; box-sizing: border-box; border-radius: 26px; border: 1px solid #DCE1E8; background: #FFFFFF; color: #1E2A44; font-size: 15px; font-weight: 500; text-decoration: none; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(30,42,68,0.12); pointer-events: auto')}>{poolCount ? <>排入 <span className="num" style={{ margin: '0 4px' }}>{poolCount}</span> 個還沒排的景點</> : '打開景點庫'}</a>
      <button aria-label="新增行程" onClick={onAdd} style={css('width: 52px; height: 52px; flex-shrink: 0; border-radius: 26px; border: 0; background: #1E2A44; color: #FFFFFF; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(30,42,68,0.18); pointer-events: auto')}>{I.plus}</button>
    </div>
  </>;
}
