import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { Item, Trip } from '../types';
import type { Clock } from '../lib/clock';
import { dueInfo } from '../lib/checklist';
import { daysBetween, md } from '../lib/time';
import { href } from '../lib/route';
import { css, I, PILL_NONE, TabPage, Skeleton, SK } from '../design';

const ICON: Partial<Record<Item['type'], keyof typeof I>> = { flight: 'plane', hotel: 'bed', transit: 'train', restaurant: 'food', ticket: 'ticket' };

/** 設計稿「總覽」(Main)：出發前的首頁 */
export function Overview({ trip, clock }: { trip: Trip; clock: Clock }) {
  const tasks = useLiveQuery(() => db.tasks.where({ tripId: trip.id }).toArray(), [trip.id]);
  const items = useLiveQuery(() => db.items.where({ tripId: trip.id }).toArray(), [trip.id]);
  if (!tasks || !items) return <Skeleton blocks={SK.overview} />;
  const left = daysBetween(clock.date, trip.start);
  const after = clock.date > trip.end;
  const open = tasks.filter((t) => !t.done).sort((a, b) => b.daysBefore - a.daysBefore).slice(0, 3);
  const done = tasks.filter((t) => t.done).length;
  const flight = items.filter((i) => i.type === 'flight' && i.date === trip.start).sort((a, b) => a.start.localeCompare(b.start))[0];
  // 還沒訂的一定要列出來，其餘依時間補滿 4 筆，再照時間排
  const chrono = (a: Item, b: Item) => (a.date ?? '').localeCompare(b.date ?? '') || a.start.localeCompare(b.start);
  const booked = items.filter((i) => i.booking).sort(chrono);
  const need = booked.filter((i) => i.booking === 'none');
  const bookings = [...need, ...booked.filter((i) => i.booking !== 'none')].slice(0, Math.max(4, need.length)).sort(chrono);

  return (
    <TabPage>
      <header style={css('display: flex; justify-content: space-between; align-items: flex-end')}>
        <div>
          <p className="num" style={css('margin: 0; font-size: 13px; color: #5B6578')}>{md(trip.start)} – {md(trip.end)}，共 {daysBetween(trip.start, trip.end) + 1} 天</p>
          <h1 style={css('margin: 4px 0 0; font-size: 28px; font-weight: 700')}>{trip.name}</h1>
        </div>
        <a href={href('')} aria-label="切換旅程" style={css('width: 44px; height: 44px; box-sizing: border-box; border-radius: 22px; border: 1px solid #DCE1E8; background: #FFFFFF; color: #1E2A44; display: flex; align-items: center; justify-content: center')}>{I.down}</a>
      </header>

      <section aria-label="出發倒數" style={css('position: relative; display: flex; background: var(--ticket-ink); color: #fff; border-radius: 16px')}>
        <div style={css('flex: 1; padding: 20px')}>
          <p style={css('margin: 0; font-size: 13px; color: #c9d1de')}>{after ? '這趟旅行' : left <= 0 ? '旅程進行中' : '距離出發'}</p>
          <p style={css('margin: 6px 0 0; display: flex; align-items: baseline; gap: 6px')}>
            {after || left <= 0
              ? <span style={css('font-size: 28px; font-weight: 700; line-height: 1.2; color: var(--ticket)')}>{after ? '已經結束' : '第 ' + (daysBetween(trip.start, clock.date) + 1) + ' 天'}</span>
              : <><span className="num" style={css('font-size: 56px; font-weight: 700; line-height: 1; color: var(--ticket)')}>{left}</span><span style={css('font-size: 16px')}>天</span></>}
          </p>
        </div>
        <div style={css('width: 132px; box-sizing: border-box; padding: 20px 16px; border-left: 2px dashed rgba(255,255,255,0.35); display: flex; flex-direction: column; justify-content: center; gap: 4px')}>
          <p style={css('margin: 0; font-size: 12px; color: #c9d1de')}>去程航班</p>
          {flight
            ? <><p className="num" style={css('margin: 0; font-size: 20px; font-weight: 700')}>{flight.flight ? flight.flight.from + ' → ' + flight.flight.to : flight.title.replace(/^去程\s*/, '')}</p>
              <p className="num" style={css('margin: 0; font-size: 12px; color: #c9d1de')}>{md(flight.date!)} {flight.start} 起飛</p></>
            : <a href={href('add','flight',trip.start)} style={css('margin: 0; font-size: 15px; font-weight: 700; color: var(--ticket)')}>加入航班</a>}
        </div>
        <span aria-hidden="true" style={css('position: absolute; top: -10px; right: 122px; width: 20px; height: 20px; border-radius: 10px; background: #F4F6F9')} />
        <span aria-hidden="true" style={css('position: absolute; bottom: -10px; right: 122px; width: 20px; height: 20px; border-radius: 10px; background: #F4F6F9')} />
      </section>

      <section aria-labelledby="prep-h" style={css('padding: 4px 0 0; display: flex; flex-direction: column; gap: 12px')}>
        <div style={css('display: flex; justify-content: space-between; align-items: center')}>
          <h2 id="prep-h" style={css('margin: 0; font-size: 16px; font-weight: 700')}>出發前準備</h2>
          <a href={href('prep')} style={css('font-size: 14px; font-weight: 500; padding: 10px 0')}>查看全部 <span className="num">{tasks.length}</span> 項</a>
        </div>
        <div style={css('display: flex; align-items: center; gap: 12px')}>
          <div role="progressbar" aria-label="準備進度" aria-valuenow={done} aria-valuemin={0} aria-valuemax={tasks.length} style={css('flex: 1; height: 8px; border-radius: 4px; background: #DCE1E8; overflow: hidden')}>
            <div style={{ ...css('height: 100%; background: #1F7A5C'), width: Math.round((done / Math.max(1, tasks.length)) * 100) + '%' }} />
          </div>
          <span className="num" style={css('font-size: 14px; font-weight: 700')}>{done} / {tasks.length}</span>
        </div>
        <ul style={css('list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column')}>
          {open.map((t) => {
            const d = dueInfo({ start: trip.start, daysBefore: t.daysBefore, today: clock.date });
            return (
              <li key={t.id} style={css('display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 44px; border-top: 1px solid #DCE1E8')}>
                <label style={css('display: flex; align-items: center; gap: 10px; font-size: 15px')}><input type="checkbox" checked={t.done} onChange={() => db.tasks.update(t.id, { done: !t.done })} style={css('width: 20px; height: 20px; flex-shrink: 0; accent-color: #1F7A5C')} /> {t.title}</label>
                <span className="num" style={css('font-size: 13px; text-align: right; white-space: nowrap; ' + (d.urgent ? 'font-weight: 700; color: #B83A32' : 'color: #5B6578'))}>{d.text}</span>
              </li>
            );
          })}
          {!open.length && <li style={css('display: flex; align-items: center; min-height: 44px; border-top: 1px solid #DCE1E8; font-size: 15px; color: #1F7A5C; font-weight: 700')}>全部準備好了</li>}
        </ul>
      </section>

      <section aria-labelledby="bk-h" style={css('display: flex; flex-direction: column; gap: 4px')}>
        <div style={css('display: flex; justify-content: space-between; align-items: center')}>
          <h2 id="bk-h" style={css('margin: 0; font-size: 16px; font-weight: 700')}>預訂狀態</h2>
          <a href={href('bookings')} style={css('font-size: 14px; font-weight: 500; padding: 10px 0')}>看全部預訂</a>
        </div>
        <ul style={css('list-style: none; margin: 0; padding: 0')}>
          {bookings.map((i) => {
            const alts = i.alts?.length ? (i.booking === 'none' ? '有 ' : '另有 ') + i.alts.length + ' 個備案' : '';
            return (
              <li key={i.id} style={css('display: flex; align-items: center; gap: 12px; min-height: 52px; border-top: 1px solid #DCE1E8')}>
                {I[ICON[i.type] ?? 'ticket']}
                <span style={css('flex: 1; font-size: 15px')}>{i.title}
                  <span style={css('display: block; font-size: 12px; color: #5B6578')}>
                    {i.booking === 'confirmed' && <span style={css('color: #1F7A5C')}>訂單確認</span>}
                    {i.booking === 'ordered' && <span style={css('color: #8A5A00')}>已訂購</span>}
                    {i.booking !== 'none' && alts && '，'}{alts}
                  </span>
                </span>
                {i.booking === 'none' && <span style={PILL_NONE}>還沒訂</span>}
              </li>
            );
          })}
          {!bookings.length && <li style={css('display: flex; align-items: center; min-height: 52px; border-top: 1px solid #DCE1E8; font-size: 14px; color: #5B6578')}>還沒有預訂，機票、住宿都可以在「預訂」加入。</li>}
        </ul>
      </section>
    </TabPage>
  );
}
