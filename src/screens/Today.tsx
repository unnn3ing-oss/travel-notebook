import { TravelInfo } from '../components/TravelInfo';
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { Item, Trip } from '../types';
import type { Clock } from '../lib/clock';
import { splitDay } from '../lib/day';
import { planTransit } from '../lib/plan';
import { daysBetween, md, toMin, weekday } from '../lib/time';
import { href } from '../lib/route';
import { BOOKING_LABEL } from '../components/ui';
import { css, I, pill, PILL_NONE, PILL_NOW, PILL_OK, TabPage, Skeleton, SK } from '../design';
import { PlanB } from './PlanB';

const mapsUrl = (q: string) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);

export function Today({ trip, clock }: { trip: Trip; clock: Clock }) {
  const items = useLiveQuery(() => db.items.where({ tripId: trip.id, date: clock.date }).toArray(), [trip.id, clock.date]);
  const routes = useLiveQuery(() => db.routes.toArray(), []);
  const [planB, setPlanB] = useState<Item | null>(null);
  if (!items || !routes) return <Skeleton blocks={SK.today} pad="52px 20px 12px" gap={10} />;

  const dayNo = daysBetween(trip.start, clock.date) + 1;
  const total = daysBetween(trip.start, trip.end) + 1;
  const { current, next, later } = splitDay(items, clock.time);
  const now = toMin(clock.time);

  // the next transit card decides when to leave
  const nextTransit = [current, next, ...later].find((i) => i?.type === 'transit') ?? null;
  const tPlan = nextTransit ? planTransit(nextTransit, routes.filter((r) => r.itemId === nextTransit.id), clock.time) : null;
  const leaveIn = tPlan?.leave ? toMin(tPlan.leave) - now : null;

  const card = 'background: #FFFFFF; border-radius: 16px; padding: 14px 16px; display: flex; flex-direction: column; gap: 6px';
  return (
    <TabPage pad="52px 20px 12px" gap={10}>
      <header>
        <p className="num" style={css('margin: 0; font-size: 13px; color: #5B6578')}>第 {dayNo} 天，共 {total} 天</p>
        <h1 className="num" style={css('margin: 4px 0 0; font-size: 28px; font-weight: 700')}>{md(clock.date)} {weekday(clock.date)}</h1>
      </header>

      {nextTransit && tPlan?.leave && leaveIn !== null && leaveIn >= 0 && leaveIn <= 60 && (
        <a href={href('reminders')} style={css('margin: 0; display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 12px; background: #FCEFC7; font-size: 14px; color: #1E2A44; text-decoration: none')}>
          {I.clock}
          <span><span className="num" style={css('font-weight: 700')}>{tPlan.leave}</span> 出發去{nextTransit.to || nextTransit.title}（{leaveIn === 0 ? '現在出發' : <>還有 <span className="num">{leaveIn}</span> 分鐘</>}）</span>
        </a>
      )}

      {current ? (
        <section aria-labelledby="now-h" style={css('background: #FFFFFF; border: 2px solid var(--ticket); border-radius: 18px; padding: 16px; display: flex; flex-direction: column; gap: 10px')}>
          <div style={css('display: flex; justify-content: space-between; align-items: center')}>
            <span style={PILL_NOW}>現在</span>
            <span className="num" style={css('font-size: 14px; color: #5B6578')}>{current.start} – {current.end}</span>
          </div>
          <h2 id="now-h" style={css('margin: 0; font-size: 24px; font-weight: 700')}>{current.title}</h2>
          {current.type === 'transit' ? (
            <span style={css('font-size: 14px; font-weight: 700')}><span className="num">{current.end}</span> 前要到{current.to || ''}</span>
          ) : (
            <div style={css('display: flex; align-items: center; gap: 10px')}>
              <div aria-hidden="true" style={css('flex: 1; height: 6px; border-radius: 3px; background: #EEF1F5; overflow: hidden')}>
                <div style={{ ...css('height: 100%; background: #1E2A44'), width: Math.min(100, Math.max(0, ((now - toMin(current.start)) / Math.max(1, toMin(current.end) - toMin(current.start))) * 100)) + '%' }} />
              </div>
              <span style={css('font-size: 14px; font-weight: 700')}><span className="num">{current.end}</span> 結束，還有 <span className="num">{toMin(current.end) - now}</span> 分鐘</span>
            </div>
          )}
          {!!current.watch?.length && <WatchList item={current} />}
          {current === nextTransit && tPlan?.judged[tPlan.pick] && (
            <>
              <p style={css('margin: 0; font-size: 14px; color: #5B6578')}>{tPlan.note}</p>
              <span style={{ ...judgePill(tPlan.judged[tPlan.pick].kind), alignSelf: 'flex-start' }}>{tPlan.judged[tPlan.pick].status}</span>
            </>
          )}
          <div style={css('display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px')}>
            <a href={href('place', current.id)} style={css(BTN2)}>{current.note ? '看筆記' : '寫筆記'}</a>
            {current.alts?.length
              ? <button onClick={() => setPlanB(current)} style={css('height: 48px; box-sizing: border-box; border-radius: 12px; border: 1px solid #E8B4AF; background: #FFFFFF; color: #B83A32; font: inherit; font-size: 15px; font-weight: 700')}>改用備案</button>
              : current.type === 'transit'
                ? <a href={href('transit', current.id)} style={css(BTN2)}>看班次</a>
                : <a href={mapsUrl(current.title)} target="_blank" rel="noreferrer" style={css(BTN2)}>在地圖開啟</a>}
          </div>
        </section>
      ) : (
        <section style={css(card)}>
          <span style={css('font-size: 13px; color: #5B6578')}>現在</span>
          <h2 style={css('margin: 0; font-size: 18px; font-weight: 700')}>{next ? '空檔，下一個行程還沒開始' : items.length ? '今天的行程都結束了' : '今天沒有排行程'}</h2>
        </section>
      )}

      {next && (() => {
        const j = next === nextTransit ? tPlan?.judged[tPlan.pick] : undefined;
        const walkPrev = next.type !== 'transit' ? [current, ...items].find((i) => i?.type === 'transit' && i.end === next.start) : undefined;
        return (
          <section aria-labelledby="next-h" style={css(card)}>
            <div style={css('display: flex; justify-content: space-between; align-items: baseline')}>
              <span style={css('font-size: 13px; color: #5B6578')}>下一站</span>
              <span className="num" style={css('font-size: 14px; color: #5B6578')}>{next.start}</span>
            </div>
            <div style={css('display: flex; justify-content: space-between; align-items: center; gap: 8px')}>
              <h2 id="next-h" style={css('margin: 0; font-size: 18px; font-weight: 700')}>{next.title}</h2>
              {next.type === 'transit'
                ? <a href={href('transit', next.id)} style={css(BTN_NAV)}>看班次</a>
                : <a href={mapsUrl(next.title)} target="_blank" rel="noreferrer" style={css(BTN_NAV)}>導航到這裡</a>}
            </div>
            {j && tPlan && <>
              <p style={css('margin: 0; font-size: 14px; color: #5B6578')}>{tPlan.note}</p>
              <span style={{ ...judgePill(j.kind), alignSelf: 'flex-start' }}>{j.status}</span>
            </>}
            {!j && walkPrev && <p style={css('margin: 0; font-size: 14px; color: #5B6578')}>{walkPrev.title}</p>}
            {next.booking === 'none' && !!next.alts?.length && (
              <button onClick={() => setPlanB(next)} style={{ ...PILL_NONE, border: 0, alignSelf: 'flex-start', cursor: 'pointer', font: 'inherit', fontSize: 12, fontWeight: 700 }}>還沒訂・有 <span className="num">{next.alts.length}</span> 個備案</button>
            )}
          </section>
        );
      })()}

      {!!later.length && (
        <section aria-labelledby="later-h">
          <h2 id="later-h" style={css('margin: 0 0 4px; font-size: 13px; font-weight: 500; color: #5B6578')}>稍後</h2>
          <ul style={css('list-style: none; margin: 0; padding: 0')}>
            {later.map((i) => (
              <li key={i.id} style={css('border-bottom: 1px solid #DCE1E8')}>
                {i.booking === 'none' && i.alts?.length ? (
                  <button onClick={() => setPlanB(i)} style={css('width: 100%; display: flex; align-items: center; gap: 14px; min-height: 48px; padding: 0; border: 0; background: transparent; color: #1E2A44; font: inherit; text-align: left; cursor: pointer')}>
                    <span className="num" style={css('width: 44px; font-size: 14px; color: #5B6578')}>{i.start}</span>
                    <span style={css('flex: 1; font-size: 15px')}>{i.title}</span>
                    <span style={PILL_NONE}>還沒訂・有 <span className="num">{i.alts.length}</span> 個備案</span>
                  </button>
                ) : (
                  <a href={i.type === 'transit' ? href('transit', i.id) : href('place', i.id)} style={css('display: flex; align-items: center; gap: 14px; min-height: 48px; text-decoration: none; color: #1E2A44')}>
                    <span className="num" style={css('width: 44px; font-size: 14px; color: #5B6578')}>{i.start}</span>
                    <span style={css('flex: 1; font-size: 15px')}>{i.title}{i.booking && i.booking !== 'none' && '（' + BOOKING_LABEL[i.booking] + '）'}</span>
                    {i.booking === 'none' && <span style={PILL_NONE}>還沒訂</span>}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {planB && <PlanB item={planB} onClose={() => setPlanB(null)} />}
      <TravelInfo key={trip.id} trip={trip} />
    </TabPage>
  );
}

const BTN2 = 'height: 48px; box-sizing: border-box; border-radius: 12px; border: 1px solid #DCE1E8; background: #FFFFFF; color: #1E2A44; font-size: 15px; font-weight: 500; text-decoration: none; display: flex; align-items: center; justify-content: center';
const BTN_NAV = 'height: 40px; flex-shrink: 0; padding: 0 14px; border-radius: 10px; border: 0; background: #1E2A44; color: #FFFFFF; font-size: 14px; font-weight: 700; text-decoration: none; display: flex; align-items: center';
export function judgePill(kind: string) {
  if (kind === 'ok') return PILL_OK;
  if (kind === 'hurry') return PILL_NOW;
  if (kind === 'gone') return pill('#EEF1F5', '#5B6578');
  return PILL_NONE;
}

function WatchList({ item }: { item: Item }) {
  const toggle = (k: number) => db.items.update(item.id, { watch: item.watch!.map((w, i) => (i === k ? { ...w, done: !w.done } : w)) });
  return (
    <fieldset style={css('border: 0; margin: 0; padding: 0; display: flex; flex-direction: column')}>
      <legend style={css('font-size: 13px; color: #5B6578; padding: 0; margin-bottom: 4px')}>想看</legend>
      {item.watch!.map((w, k) => (
        <label key={k} style={css('display: flex; align-items: center; gap: 10px; min-height: 34px; font-size: 15px')}>
          <input type="checkbox" checked={w.done} onChange={() => toggle(k)} style={css('width: 20px; height: 20px; accent-color: #1F7A5C')} /> {w.text}
        </label>
      ))}
    </fieldset>
  );
}
