import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { Item, Trip } from '../types';
import type { Clock } from '../lib/clock';
import { splitDay } from '../lib/day';
import { planTransit } from '../lib/plan';
import { daysBetween, md, toMin, weekday } from '../lib/time';
import { href } from '../lib/route';
import { BookingPill, Icon } from '../components/ui';
import { PlanB } from './PlanB';

const mapsUrl = (q: string) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);

export function Today({ trip, clock }: { trip: Trip; clock: Clock }) {
  const items = useLiveQuery(() => db.items.where({ tripId: trip.id, date: clock.date }).toArray(), [trip.id, clock.date]);
  const routes = useLiveQuery(() => db.routes.toArray(), []);
  const [planB, setPlanB] = useState<Item | null>(null);
  const [showNote, setShowNote] = useState(false);
  if (!items || !routes) return null;

  const dayNo = daysBetween(trip.start, clock.date) + 1;
  const total = daysBetween(trip.start, trip.end) + 1;
  const { current, next, later } = splitDay(items, clock.time);
  const now = toMin(clock.time);

  // the next transit card decides when to leave
  const nextTransit = [current, next, ...later].find((i) => i?.type === 'transit') ?? null;
  const tPlan = nextTransit ? planTransit(nextTransit, routes.filter((r) => r.itemId === nextTransit.id), clock.time) : null;
  const leaveIn = tPlan?.leave ? toMin(tPlan.leave) - now : null;

  return (
    <main className="screen">
      <header>
        <p className="eyebrow">第 {dayNo} 天，共 {total} 天</p>
        <h1 className="num">{md(clock.date)} {weekday(clock.date)}</h1>
      </header>

      {nextTransit && tPlan?.leave && leaveIn !== null && leaveIn <= 60 && (
        <a className="banner" href={href('transit', nextTransit.id)}>
          <Icon name="clock" />
          <span><b className="num">{tPlan.leave}</b> 出發去{nextTransit.to || nextTransit.title}（{leaveIn === 0 ? '現在出發' : <>還有 <span className="num">{leaveIn}</span> 分鐘</>}）</span>
        </a>
      )}

      {current ? (
        <section className="card now" aria-labelledby="now-h">
          <div className="between">
            <span className="pill now">現在</span>
            <span className="num muted small">{current.start} – {current.end}</span>
          </div>
          <h2 id="now-h" style={{ fontSize: 24 }}>{current.title}</h2>
          {current.type === 'transit' ? (
            <b className="small"><span className="num">{current.end}</span> 前要到{current.to || ''}</b>
          ) : (
          <div className="row">
            <div className="progress ink" aria-hidden="true">
              <span style={{ width: Math.min(100, Math.max(0, ((now - toMin(current.start)) / (toMin(current.end) - toMin(current.start))) * 100)) + '%' }} />
            </div>
            <b className="small"><span className="num">{current.end}</span> 結束，還有 <span className="num">{toMin(current.end) - now}</span> 分鐘</b>
          </div>
          )}
          {!!current.watch?.length && <WatchList item={current} />}
          {current === nextTransit && tPlan?.judged[tPlan.pick] && (
            <>
              <p className="small muted" style={{ margin: 0 }}>{tPlan.note}</p>
              <span className={'pill ' + tPlan.judged[tPlan.pick].kind} style={{ alignSelf: 'flex-start' }}>{tPlan.judged[tPlan.pick].status}</span>
            </>
          )}
          {showNote && current.note && <p className="note" style={{ margin: 0 }}>{current.note}</p>}
          <div className="grid2">
            {current.note
              ? <button className="btn" aria-expanded={showNote} onClick={() => setShowNote((v) => !v)}>{showNote ? '收起筆記' : '看筆記'}</button>
              : <a className="btn" href={href('plan', clock.date)}>寫筆記</a>}
            {current.alts?.length
              ? <button className="btn danger" onClick={() => setPlanB(current)}>改用備案</button>
              : current.type === 'transit'
                ? <a className="btn primary" href={href('transit', current.id)}>看班次</a>
                : <a className="btn" href={mapsUrl(current.title)} target="_blank" rel="noreferrer">在地圖開啟</a>}
          </div>
        </section>
      ) : (
        <section className="card">
          <p className="eyebrow">現在</p>
          <h2>{next ? '空檔，下一個行程還沒開始' : '今天的行程都結束了'}</h2>
        </section>
      )}

      {next && <NextCard item={next} tPlan={next === nextTransit ? tPlan : null} onPlanB={() => setPlanB(next)} />}

      {!!later.length && (
        <section aria-labelledby="later-h">
          <h2 id="later-h" className="eyebrow" style={{ marginBottom: 4 }}>稍後</h2>
          <ul className="list">
            {later.map((i) => (
              <li key={i.id}>
                <span className="num muted small" style={{ width: 44 }}>{i.start}</span>
                <span style={{ flex: 1 }}>{i.title}</span>
                {i.booking === 'none' && i.alts?.length
                  ? <button className="pill none" style={{ border: 0, cursor: 'pointer' }} onClick={() => setPlanB(i)}>還沒訂・有 {i.alts.length} 個備案</button>
                  : <BookingPill status={i.booking} />}
              </li>
            ))}
          </ul>
        </section>
      )}

      {planB && <PlanB item={planB} onClose={() => setPlanB(null)} />}
    </main>
  );
}

function NextCard({ item, tPlan, onPlanB }: { item: Item; tPlan: ReturnType<typeof planTransit>; onPlanB: () => void }) {
  const j = tPlan?.judged[tPlan.pick];
  return (
    <section className="card" aria-labelledby="next-h">
      <div className="between">
        <span className="eyebrow">下一站</span>
        <span className="num muted small">{item.start}</span>
      </div>
      <div className="between">
        <h2 id="next-h" style={{ fontSize: 18 }}>{item.title}</h2>
        {item.type === 'transit'
          ? <a className="btn small primary" href={href('transit', item.id)}>看班次</a>
          : <a className="btn small primary" href={mapsUrl(item.title)} target="_blank" rel="noreferrer">導航到這裡</a>}
      </div>
      {tPlan && j && (
        <>
          <p className="small muted" style={{ margin: 0 }}>{tPlan.note}</p>
          <span className={'pill ' + j.kind} style={{ alignSelf: 'flex-start' }}>{j.status}</span>
        </>
      )}
      {item.booking && item.booking !== 'confirmed' && (
        <div className="between">
          <BookingPill status={item.booking} />
          {!!item.alts?.length && <button className="btn small danger" onClick={onPlanB}>改用備案</button>}
        </div>
      )}
    </section>
  );
}

function WatchList({ item }: { item: Item }) {
  const toggle = (k: number) => db.items.update(item.id, { watch: item.watch!.map((w, i) => (i === k ? { ...w, done: !w.done } : w)) });
  return (
    <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
      <legend className="eyebrow" style={{ padding: 0 }}>想看</legend>
      {item.watch!.map((w, k) => (
        <label key={k} className={'check' + (w.done ? ' done' : '')}>
          <input type="checkbox" checked={w.done} onChange={() => toggle(k)} />
          <span>{w.text}</span>
        </label>
      ))}
    </fieldset>
  );
}
