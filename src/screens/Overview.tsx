import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { Trip } from '../types';
import type { Clock } from '../lib/clock';
import { dueInfo } from '../lib/checklist';
import { daysBetween, md } from '../lib/time';
import { href } from '../lib/route';
import { BookingPill, Icon } from '../components/ui';

export function Overview({ trip, clock }: { trip: Trip; clock: Clock }) {
  const tasks = useLiveQuery(() => db.tasks.where({ tripId: trip.id }).toArray(), [trip.id]);
  const items = useLiveQuery(() => db.items.where({ tripId: trip.id }).toArray(), [trip.id]);
  if (!tasks || !items) return null;
  const left = daysBetween(clock.date, trip.start);
  const after = daysBetween(trip.end, clock.date) > 0;
  const open = tasks.filter((t) => !t.done).sort((a, b) => b.daysBefore - a.daysBefore).slice(0, 3);
  const done = tasks.filter((t) => t.done).length;
  const flight = items.filter((i) => i.type === 'flight' && i.date === trip.start).sort((a, b) => a.start.localeCompare(b.start))[0];
  const bookings = items.filter((i) => i.booking).sort((a, b) => (a.booking === 'none' ? -1 : 0) - (b.booking === 'none' ? -1 : 0)).slice(0, 4);

  return (
    <main className="screen">
      <header className="between" style={{alignItems:"flex-end"}}><div>
        <p className="eyebrow num">{md(trip.start)} – {md(trip.end)}，共 {daysBetween(trip.start, trip.end) + 1} 天</p>
        <h1>{trip.name}</h1>
      </div><a className="round-btn" href={href('')} aria-label="切換旅程"><Icon name="down" /></a></header>

      <section className="ticket" aria-label="出發倒數">
        <div style={{ flex: 1, padding: 20 }}>
          <p className="small" style={{ margin: 0, color: '#C9D1DE' }}>{after ? '這趟旅行' : '距離出發'}</p>
          <p style={{ margin: '6px 0 0', display: 'flex', alignItems: 'baseline', gap: 6 }}>
            {after ? <span style={{ fontSize: 24, fontWeight: 700 }}>已經結束</span> : <><span className="big-num">{left}</span><span>天</span></>}
          </p>
        </div>
        <div className="stub">
          <p className="small" style={{ margin: 0, color: '#C9D1DE' }}>去程航班</p>
          <p className="num" style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{flight ? flight.title.replace(/^去程\s*/, '') : '還沒加航班'}</p>
          {flight && <p className="num small" style={{ margin: 0, color: '#C9D1DE' }}>{md(flight.date!)} {flight.start} 起飛</p>}
        </div>
      </section>

      <section className="stack" aria-labelledby="prep-h">
        <div className="between">
          <h2 id="prep-h">出發前準備</h2>
          <a href={href('prep')} className="small" style={{ fontWeight: 500, padding: '10px 0' }}>看全部 {tasks.length} 項</a>
        </div>
        <div className="row">
          <div className="progress" role="progressbar" aria-label="準備進度" aria-valuenow={done} aria-valuemin={0} aria-valuemax={tasks.length}><span style={{ width: (done / Math.max(1, tasks.length)) * 100 + '%' }} /></div>
          <b className="num small">{done} / {tasks.length}</b>
        </div>
        <ul className="list">
          {open.map((t) => {
            const d = dueInfo({ start: trip.start, daysBefore: t.daysBefore, today: clock.date });
            return (
              <li key={t.id} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 0 }}>
                <label className="check"><input type="checkbox" checked={t.done} onChange={() => db.tasks.update(t.id, { done: !t.done })} /><span>{t.title}</span></label>
                <span className="small" style={{ marginLeft: 30, color: d.urgent ? 'var(--warn)' : 'var(--ink-2)', fontWeight: d.urgent ? 700 : 400 }}>{d.text}</span>
              </li>
            );
          })}
          {!open.length && <li className="muted">全部準備好了。</li>}
        </ul>
      </section>

      <section className="stack" aria-labelledby="bk-h">
        <div className="between">
          <h2 id="bk-h">預訂狀態</h2>
          <a href={href('bookings')} className="small" style={{ fontWeight: 500, padding: '10px 0' }}>看全部預訂</a>
        </div>
        <ul className="list">
          {bookings.map((i) => (
            <li key={i.id}>
              <span style={{ flex: 1 }}>{i.title}{!!i.alts?.length && <span className="small muted" style={{ display: 'block' }}>有 {i.alts.length} 個備案</span>}</span>
              <BookingPill status={i.booking} />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
