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
  const [editing, setEditing] = useState<Item | 'new' | null>(null);
  if (!items || !routes) return null;

  const list = items.filter((i) => (sel === POOL ? i.date === null : i.date === sel)).sort(byTime);
  const clash = overlaps(list);
  const poolCount = items.filter((i) => i.date === null).length;

  const shift = async (fromId: string, mins: number) => {
    const later = list.slice(list.findIndex((i) => i.id === fromId));
    const f = (t: string) => { const m = toMin(t); return isNaN(m) ? t : String(Math.floor((m + mins) / 60)).padStart(2, '0') + ':' + String((m + mins) % 60).padStart(2, '0'); };
    await db.transaction('rw', db.items, async () => { for (const i of later) await db.items.update(i.id, { start: f(i.start), end: f(i.end) }); });
  };

  return (
    <main className="screen">
      <header>
        <p className="eyebrow num">{md(trip.start)} – {md(trip.end)}，{trip.people} 人</p>
        <h1>{trip.name}</h1>
      </header>

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

      <ol className="stack" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
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
      </ol>

      <button className="btn ghost" onClick={() => setEditing('new')}><Icon name="plus" size={18} />新增行程到 {sel === POOL ? '還沒排' : md(sel)}</button>

      {editing && <EditItem trip={trip} days={days} item={editing === 'new' ? null : editing} day={sel === POOL ? null : sel} onClose={() => setEditing(null)} />}
    </main>
  );
}

const BOOKABLE: ItemType[] = ['flight', 'hotel', 'ticket', 'restaurant', 'transit'];

function EditItem({ trip, days, item, day, onClose }: { trip: Trip; days: string[]; item: Item | null; day: string | null; onClose: () => void }) {
  const [f, setF] = useState<Item>(item ?? { id: uid(), tripId: trip.id, date: day, start: '', end: '', title: '', type: 'place' });
  const [err, setErr] = useState('');
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
      <label className="field">筆記<textarea value={f.note ?? ''} onChange={(e) => set({ note: e.target.value })} /></label>
      {f.type === 'transit' && item && <a className="btn" href={href('transit', item.id)} onClick={onClose}>交通方式、路線與班次<Icon name="chevron" size={18} /></a>}
      {err && <p className="error" role="alert">{err}</p>}
      {item && <button className="btn link" style={{ color: 'var(--warn)' }} onClick={remove}>刪除這張卡片</button>}
    </Sheet>
  );
}
