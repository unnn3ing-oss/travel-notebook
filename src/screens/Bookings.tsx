import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { BookingPill, Icon } from '../components/ui';
import { md, addDays, daysBetween } from '../lib/time';
import { PlanB } from './PlanB';
import { EditItem } from './Plan';
import type { Item, Trip } from '../types';

export function Bookings({ trip }: { trip: Trip }) {
  const items = useLiveQuery(() => db.items.where({ tripId: trip.id }).toArray(), [trip.id]);
  const [filter, setFilter] = useState('全部');
  const [edit, setEdit] = useState<Item | 'new' | null>(null);
  const [alt, setAlt] = useState<{item:Item;index:number} | null>(null);
  const types: Record<string,string[]> = { 全部: [], 交通: ['flight','transit'], 住宿: ['hotel'], 餐廳: ['restaurant'], 門票: ['ticket'] };
  const days = Array.from({length:daysBetween(trip.start,trip.end)+1}, (_,k) => addDays(trip.start,k));
  const bookings = (items ?? []).filter(i => i.booking && (filter === '全部' || types[filter].includes(i.type))).sort((a,b) => (a.date ?? 'z').localeCompare(b.date ?? 'z') || a.start.localeCompare(b.start));
  return <main className="screen"><header className="between"><h1>預訂</h1><button className="round-btn" aria-label="新增預訂" onClick={() => setEdit('new')}><Icon name="plus" /></button></header>
    <div className="chips" aria-label="預訂類型">{Object.keys(types).map(t => <button key={t} className="chip" aria-pressed={filter === t} onClick={() => setFilter(t)}>{t}</button>)}</div>
    {bookings.map(i => <article className="card booking-card" key={i.id}><button className="booking-open between" onClick={() => setEdit(i)}><span><small className="num muted">{i.date ? md(i.date) : '還沒排日期'} {i.start}</small><h2>{i.title}</h2></span><BookingPill status={i.booking} /></button>
      {i.orderNumber && <p className="small muted num">訂單編號 {i.orderNumber}</p>}
      {i.cancelBefore && <p className="small muted num">免費取消期限 {i.cancelBefore}</p>}
      {i.note && <p className="small muted">{i.note}</p>}
      {!!i.alts?.length && <section className="alternatives"><h3>備案：主方案不行時，照順序改用</h3>{i.alts.map((a,k) => <div key={k} className="alternative-row"><span className="alt-number num">{k + 1}</span><span className="stack" style={{flex:1,gap:2}}><b>{a.name}</b><small className="muted">{a.note || (a.status === 'confirmed' ? '訂單確認' : a.status === 'ordered' ? '已訂購' : '還沒訂')}</small></span><button className="btn small" onClick={() => setAlt({item:i,index:k})}>改用這個</button></div>)}</section>}
    </article>)}
    {!bookings.length && <section className="card empty-state"><Icon name="ticket" size={36}/><h2>把訂好的都放在這裡</h2><p className="small muted">機票、住宿、餐廳、門票，也可以先存備案。</p><button className="btn primary" onClick={() => setEdit('new')}>新增預訂</button></section>}
    {edit && <EditItem trip={trip} days={days} item={edit === 'new' ? null : edit} day={trip.start} onClose={() => setEdit(null)} defaultType="hotel" />}
    {alt && <PlanB item={alt.item} initialPick={alt.index} onClose={() => setAlt(null)} />}
  </main>;
}
