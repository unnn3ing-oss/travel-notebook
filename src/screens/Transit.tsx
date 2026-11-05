import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid } from '../db';
import type { BookingStatus, Mode, Route, Trip } from '../types';
import type { Clock } from '../lib/clock';
import { planTransit } from '../lib/plan';
import { byTime } from '../lib/day';
import { toMin, md } from '../lib/time';
import { href } from '../lib/route';
import { BOOKING_HELP, BOOKING_LABEL, BookingPill, Icon, Sheet } from '../components/ui';

const MODES: [Mode, string][] = [['walk', '步行'], ['train', '電車'], ['bus', '巴士'], ['car', '計程車'], ['ferry', '渡輪'], ['plane', '飛機']];
const CUR: Record<string, string> = { JPY: '¥', KRW: '₩', THB: '฿', TWD: 'NT$', EUR: '€' };

export function Transit({ trip, clock, itemId }: { trip: Trip; clock: Clock; itemId: string }) {
  const item = useLiveQuery(() => db.items.get(itemId), [itemId]);
  const routes = useLiveQuery(async () => (await db.routes.where({ itemId }).toArray()).sort((a, b) => Number(b.primary) - Number(a.primary)), [itemId]);
  const dayItems = useLiveQuery(async () => (item?.date ? db.items.where({ tripId: trip.id, date: item.date }).toArray() : []), [item?.date]);
  const [sel, setSel] = useState<string | null>(null);
  const [depPick, setDepPick] = useState<Record<string, number>>({});
  const [adding, setAdding] = useState(false);
  const [addingDep, setAddingDep] = useState(false);

  if (item === undefined || !routes || !dayItems) return null;
  if (!item) return <main className="screen"><p>找不到這張交通卡片。</p><a className="btn" href={href('plan')}>回行程</a></main>;

  const cur = routes.find((r) => r.id === sel) ?? routes.find((r) => r.primary) ?? routes[0];
  const sorted = [...dayItems].sort(byTime);
  const prev = sorted[sorted.findIndex((i) => i.id === item.id) - 1];
  const nextItem = sorted[sorted.findIndex((i) => i.id === item.id) + 1];
  const isToday = item.date === clock.date;
  // before the trip day, judge against the start of the card so the list still reads sensibly
  const judgeAt = isToday ? clock.time : (prev?.end || item.start || '00:00');
  const plan = cur ? planTransit(item, [cur], judgeAt, depPick[cur.id]) : null;
  const sym = CUR[trip.currency] ?? '';
  const money = (n: number | null) => (n == null ? '未填' : (cur?.mode === 'car' ? '約 ' : '') + sym + n.toLocaleString('en-US'));

  const setPrimary = async (r: Route) => {
    await db.transaction('rw', db.routes, async () => {
      for (const x of routes) await db.routes.update(x.id, { primary: x.id === r.id });
    });
  };

  return (
    <main className="screen">
      <div className="between">
        <a className="btn small" href={href('plan', item.date ?? '')} aria-label="返回行程"><Icon name="back" /></a>
        <button className="btn small primary" onClick={() => setAdding(true)}><Icon name="plus" size={18} />新增路線</button>
      </div>

      <header className="card" style={{ background: '#1E2A44', color: '#fff', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 28px minmax(0,1fr)', alignItems: 'center' }}>
        <div>
          <p className="small" style={{ margin: 0, color: '#C9D1DE' }}>從</p>
          <h1 style={{ fontSize: 18, margin: '2px 0 0' }}>{item.from || '出發地'}</h1>
          {prev?.end && <p className="small num" style={{ margin: '2px 0 0', color: '#C9D1DE' }}>前一站 {prev.end} 結束</p>}
        </div>
        <span style={{ color: '#F2C14E' }}><Icon name="chevron" size={24} /></span>
        <div style={{ textAlign: 'right' }}>
          <p className="small" style={{ margin: 0, color: '#C9D1DE' }}>到</p>
          <p style={{ fontSize: 18, fontWeight: 700, margin: '2px 0 0' }}>{item.to || '目的地'}</p>
          {item.end && <p className="small num" style={{ margin: '2px 0 0', color: '#C9D1DE' }}>{item.end} 前要到</p>}
          {nextItem && <p className="small" style={{ margin: '2px 0 0', color: '#C9D1DE' }}>接{nextItem.title} {nextItem.start}</p>}
        </div>
      </header>

      {!routes.length ? (
        <section className="card">
          <h2>還沒有路線</h2>
          <p className="small muted" style={{ margin: 0 }}>把查好的交通方式存進來，旅途中就能依目前時間判斷要搭哪一班。</p>
          <button className="btn primary" onClick={() => setAdding(true)}>新增第一條路線</button>
        </section>
      ) : (
        <>
          <section className="stack" aria-labelledby="routes-h">
            <h2 id="routes-h" className="eyebrow">已存的路線（{routes.length} 條）</h2>
            <div className="route-pick" role="radiogroup" aria-labelledby="routes-h">
              {routes.map((r) => (
                <button key={r.id} className="route" role="radio" aria-checked={r.id === cur?.id} onClick={() => setSel(r.id)}>
                  <span className={'pill ' + (r.primary ? 'confirmed' : 'plain')} style={{ fontSize: 11, padding: '2px 8px' }}>{r.primary ? '主方案' : '備案'}</span>
                  <b style={{ fontSize: 14, lineHeight: 1.3 }}>{r.name}</b>
                  <span className="num small">{r.minutes} 分</span>
                  <span className="num small muted">{r.fare ? money(r.fare) : r.fare === 0 ? '免費' : '費用未填'}</span>
                </button>
              ))}
            </div>
          </section>

          {cur && (
            <section className="stack" aria-labelledby="detail-h">
              <div className="between" style={{ alignItems: 'flex-start' }}>
                <div>
                  <h2 id="detail-h" style={{ fontSize: 18 }}>{cur.name}</h2>
                  <p className="small muted num" style={{ margin: '2px 0 0' }}>全程約 {cur.minutes} 分鐘</p>
                </div>
                {!cur.primary && <button className="btn small" onClick={() => setPrimary(cur)}>設為主方案</button>}
              </div>
              <ol className="legs" aria-label="路段">
                {cur.legs.map((l, k) => (
                  <li key={k}><span className={'dot ' + l.mode} aria-hidden="true" /><span className="between" style={{ flex: 1 }}><span>{l.label}</span><span className="num muted">{l.minutes} 分鐘</span></span></li>
                ))}
              </ol>
            </section>
          )}

          {cur && plan && (
            <section className="card" aria-labelledby="dep-h" style={{ gap: 4 }}>
              <div className="between">
                <h2 id="dep-h">{cur.mode === 'walk' ? '出發時間' : '班次'}</h2>
                {cur.mode !== 'walk' && <button className="btn link small" onClick={() => setAddingDep((v) => !v)}><Icon name="plus" size={16} />自己加一個班次</button>}
              </div>
              <p className="note" style={{ margin: '0 0 6px' }}>
                {isToday ? <>以目前時間 <b className="num">{clock.time}</b> 判斷。</> : <>這天是 {item.date ? md(item.date) : '未排日期'}，當天會以目前時間判斷；下面先用前一站結束的時間 <b className="num">{judgeAt}</b> 試算。</>}
                <br />{plan.note}
              </p>
              {addingDep && <AddDeparture route={cur} onDone={() => setAddingDep(false)} />}
              <div role="radiogroup" aria-labelledby="dep-h">
                {plan.judged.map((j, i) => {
                  const past = j.kind === 'gone' || j.kind === 'miss';
                  return (
                    <label key={j.dep + i} className={'dep' + (i === plan.pick ? ' on' : '') + (past ? ' past' : '')}>
                      <input type="radio" name="dep" checked={i === plan.pick} onChange={() => setDepPick({ ...depPick, [cur.id]: i })} />
                      <span className="stack" style={{ gap: 4, alignItems: 'flex-start' }}>
                        <span className="lead num">{j.leave} 出發去搭車</span>
                        <span className="small muted">{cur.mode === 'walk' ? j.info : j.dep + ' 出發 → ' + j.arr + ' 抵達，' + j.info}</span>
                        <span className={'pill ' + j.kind}>{j.status}</span>
                      </span>
                    </label>
                  );
                })}
                {!plan.judged.length && <p className="small muted">還沒有班次。按「自己加一個班次」輸入時刻表上的時間。</p>}
              </div>
            </section>
          )}

          {cur && (
            <section aria-labelledby="fare-h">
              <h2 id="fare-h" style={{ marginBottom: 4 }}>費用</h2>
              <ul className="list">
                <li className="between"><span className="muted">{cur.mode === 'car' ? '預估車資（一台）' : '單人費用'}</span><span className="num">{money(cur.fare)}</span></li>
                {cur.mode !== 'car' && cur.fare != null && <li className="between"><b>{trip.people} 人合計</b><b className="num" style={{ fontSize: 20 }}>{money(cur.fare * trip.people)}</b></li>}
              </ul>
            </section>
          )}

          {cur && cur.booking && (
            <section className="stack" aria-labelledby="book-h">
              <div className="between"><h2 id="book-h">訂票狀態</h2><BookingPill status={cur.booking} /></div>
              <StatusPicker value={cur.booking} onChange={(v) => db.routes.update(cur.id, { booking: v })} />
            </section>
          )}
        </>
      )}

      {adding && <AddRoute itemId={item.id} hasPrimary={routes.some((r) => r.primary)} onClose={() => setAdding(false)} onSaved={(id) => setSel(id)} />}
    </main>
  );
}

export function StatusPicker({ value, onChange }: { value: BookingStatus; onChange: (v: BookingStatus) => void }) {
  return (
    <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
      <legend className="visually-hidden">訂購狀態</legend>
      <div className="chips">
        {(Object.keys(BOOKING_LABEL) as BookingStatus[]).map((k) => (
          <button key={k} type="button" className="chip" aria-pressed={value === k} onClick={() => onChange(k)}>{BOOKING_LABEL[k]}</button>
        ))}
      </div>
      <p className="small muted" style={{ margin: '6px 0 0' }}>{BOOKING_LABEL[value]}：{BOOKING_HELP[value]}</p>
    </fieldset>
  );
}

function AddDeparture({ route, onDone }: { route: Route; onDone: () => void }) {
  const [dep, setDep] = useState('');
  const [arr, setArr] = useState('');
  const [info, setInfo] = useState('');
  const [err, setErr] = useState('');
  const save = async () => {
    if (isNaN(toMin(dep)) || isNaN(toMin(arr))) return setErr('請填出發和抵達時間。');
    if (toMin(arr) <= toMin(dep)) return setErr('抵達時間要比出發時間晚。');
    const departures = [...route.departures, { dep, arr, info: info.trim() || '自己新增的班次' }].sort((a, b) => toMin(a.dep) - toMin(b.dep));
    await db.routes.update(route.id, { departures });
    onDone();
  };
  return (
    <div className="stack" style={{ padding: '8px 0' }}>
      <div className="grid2">
        <label className="field">出發<input type="time" value={dep} onChange={(e) => setDep(e.target.value)} /></label>
        <label className="field">抵達<input type="time" value={arr} onChange={(e) => setArr(e.target.value)} /></label>
      </div>
      <label className="field">備註（車種、月台）<input value={info} onChange={(e) => setInfo(e.target.value)} placeholder="例如：快速，32 號月台" /></label>
      {err && <p className="error" role="alert">{err}</p>}
      <button className="btn primary" onClick={save}>加入這個班次</button>
    </div>
  );
}

function AddRoute({ itemId, hasPrimary, onClose, onSaved }: { itemId: string; hasPrimary: boolean; onClose: () => void; onSaved: (id: string) => void }) {
  const [mode, setMode] = useState<Mode>('train');
  const [name, setName] = useState('');
  const [minutes, setMinutes] = useState('');
  const [walk, setWalk] = useState('');
  const [place, setPlace] = useState('');
  const [fare, setFare] = useState('');
  const [needBook, setNeedBook] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    const n = name.trim().slice(0, 40);
    const m = parseInt(minutes, 10);
    if (!n) return setErr('請填路線名稱。');
    if (!(m > 0)) return setErr('請填大約要幾分鐘。');
    const id = uid();
    const label = MODES.find((x) => x[0] === mode)![1];
    await db.routes.add({
      id, itemId, name: n, mode, minutes: m, walk: mode === 'walk' ? 0 : Math.max(0, parseInt(walk, 10) || 0), place: mode === 'walk' ? '' : place.trim(),
      legs: [{ mode, label: label + '：' + n, minutes: m }], departures: [], fare: fare === '' ? null : Math.max(0, parseInt(fare, 10) || 0),
      booking: needBook ? 'none' : undefined, primary: !hasPrimary,
    });
    onSaved(id);
    onClose();
  };
  return (
    <Sheet title="新增路線" onClose={onClose}>
      <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
        <legend className="eyebrow" style={{ padding: 0, marginBottom: 8 }}>交通方式</legend>
        <div className="chips">{MODES.map(([k, l]) => <button key={k} className="chip" aria-pressed={mode === k} onClick={() => setMode(k)}>{l}</button>)}</div>
      </fieldset>
      <label className="field">路線名稱<input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：阪急電車 河原町 → 嵐山" /></label>
      <div className="grid2">
        <label className="field">全程幾分鐘<input inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} /></label>
        <label className="field">單人費用<input inputMode="numeric" value={fare} onChange={(e) => setFare(e.target.value)} placeholder="不知道就留空" /></label>
      </div>
      {mode !== 'walk' && (
        <div className="grid2">
          <label className="field">上車地點<input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="例如：32 號月台" /></label>
          <label className="field">走過去幾分鐘<input inputMode="numeric" value={walk} onChange={(e) => setWalk(e.target.value)} /></label>
        </div>
      )}
      <label className="check"><input type="checkbox" checked={needBook} onChange={() => setNeedBook((v) => !v)} /><span>需要先訂票或預約</span></label>
      {err && <p className="error" role="alert">{err}</p>}
      <button className="btn primary" onClick={save}>{hasPrimary ? '儲存為備案路線' : '儲存為主方案'}</button>
    </Sheet>
  );
}
