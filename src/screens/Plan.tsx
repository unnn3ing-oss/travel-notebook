import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid } from '../db';
import type { Item, ItemType, Route, Trip, Document } from '../types';
import { addDays, daysBetween, fmt, md, toMin, weekday } from '../lib/time';
import { orderedDay, saveEntries } from '../lib/entryStore';
import { isEntryKind } from '../lib/entries';
import { byTime } from '../lib/day';
import { href } from '../lib/route';
import { importPrompt, parseImport, sampleResult, type ImportRow } from '../lib/importer';
import { saveImport, ImportConflict } from '../lib/importStore';
import { css, DSheet, DToast, I, TabPage, Skeleton, SK } from '../design';
import { PlanBoard } from './Planner';
import { DestinationHeader } from '../components/DestinationHeader';
import { ItineraryCard } from '../components/ItineraryCard';
import { EntryArt } from '../components/TravelArt';
import { useDeviceDayPeriod } from '../lib/dayPeriod';

export const TYPE_LABEL: Record<ItemType, string> = { flight: '航班', transit: '交通', hotel: '住宿', ticket: '門票', restaurant: '餐廳', place: '景點', car: '租車', other: '其他' };
const NEWNAME: Record<ItemType, string> = { place: '新的景點', restaurant: '新的餐廳', transit: '從哪裡到哪裡', hotel: '住宿', flight: '航班', ticket: '門票', car: '租車', other: '新的行程' };
const MODE: Record<string, string> = { walk: '步行', train: '電車', bus: '巴士', car: '計程車', ferry: '渡輪', plane: '飛機' };
const POOL = 'pool';
type Snap = { put: Item[]; del: string[]; routes?: Route[]; documents?: Document[]; routeOwners?: string[] };

/** 一天的卡片：手動排過（order）就照手動順序，否則照時間 */
export function dayCards(items: Item[], key: string) {
  return orderedDay(items,key === POOL ? null : key);
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
  if (i.alts?.length) bits.push(i.alts.length + ' 個備案');
  return bits.join('，');
}

/** 設計稿「行程」：清單 (PlanList)、時間軸 (Itinerary)、空白 (EmptyPlan) */
export function Plan({ trip, day }: { trip: Trip; day?: string }) {
  const days = Array.from({ length: daysBetween(trip.start, trip.end) + 1 }, (_, i) => addDays(trip.start, i));
  const sel = day && (day === POOL || days.includes(day)) ? day : days[0];
  const items = useLiveQuery(() => db.items.where({ tripId: trip.id }).toArray(), [trip.id]);
  const routes = useLiveQuery(() => db.routes.toArray(), []);
  const dayPeriod = useDeviceDayPeriod();
  const [view, setView] = useState<'list' | 'timeline'>(() => (sessionStorage.getItem('plan-view') === 'timeline' ? 'timeline' : 'list'));
  const [sheet, setSheet] = useState<null | 'add' | 'import'>(null);
  const [toast, setToast] = useState<{ text: string; undo?: Snap } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  if (!items || !routes) return <Skeleton blocks={SK.plan} pad="52px 20px 16px" gap={10} />;

  const say = (text: string, undo?: Snap) => { setToast({ text, undo }); clearTimeout(timer.current); timer.current = setTimeout(() => setToast(null), 6000); };
  const snap = (ids: string[]): Snap => ({ put: items.filter((i) => ids.includes(i.id)).map((i) => ({ ...i })), del: [] });
  const undo = async (s: Snap) => {
    await db.transaction('rw', db.items, db.routes, db.documents, async () => {
      if (s.del.length) { await db.routes.where('itemId').anyOf(s.del).delete(); await db.documents.where({tripId:trip.id}).filter(d=>!!d.itemId&&s.del.includes(d.itemId)).delete(); await db.items.bulkDelete(s.del); }
      if (s.routeOwners?.length) await db.routes.where('itemId').anyOf(s.routeOwners).delete();
      await db.items.bulkPut(s.put);
      if (s.routes?.length) await db.routes.bulkPut(s.routes);
      if (s.documents?.length) await db.documents.bulkPut(s.documents);
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
  const add = async (type: ItemType) => {
    if (isEntryKind(type)) { location.hash=href('add',type,sel); setSheet(null); return; }
    const it: Item = { id: uid(), tripId: trip.id, date: sel === POOL ? null : sel, start: '', end: '', title: NEWNAME[type], type, order: list.length, ...(type !== 'place' && type !== 'other' ? { booking: 'none' as const } : {}) };
    await saveEntries([it]);
    setSheet(null);
    location.hash=href('item',it.id);
  };
  const doImport = async (rows: ImportRow[]) => {
    const result = await saveImport(rows,trip);
    setSheet(null);
    if (result.items[0]) pick(result.items[0].date ?? POOL);
    const text = result.overwritten ? `已新增 ${result.added} 張卡片、覆蓋 ${result.overwritten} 筆行程` : result.added ? `已加入 ${result.added} 張卡片` : '已忽略，原行程未變更';
    say(text, result.items.length ? result.undo : undefined);
  };

  const tripEmpty = items.length === 0;

  return (
    <TabPage pad="52px 20px 16px" gap={14}>
      <div className="desktop-board"><DestinationHeader trip={trip} items={items} period={dayPeriod}/><PlanBoard trip={trip} days={days} items={items} routes={routes} edit={(i) => (i === 'new' ? setSheet('add') : location.hash=href('item',i.id))} /></div>
      <div className="mobile-plan">
        <DestinationHeader trip={trip} items={items} period={dayPeriod}/>
        {view==='timeline' && !tripEmpty ? <TimelineDays days={days} sel={sel===POOL?days[0]:sel} items={items} pick={pick}/> : <DayTabs days={days} sel={sel} pick={pick}/>}
        {!tripEmpty && <div className="plan-tools">
          <ViewSwitch view={view} setView={setV}/>
          <button type="button" className="plan-import" onClick={()=>setSheet('import')}>AI 匯入訂單</button>
        </div>}
        {view === 'timeline' && !tripEmpty
          ? <Timeline sel={sel === POOL ? days[0] : sel} items={items} routes={routes} poolCount={poolCount} onAdd={() => setSheet('add')} />
          : <>
            {tripEmpty ? <EmptyTrip first={sel === days[0]} onImport={() => setSheet('import')} onAdd={() => setSheet('add')} /> : <>
              <CardList key={sel} list={list} routes={routes} pool={sel === POOL} label={label(sel)} open={(i) => location.hash=href('item',i.id)} reorder={reorder} />
              {!list.length && <p style={css('margin: 0; padding: 24px 12px; border: 1.5px dashed #B8C0CC; border-radius: 12px; text-align: center; font-size: 14px; color: #5B6578')}>{sel === POOL ? '景點庫是空的，想去的地方可以先放這裡' : '這天還沒有行程'}</p>}
              <div style={css('display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; flex-shrink: 0')}>
                <button onClick={() => setSheet('add')} style={css('height: 48px; border-radius: 12px; border: 1px dashed #B8C0CC; background: transparent; color: #1E2A44; font: inherit; font-size: 15px')}>＋ 新增行程</button>
                <a href={href('library')} style={css('height: 48px; box-sizing: border-box; border-radius: 12px; border: 1px solid #DCE1E8; background: #FFFFFF; font-size: 15px; text-decoration: none; display: flex; align-items: center; justify-content: center')}>從景點庫加入</a>
              </div>
            </>}
          </>}
      </div>

      {(view === 'list' || tripEmpty) && <button type="button" className="plan-quick-add" aria-label="快速新增行程" onClick={()=>setSheet('add')}>{I.plus}</button>}
      {toast && <DToast text={toast.text} action={toast.undo ? '復原' : undefined} onAction={() => { const u = toast.undo!; setToast(null); undo(u); }} bottom={view === 'timeline' ? 164 : 100} />}

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

function ViewSwitch({ view, setView }: { view: string; setView: (v: 'list' | 'timeline') => void }) {
  return <div className="plan-view-switch" role="group" aria-label="檢視方式">
    <button type="button" aria-pressed={view==='list'} onClick={()=>setView('list')}>清單</button>
    <button type="button" aria-pressed={view==='timeline'} onClick={()=>setView('timeline')}>時間軸</button>
  </div>;
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
    <ol className="connected-plan" ref={ol} aria-label={label + ' 的行程'} aria-description="長按卡片，上下拖曳排序" style={css('list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; ' + (drag ? 'touch-action: none' : ''))}
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
          <li className={'itinerary-list-entry '+(it.type === 'transit' ? 'connected-transit' : 'connected-stop')} key={it.id} data-idx={i} tabIndex={0} role="button" aria-label={'查看 ' + it.title}
            onPointerDown={(e) => {
              if (e.button) return;
              p.current = { x: e.clientX, y: e.clientY };
              clearTimeout(t.current);
              t.current = setTimeout(() => { if (!p.current) return; try { navigator.vibrate?.(12); } catch { /* ignore */ } setDrag({ from: realIdx, over: realIdx }); }, 380);
            }}
            onClick={() => { if (just.current) { just.current = false; return; } open(it); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(it); } }}
            onContextMenu={(e) => e.preventDefault()}
            style={lifted?{zIndex:2,transform:'scale(1.02)'}:undefined}>
            <span className="itinerary-time num">{it.start || '時間未定'}{it.end && it.end!==it.start && <small> – {it.end}</small>}</span>
            <span className={'itinerary-list-card'+(lifted?' is-lifted':'')+(warn?' has-time-warning':'')}>
              <ItineraryCard item={it} routes={routes}/>
              <span className="itinerary-card-grip" aria-hidden="true">{I.grip}</span>
              <span className="itinerary-card-chevron" aria-hidden="true">{I.chev}</span>
            </span>
            {(m || it.type==='transit') && <span className="itinerary-extra small muted">{it.type==='transit'?(rs?rs+' 條路線 · 查看班次':'加入交通方式與班次'):m}</span>}
            {warn && <span className="itinerary-time-warning">時間比上一張早，改時間或換順序</span>}

          </li>
        );
      })}
    </ol>
  );
}

function ImportSheet({ trip, days, items, close, done }: { trip: Trip; days: string[]; items: Item[]; close: () => void; done: (rows: ImportRow[]) => Promise<void> }) {
  const [raw, setRaw] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy,setBusy]=useState(false);
  const [failure,setFailure]=useState('');
  const [res, setRes] = useState<ReturnType<typeof parseImport> | null>(null);
  const rows = res && 'rows' in res ? res.rows : [];
  const checked = rows.filter((r) => r.checked);
  const existing = items;
  const overwrites = checked.filter(r=>!!r.duplicates?.length);
  const unresolved = overwrites.some(r=>!r.overwriteId);
  const changeRow = (index:number, patch:Partial<ImportRow>) => setRes({ rows:rows.map((r,k)=>k===index?{...r,...patch}:r), skipped:res&&'skipped'in res?res.skipped:0 });
  const btn = 'height: 48px; border-radius: 12px; border: 1px solid #DCE1E8; background: #FFFFFF; color: #1E2A44; font: inherit; font-size: 14px';
  return (
    <DSheet title="用 AI 匯入訂單" onClose={close}>
      {failure&&<p className="error" role="alert">{failure}</p>}
      {!rows.length ? <>
        <p style={css('margin: 0; font-size: 14px; line-height: 1.6; color: #5B6578')}>複製提示詞，搭配信件、Notion 內容或 PDF／圖片交給 AI 整理。信箱附件讀不到時，直接上傳原始 PDF 到同一個 AI 對話，完成核對後再把 JSON 貼回來。</p>
        <button onClick={async () => { try { await navigator.clipboard.writeText(importPrompt(trip)); setCopied(true); } catch { setCopied(false); alert(importPrompt(trip)); } }} style={css('height: 48px; border-radius: 12px; border: 0; background: #1E2A44; color: #FFFFFF; font: inherit; font-size: 15px; font-weight: 700')}>{copied ? '已複製提示詞' : '複製提示詞'}</button>
        <label htmlFor="raw-m" style={css('font-size: 14px; font-weight: 700')}>貼回 AI 的結果</label>
        <textarea id="raw-m" rows={5} value={raw} onChange={(e) => { setRaw(e.target.value); setRes(null); }} placeholder="長按貼上" className="num" style={css('font-size: 16px; line-height: 1.5; color: #1E2A44; border: 1px solid #DCE1E8; border-radius: 12px; padding: 10px 12px; resize: none; background: #FFFFFF')} />
        {res && 'error' in res && <p role="alert" style={css('margin: 0; padding: 10px 12px; border-radius: 10px; background: #F9E1DF; color: #B83A32; font-size: 13px; line-height: 1.6')}>{res.error}</p>}
        <div style={css('display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px')}>
          <button onClick={() => { setRaw(sampleResult(trip)); setRes(null); }} style={css(btn)}>貼上示範結果</button>
          <button onClick={() => setRes(parseImport(raw, days, existing))} style={css('height: 48px; border-radius: 12px; border: 0; background: #1E2A44; color: #FFFFFF; font: inherit; font-size: 15px; font-weight: 700')}>檢查內容</button>
        </div>
      </> : <>
        <p style={css('margin: 0; font-size: 14px; color: #5B6578')}>選擇要加入的卡片；重複行程預設忽略{res && 'skipped' in res && res.skipped ? '（' + res.skipped + ' 筆缺日期或名稱，已略過）' : ''}</p>
        <div style={css('display: flex; flex-direction: column')}>
          {rows.map((r, i) => (
            <div key={i} role="group" aria-label={r.title} style={css('display: flex; align-items: flex-start; gap: 12px; padding: 12px 0; border-top: 1px solid #DCE1E8')}>
              {r.duplicates?.length ? <span aria-hidden="true" style={css('width: 24px; height: 24px; border-radius: 12px; background: #FCEFC7; color: #1E2A44; text-align: center; flex-shrink: 0')}>↻</span> : <input aria-label={'加入 '+r.title} type="checkbox" checked={r.checked} onChange={() => changeRow(i,{checked:!r.checked})} style={css('width: 22px; height: 22px; margin: 0; flex-shrink: 0; accent-color: #1E2A44')} />}
              <span style={css('flex: 1; min-width: 0; overflow-wrap: anywhere; display: flex; flex-direction: column; gap: 2px')}>
                <span style={css('font-size: 15px; font-weight: 700')}>{r.title}</span>
                <span className="num" style={css('font-size: 13px; color: #5B6578')}>{r.date.slice(5).replace('-', '/')}{r.start && ' ' + r.start}，{TYPE_LABEL[r.type]}</span>
                {r.fields.flight && <span className="small muted num">航班：{[r.fields.flight.airline,r.fields.flight.flightNo].filter(Boolean).join(' ')||'未提供'} · 訂位：{r.fields.flight.reference||'未提供'}</span>}
                {r.fields.hotel && <span className="small muted">地址：{r.fields.hotel.address||'未提供'}<br/>入住 {r.fields.hotel.checkinDate} ／ 退房 {r.fields.hotel.checkoutDate||'未提供'}</span>}
                {!!r.fields.missingFields?.length && (r.duplicates?.length ? <details className="small muted"><summary>新資料缺少 {r.fields.missingFields.length} 項，覆蓋時保留原值</summary><span>{r.fields.missingFields.join('、')}</span></details> : <span className="small muted">未提供：{r.fields.missingFields.join('、')}</span>)}
                {r.flag && <span style={css('font-size: 12px; font-weight: 700; color: #8A5A00')}>{r.duplicates?.length?(r.checked?'將覆蓋選定行程':'已選忽略，保留原行程'):r.flag}</span>}
                {!!r.duplicates?.length&&r.target===null&&<span className="small" style={css('color: #B83A32')}>新日期不在旅程內，覆蓋後會移到未排程。</span>}
                {!!r.duplicates?.length && <>
                  <span className="small muted">{r.duplicates.length===1?`${r.duplicates[0].reason}：${r.duplicates[0].date} ${r.duplicates[0].title}`:`找到 ${r.duplicates.length} 筆候選，覆蓋前請選定原行程`}</span>
                  <select aria-label={'重複行程處理：'+r.title} value={r.checked?'overwrite':'ignore'} onChange={e=>changeRow(i,{checked:e.target.value==='overwrite'})} style={css('width: 100%; min-width: 0; height: 42px; padding: 0 10px; margin-top: 6px; border: 1px solid #DCE1E8; border-radius: 10px; background: #FFFFFF; color: #1E2A44; font: inherit; font-size: 14px')}>
                    <option value="ignore">忽略，保留原行程</option><option value="overwrite">覆蓋，更新原行程</option>
                  </select>
                  {r.checked&&r.duplicates.length>1&&<select aria-label={'覆蓋目標：'+r.title} value={r.overwriteId||''} onChange={e=>changeRow(i,{overwriteId:e.target.value||undefined})} style={css('width: 100%; min-width: 0; height: 42px; margin-top: 6px; border: 1px solid #DCE1E8; border-radius: 10px; background: #FFFFFF; color: #1E2A44; font: inherit; font-size: 14px')}>
                    <option value="">請選擇要覆蓋的原行程</option>{r.duplicates.map(m=><option key={m.id} value={m.id}>{m.date} {m.title}</option>)}
                  </select>}
                </>}
              </span>
            </div>
          ))}
        </div>
        {!!rows.some(r=>r.duplicates?.length)&&<p className="small muted" style={css('margin: 0; line-height: 1.7')}>覆蓋只更新有提供的資料，未提供的原資訊與附件會保留。新筆記會取代原筆記，完成後可按「復原」。<br/>將新增 {checked.length-overwrites.length} 筆、覆蓋 {overwrites.length} 筆，其餘忽略。</p>}
        <div style={css('display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px')}>
          <button onClick={() => setRes(null)} style={css(btn)}>重新貼上</button>
          <button disabled={busy||unresolved} onClick={async()=>{if(busy||unresolved)return;setBusy(true);setFailure('');try{await done(checked);}catch(error){setFailure(error instanceof ImportConflict?error.message:'匯入未成功，資料尚未寫入，請再試一次。');setBusy(false);}}} style={css('height: 48px; border-radius: 12px; border: 0; font: inherit; font-size: 15px; font-weight: 700; ' + (!unresolved ? 'background: #1E2A44; color: #FFFFFF' : 'background: #DCE1E8; color: #5B6578'))}>{busy?'儲存中…':unresolved?'請選覆蓋目標':!checked.length?'完成（全部忽略）':overwrites.length?`確認匯入 ${checked.length} 筆`:`加入 ${checked.length} 筆訂單`}</button>
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

function TimelineDays({days,sel,items,pick}: {days:string[];sel:string;items:Item[];pick:(day:string)=>void}) {
  const many=days.length>5;
  return (
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
  );
}

/** 時間軸 (Itinerary)：每小時 50px */
function Timeline({ sel, items, routes, poolCount, onAdd }: { sel: string; items: Item[]; routes: Route[]; poolCount: number; onAdd: () => void }) {
  const list = items.filter((i) => i.date === sel && !isNaN(toMin(i.start))).sort(byTime);
  const untimed = items.filter((i) => i.date === sel && isNaN(toMin(i.start)));
  const PX = 50 / 60;
  const startH = list.length ? Math.floor(Math.min(...list.map((i) => toMin(i.start))) / 60) : 8;
  const endH = list.length ? Math.ceil(Math.max(...list.map((i) => toMin(i.end || i.start) || toMin(i.start) + 30)) / 60) : 18;
  const hours = Array.from({ length: Math.max(endH - startH, 4) + 1 }, (_, k) => startH + k);
  const y = (m: number) => (m - startH * 60) * PX;

  const shift = async (fromId: string, mins: number) => {
    const later = list.slice(list.findIndex((i) => i.id === fromId));
    const f = (t: string) => (isNaN(toMin(t)) ? t : fmt(Math.min(toMin(t) + mins, 1439)));
    await db.transaction('rw', db.items, async () => { for (const i of later) await db.items.update(i.id, { start: f(i.start), end: f(i.end) }); });
  };

  return <>
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
              <a href={href('item', it.id)} style={{ ...css('position: absolute; left: 52px; right: 0; height: 44px; display: flex; align-items: center; gap: 8px; padding-left: 12px; font-size: 12px; color: #5B6578; text-decoration: none'), top: top + Math.max(0, (h - 44) / 2) }}>
                <EntryArt type="transit"/>
                <span>{routeMeta(it, routes) || it.title}</span>
                <span style={css('margin-left: auto; font-weight: 700; color: #1E2A44; background: #EEF1F5; padding: 3px 8px; border-radius: 10px')}>{rs ? rs + ' 條路線，看班次' : '加入交通方式'}</span>
              </a>
            </div>;
          }
          const none = it.booking === 'none';
          const sub = [it.watch?.length ? '想看 ' + it.watch.length + ' 項' : '', it.note ? '筆記 1 則' : ''].filter(Boolean).join('，');
          return <div key={it.id}>{alert}
            <a href={href('item', it.id)} style={{ ...css('position: absolute; left: 52px; right: 0; box-sizing: border-box; background: #FFFFFF; border-radius: 12px; padding: 0; text-decoration: none; color: #1E2A44; display: flex; justify-content: space-between; gap: 8px; overflow: hidden; box-shadow: 0 1px 2px rgba(30,42,68,0.12)' + (none ? '; border: 1.5px solid #E8B4AF' : '')), top, height: h }}>
              <span className={'timeline-card-content'+(h<85?' is-short':'')}><ItineraryCard item={it} routes={routes} compact showTime/>{sub && h>150 && <span className="small muted">{sub}</span>}</span>
            </a>
          </div>;
        })}
      </section>
    )}
    {!!untimed.length && <p style={css('margin: 0; font-size: 13px; color: #5B6578')}>另有 <span className="num">{untimed.length}</span> 張卡片還沒設定時間，切到清單可以編輯。</p>}

    <div style={css('position: fixed; left: 0; right: 0; bottom: calc(100px + env(safe-area-inset-bottom) * 0); z-index: 20; max-width: 480px; margin: 0 auto; padding: 0 20px; box-sizing: border-box; display: flex; gap: 10px; pointer-events: none')}>
      <a href={href('library')} style={css('flex: 1; height: 52px; box-sizing: border-box; border-radius: 26px; border: 1px solid #DCE1E8; background: #FFFFFF; color: #1E2A44; font-size: 15px; font-weight: 500; text-decoration: none; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(30,42,68,0.12); pointer-events: auto')}>{poolCount ? <>排入 <span className="num" style={{ margin: '0 4px' }}>{poolCount}</span> 個還沒排的景點</> : '打開景點庫'}</a>
      <button aria-label="新增行程" onClick={onAdd} style={css('width: 52px; height: 52px; flex-shrink: 0; border-radius: 26px; border: 0; background: #1E2A44; color: #FFFFFF; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(30,42,68,0.18); pointer-events: auto')}>{I.plus}</button>
    </div>
  </>;
}
