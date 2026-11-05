import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid } from '../db';
import type { BookingStatus, Item, ItemType, Trip } from '../types';
import { addDays, daysBetween, md, toMin, weekday } from '../lib/time';
import { byTime, overlaps } from '../lib/day';
import { href } from '../lib/route';
import { BookingPill, Icon, Sheet } from '../components/ui';
import { StatusPicker } from './Transit';

const TYPES: [ItemType, string][] = [['place', '景點'], ['restaurant', '餐廳'], ['transit', '交通'], ['hotel', '住宿'], ['flight', '航班'], ['ticket', '門票'], ['other', '其他']];
const typeLabel = (t: ItemType) => TYPES.find((x) => x[0] === t)![1];
const POOL = 'pool';

export function Plan({ trip, day }: { trip: Trip; day?: string }) {
  const days = Array.from({ length: daysBetween(trip.start, trip.end) + 1 }, (_, i) => addDays(trip.start, i));
  const sel = day && (day === POOL || days.includes(day)) ? day : days[0];
  const items = useLiveQuery(() => db.items.where({ tripId: trip.id }).toArray(), [trip.id]);
  const routes = useLiveQuery(() => db.routes.toArray(), []);
  const [view, setView] = useState<'list' | 'timeline'>('list');
  const [editing, setEditing] = useState<Item | 'new' | null>(null);
  if (!items || !routes) return null;

  const list = items.filter((i) => (sel === POOL ? i.date === null : i.date === sel)).sort((a,b) => (a.order ?? toMin(a.start || '23:59')) - (b.order ?? toMin(b.start || '23:59')) || byTime(a,b));
  const clash = overlaps(list);
  const poolCount = items.filter((i) => i.date === null).length;

  const shift = async (fromId: string, mins: number) => {
    const later = list.slice(list.findIndex((i) => i.id === fromId));
    const f = (t: string) => { const m = toMin(t); return isNaN(m) ? t : String(Math.floor((m + mins) / 60)).padStart(2, '0') + ':' + String((m + mins) % 60).padStart(2, '0'); };
    await db.transaction('rw', db.items, async () => { for (const i of later) await db.items.update(i.id, { start: f(i.start), end: f(i.end) }); });
  };

  return (
    <main className="screen plan-screen">
      <header className="between"><h1>行程</h1><div className="view-toggle" aria-label="行程顯示方式">{([['list','清單'],['timeline','時間軸']] as const).map(([v,l]) => <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>{l}</button>)}</div></header>

      <div className="desktop-board"><PlanBoard trip={trip} days={days} items={items} edit={setEditing}/></div>
      <div className="mobile-plan">
      <div className="tabs" role="tablist" aria-label="選擇日期">
        {days.map((d) => (
          <a key={d} className="tab" role="tab" aria-selected={d === sel} href={href('plan', d)} style={{ textDecoration: 'none' }}>
            <span className="num" style={{ fontSize: 18, fontWeight: 700 }}>{md(d).split('/')[1]}</span><small>{weekday(d)}</small>
          </a>
        ))}
        <a className="tab pool" role="tab" aria-selected={sel === POOL} href={href('plan', POOL)} style={{ textDecoration: 'none' }}>
          <span className="num" style={{ fontSize: 18, fontWeight: 700 }}>{poolCount}</span><small>還沒排</small>
        </a>
      </div>

      <h2>{sel === POOL ? '還沒排進日期的地方' : md(sel) + ' ' + weekday(sel)}</h2>

      {!list.length && (
        <section className="card">
          <h2>{sel === POOL ? '每個地方都排好了' : '這天還沒有行程'}</h2>
          {sel !== POOL && <p className="small muted" style={{ margin: 0 }}>先放訂好的機票和飯店，再慢慢加想去的地方。</p>}
        </section>
      )}

      {view === 'timeline' && sel !== POOL && !!list.length ? <div className="timeline" aria-label="行程時間軸" style={{height: Math.max(600, (Math.max(...list.map(i => toMin(i.end || i.start) || 0), 1080) - 360) * 1.4)}}>
        {Array.from({length:19}, (_,k) => k + 6).map(h => <div className="timeline-hour" key={h} style={{top:(h*60-360)*1.4}}><span className="num">{String(h).padStart(2,'0')}:00</span><i/></div>)}
        {list.filter(i => i.start).map(i => <button key={i.id} className={'timeline-event '+i.type} style={{top:Math.max(0,(toMin(i.start)-360)*1.4), minHeight:44, height:Math.max(44, (toMin(i.end || i.start)-toMin(i.start))*1.4-6)}} onClick={() => setEditing(i)}><span className="num small">{i.start} – {i.end}</span><b>{i.title}</b>{i.booking && <BookingPill status={i.booking}/>}</button>)}
      </div> : <ol className="stack" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {list.map((i, k) => {
          const rs = routes.filter((r) => r.itemId === i.id);
          const prev = list[k - 1];
          const short = clash.has(i.id) && prev ? toMin(prev.end) - toMin(i.start) : 0;
          return (
            <li key={i.id} className="stack" style={{ gap: 6 }}>
              {short > 0 && (
                <p className="alert" role="alert" style={{ margin: 0 }}>
                  <Icon name="alert" size={16} />
                  <span style={{ flex: 1 }}>和上一個行程重疊 {short} 分鐘</span>
                  <button className="btn small" style={{ minHeight: 32, background: 'var(--warn)', color: '#fff', border: 0 }} onClick={() => shift(i.id, short)}>後面全部延後 {short} 分</button>
                </p>
              )}
              <div className={'plan-card' + (clash.has(i.id) ? ' warn' : '')}>
                <button className="plan-open" onClick={() => setEditing(i)} aria-label={'編輯 ' + i.title}>
                  <span className="time num">{i.start || '—'}</span>
                  <span className="body">
                    <span className="title">{i.title}</span>
                    <span className="small muted">{typeLabel(i.type)}{i.end ? '，到 ' + i.end : ''}{i.alts?.length ? '，' + i.alts.length + ' 個備案' : ''}</span>
                  </span>
                  <BookingPill status={i.booking} />
                </button>
                {i.type === 'transit' && (
                  <a className="route-link" href={href('transit', i.id)}>{rs.length ? rs.length + ' 條路線，看班次' : '加入交通方式與班次'}<Icon name="chevron" size={16} /></a>
                )}
              </div>
            </li>
          );
        })}
      </ol>}

      <a className="menu-link" href={href('library')}>排入 {poolCount} 個還沒排的景點<Icon name="chevron" /></a>
      <button className="btn ghost" onClick={() => setEditing('new')}><Icon name="plus" size={18} />新增行程到 {sel === POOL ? '還沒排' : md(sel)}</button>

      </div>
      {editing && <EditItem trip={trip} days={days} item={editing === 'new' ? null : editing} day={sel === POOL ? null : sel} onClose={() => setEditing(null)} />}
    </main>
  );
}

const BOOKABLE: ItemType[] = ['flight', 'hotel', 'ticket', 'restaurant', 'transit'];

export function EditItem({ trip, days, item, day, onClose, defaultType = 'place' }: { trip: Trip; days: string[]; item: Item | null; day: string | null; onClose: () => void; defaultType?: ItemType }) {
  const [f, setF] = useState<Item>(item ?? { id: uid(), tripId: trip.id, date: day, start: '', end: '', title: '', type: defaultType, ...(defaultType === 'hotel' ? { booking: 'none' as const } : {}) });
  const [err, setErr] = useState('');
  const [altName,setAltName] = useState('');
  const [altStatus,setAltStatus] = useState<BookingStatus>('none');
  const set = (p: Partial<Item>) => { setF({ ...f, ...p }); setErr(''); };
  const save = async () => {
    if (!f.title.trim()) return setErr('請填名稱。');
    if (f.start && f.end && toMin(f.end) <= toMin(f.start)) return setErr('結束時間要比開始時間晚。');
    await db.items.put({ ...f, title: f.title.trim() });
    onClose();
  };
  const remove = async () => {
    if (!item || !confirm('刪除「' + item.title + '」？')) return;
    await db.transaction('rw', db.items, db.routes, async () => {
      await db.items.delete(item.id);
      await db.routes.where({ itemId: item.id }).delete();
    });
    onClose();
  };
  return (
    <Sheet title={item ? '編輯行程' : '新增行程'} onClose={onClose} actions={<button className="btn small primary" onClick={save}>儲存</button>}>
      <label className="field">名稱<input value={f.title} onChange={(e) => set({ title: e.target.value })} style={{ fontWeight: 700 }} /></label>
      <label className="field">類型
        <select value={f.type} onChange={(e) => set({ type: e.target.value as ItemType })}>
          {TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </label>
      {f.type === 'transit' && (
        <div className="grid2">
          <label className="field">從<input value={f.from ?? ''} onChange={(e) => set({ from: e.target.value })} /></label>
          <label className="field">到<input value={f.to ?? ''} onChange={(e) => set({ to: e.target.value })} /></label>
        </div>
      )}
      <label className="field">日期
        <select value={f.date ?? POOL} onChange={(e) => set({ date: e.target.value === POOL ? null : e.target.value })}>
          {days.map((d) => <option key={d} value={d}>{md(d)} {weekday(d)}</option>)}
          <option value={POOL}>還沒排</option>
        </select>
      </label>
      <div className="grid2">
        <label className="field">開始<input type="time" value={f.start} onChange={(e) => set({ start: e.target.value })} /></label>
        <label className="field">{f.type === 'transit' ? '最晚抵達' : '結束'}<input type="time" value={f.end} onChange={(e) => set({ end: e.target.value })} /></label>
      </div>
      {BOOKABLE.includes(f.type) && (
        <div className="stack">
          <span className="eyebrow">訂購狀態</span>
          {f.booking
            ? <StatusPicker value={f.booking} onChange={(v: BookingStatus) => set({ booking: v })} />
            : <button className="btn small" style={{ alignSelf: 'flex-start' }} onClick={() => set({ booking: 'none' })}>這個需要先訂</button>}
        </div>
      )}
      {f.booking && <>
        <label className="field">訂單編號<input value={f.orderNumber ?? ''} onChange={e=>set({orderNumber:e.target.value})}/></label>
        <div className="grid2"><label className="field">費用（{trip.currency}）<input type="number" min="0" step="0.01" value={f.cost ?? ''} onChange={e=>set({cost:e.target.value ? Number(e.target.value) : undefined})}/></label><label className="field">免費取消期限<input type="date" value={f.cancelBefore ?? ''} onChange={e=>set({cancelBefore:e.target.value})}/></label></div>
        <section className="stack alternatives"><h2>備案</h2><p className="small muted">主方案不行時，照這個順序改用。</p>
          {(f.alts ?? []).map((a,k)=><div className="alternative-row" key={k}><span className="alt-number num">{k+1}</span><span style={{flex:1}}>{a.name}<small className="muted" style={{display:'block'}}>{a.status==='confirmed'?'訂單確認':a.status==='ordered'?'已訂購':'還沒訂'}</small></span><button className="btn small" aria-label={'移上 '+a.name} disabled={k===0} onClick={()=>{const alts=[...f.alts!];[alts[k-1],alts[k]]=[alts[k],alts[k-1]];set({alts});}}>↑</button><button className="btn small" aria-label={'移除 '+a.name} onClick={()=>set({alts:f.alts?.filter((_,i)=>i!==k)})}>移除</button></div>)}
          {!f.alts?.length&&<p className="small muted">還沒有備案。先存一個，主方案出狀況時可以直接換。</p>}
          <label className="field">新增備案<input value={altName} onChange={e=>setAltName(e.target.value)} placeholder="備案名稱"/></label>
          <div className="between"><label className="field">狀態<select value={altStatus} onChange={e=>setAltStatus(e.target.value as BookingStatus)}><option value="none">還沒訂</option><option value="ordered">已訂購</option><option value="confirmed">訂單確認</option></select></label><button className="btn" disabled={!altName.trim()} onClick={()=>{set({alts:[...(f.alts ?? []),{name:altName.trim(),status:altStatus}]});setAltName('');}}>加入備案</button></div>
        </section>
      </>}
      <label className="field">筆記<textarea value={f.note ?? ''} onChange={(e) => set({ note: e.target.value })} /></label>
      {f.type === 'transit' && item && <a className="btn" href={href('transit', item.id)} onClick={onClose}>交通方式、路線與班次<Icon name="chevron" size={18} /></a>}
      {err && <p className="error" role="alert">{err}</p>}
      {item && <button className="btn link" style={{ color: 'var(--warn)' }} onClick={remove}>刪除這張卡片</button>}
    </Sheet>
  );
}

function PlanBoard({trip,days,items,edit}: {trip:Trip;days:string[];items:Item[];edit:(item:Item|'new')=>void}) {
  const [drag,setDrag] = useState<string|null>(null);
  const [error,setError] = useState('');
  const sorted=(d:string|null)=>items.filter(i=>i.date===d).sort((a,b)=>(a.order??toMin(a.start||'23:59'))-(b.order??toMin(b.start||'23:59'))||byTime(a,b));
  async function drop(date:string|null,before?:string) {
    if(!drag)return; const item=items.find(i=>i.id===drag);if(!item)return;
    const list=sorted(date).filter(i=>i.id!==drag);const at=before?list.findIndex(i=>i.id===before):-1;list.splice(at<0?list.length:at,0,item);
    try{await db.transaction('rw',db.items,async()=>{for(const [order,i] of list.entries())await db.items.update(i.id,{date,order});});}catch{setError('卡片未能移動，請再試一次。');}setDrag(null);
  }
  return <><div className="between"><div><a href={href('overview')} className="small">回總覽</a><h2 style={{fontSize:24,marginTop:8}}>行程規劃：{trip.name}</h2><p className="small muted" style={{marginTop:8}}>拖曳卡片調整順序，點卡片就能編輯。拖曳只改順序，時間要另外調。</p></div><button className="btn primary" onClick={()=>edit('new')}><Icon name="plus"/>新增卡片</button></div>
    {error&&<p className="error" role="alert">{error}</p>}
    <div className="board-columns">{[...days,null].map(d=><section key={d??'pool'} className="board-column" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();drop(d);}}><header className="between"><h2>{d?md(d)+' '+weekday(d):'還沒排'}</h2><small className="num muted">{sorted(d).length} 張卡片</small></header>
      {sorted(d).map(i=><article key={i.id} className="board-card" draggable onDragStart={e=>{setDrag(i.id);e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',i.id);}} onDragEnd={()=>setDrag(null)} onDrop={e=>{e.preventDefault();e.stopPropagation();drop(d,i.id);}}><span className="small muted">⠿　{typeLabel(i.type)}</span><button onClick={()=>edit(i)}>{i.title}</button><span className="num small muted">{i.start||'還沒設定時間'}{i.end?' – '+i.end:''}</span><div className="between"><BookingPill status={i.booking}/><label className="small muted">移到<select aria-label={'移動 '+i.title} value={d??''} onChange={e=>db.items.update(i.id,{date:e.target.value||null,order:undefined})}><option value="">還沒排</option>{days.map(day=><option key={day} value={day}>{md(day)}</option>)}</select></label></div></article>)}
      {!sorted(d).length&&<div className="board-drop">把卡片拖到這裡</div>}
    </section>)}</div></>;
}
