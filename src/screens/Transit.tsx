import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid } from '../db';
import type { BookingStatus, Mode, Route, Trip } from '../types';
import type { Clock } from '../lib/clock';
import { planTransit } from '../lib/plan';
import { byTime } from '../lib/day';
import { toMin, md } from '../lib/time';
import { href } from '../lib/route';
import { BackLink, BTN_PRIMARY, css, DSheet, DToast, FIELD_INPUT, FIELD_LABEL, I, pill, PILL_NONE, PILL_OK, PILL_ORDERED, Skeleton, SK } from '../design';

const MODES: [Mode, string][] = [['walk', '步行'], ['train', '電車'], ['bus', '巴士'], ['car', '計程車'], ['ferry', '渡輪'], ['rental', '租車'], ['plane', '飛機']];
const CUR: Record<string, string> = { JPY: '¥', KRW: '₩', THB: '฿', TWD: 'NT$', EUR: '€', USD: '$' };
const DOT: Record<Mode, string> = { walk: '#B8C0CC', train: '#1E2A44', bus: '#2F6FB0', car: '#F2C14E', rental: '#F2C14E', ferry: '#2F6FB0', plane: '#1E2A44' };
const STATUS: [BookingStatus, string][] = [['none', '還沒訂'], ['ordered', '已訂購'], ['confirmed', '訂單確認']];
const STATUS_PILL: Record<BookingStatus, React.CSSProperties> = { none: PILL_NONE, ordered: PILL_ORDERED, confirmed: PILL_OK };
const DEP_PILL = { ok: pill('#DDF1E8', '#1F7A5C'), hurry: css('font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 12px; background: var(--ticket); color: var(--on-ticket)'), late: pill('#F9E1DF', '#B83A32'), miss: pill('#F9E1DF', '#B83A32'), gone: pill('#EEF1F5', '#5B6578') };
const TICKET_KEYS: [keyof NonNullable<Route['ticket']>, string, string][] = [['ref', '預約編號', '例如：A12345'], ['company', '業者', '例如：車行、航空公司'], ['pickup', '上車地點', '例如：八條口計程車乘車處'], ['phone', '聯絡電話', ''], ['cancel', '取消規定', '例如：前一天 18:00 前免費']];
const OUTLINE_BTN = 'height: 44px; border-radius: 12px; border: 1px solid #DCE1E8; background: #FFFFFF; color: #1E2A44; font: inherit; font-size: 14px; font-weight: 500';
const ROW = 'display: flex; justify-content: space-between; align-items: center; gap: 12px; min-height: 40px; border-top: 1px solid #DCE1E8; font-size: 14px';

const byCar = (m: Mode) => m === 'car' || m === 'rental';

/** 設計稿「交通方式」(Transit) */
export function Transit({ trip, clock, itemId }: { trip: Trip; clock: Clock; itemId: string }) {
  const item = useLiveQuery(() => db.items.get(itemId), [itemId]);
  const routes = useLiveQuery(async () => (await db.routes.where({ itemId }).toArray()).sort((a, b) => Number(b.primary) - Number(a.primary)), [itemId]);
  const dayItems = useLiveQuery(async () => (item?.date ? db.items.where({ tripId: trip.id, date: item.date }).toArray() : []), [item?.date]);
  const docs = useLiveQuery(async () => (await db.documents.where({ tripId: trip.id }).toArray()).filter((d) => d.itemId === itemId).length, [trip.id, itemId]);
  const [sel, setSel] = useState<string | null>(null);
  const [depPick, setDepPick] = useState<Record<string, number>>({});
  const [sheet, setSheet] = useState<'' | 'add' | 'ticket' | 'pay'>('');
  const [addingDep, setAddingDep] = useState(false);
  const [toast, setToast] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  if (item === undefined || !routes || !dayItems) return <Skeleton blocks={SK.transit} pad="52px 20px 32px" />;
  if (!item) return <main style={css('padding: 52px 20px; display: flex; flex-direction: column; gap: 16px')}><BackLink to={href('plan')} label="返回行程" /><h1 style={css('margin: 0; font-size: 22px')}>找不到這張交通卡片</h1></main>;

  const cur = routes.find((r) => r.id === sel) ?? routes.find((r) => r.primary) ?? routes[0];
  const sorted = [...dayItems].sort(byTime);
  const at = sorted.findIndex((i) => i.id === item.id);
  const prev = sorted[at - 1];
  const isToday = item.date === clock.date;
  // 還沒到當天：先用前一站結束的時間試算
  const judgeAt = isToday ? clock.time : (prev?.end || item.start || '00:00');
  const plan = cur ? planTransit(item, [cur], judgeAt, depPick[cur.id]) : null;
  const sym = CUR[trip.currency] ?? '';
  const money = (n: number | null | undefined, r: Route) => (n == null ? '未填' : n === 0 ? '免費' : (byCar(r.mode) ? '約 ' : '') + sym + n.toLocaleString('en-US'));
  const transfers = (r: Route) => { if (byCar(r.mode)) return '直接載到門口'; const n = r.legs.filter((l) => l.mode !== 'walk').length; return n > 1 ? '轉乘 ' + (n - 1) + ' 次' : '不用轉乘'; };
  const depTitle = !cur ? '' : byCar(cur.mode) ? '預約時段' : cur.mode === 'walk' ? '出發時間' : '班次';

  const setPrimary = async (r: Route) => {
    await db.transaction('rw', db.routes, async () => { for (const x of routes) await db.routes.update(x.id, { primary: x.id === r.id }); });
  };
  const attach = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const f of Array.from(files)) await db.documents.add({ id: uid(), tripId: trip.id, name: f.name, file: f, itemId: item.id });
    setToast('已附上 ' + files.length + ' 張票券截圖，可在「必備」查看');
    setTimeout(() => setToast(''), 4000);
  };

  return (
    <main style={css('padding: calc(env(safe-area-inset-top) + 52px) 20px 32px; display: flex; flex-direction: column; gap: 16px')}>
      <div style={css('display: flex; justify-content: space-between; align-items: center')}>
        <BackLink to={href('plan', item.date ?? '')} label="返回行程" />
        <button onClick={() => setSheet('add')} style={css('height: 44px; padding: 0 16px; border-radius: 22px; border: 0; background: #1E2A44; color: #FFFFFF; font: inherit; font-size: 14px; font-weight: 700')}>＋ 新增路線</button>
      </div>

      <header style={css('background: var(--ticket-ink); color: #fff; border-radius: 16px; padding: 16px; display: grid; grid-template-columns: minmax(0, 1fr) 28px minmax(0, 1fr); align-items: center; gap: 8px')}>
        <div>
          <p style={css('margin: 0; font-size: 12px; color: #c9d1de')}>從</p>
          <h1 style={css('margin: 2px 0 0; font-size: 18px; font-weight: 700')}>{item.from || '出發地'}</h1>
          {prev?.end && <p className="num" style={css('margin: 2px 0 0; font-size: 12px; color: #c9d1de')}>前一站 {prev.end} 結束</p>}
        </div>
        <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f2c14e" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ justifySelf: 'center' }}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        <div style={css('text-align: right')}>
          <p style={css('margin: 0; font-size: 12px; color: #c9d1de')}>到</p>
          <p style={css('margin: 2px 0 0; font-size: 18px; font-weight: 700')}>{item.to || '目的地'}</p>
          {item.end && <p className="num" style={css('margin: 2px 0 0; font-size: 12px; color: #c9d1de')}>{item.end} 前要到</p>}
        </div>
      </header>

      {!routes.length || !cur ? (
        <section style={css('background: #FFFFFF; border-radius: 16px; padding: 16px; display: flex; flex-direction: column; gap: 10px')}>
          <h2 style={css('margin: 0; font-size: 16px; font-weight: 700')}>還沒有路線</h2>
          <p style={css('margin: 0; font-size: 14px; color: #5B6578')}>把查好的交通方式存進來，旅途中就能依目前時間判斷要搭哪一班。</p>
          <button onClick={() => setSheet('add')} style={css(BTN_PRIMARY)}>新增第一條路線</button>
        </section>
      ) : (
        <>
          <section aria-labelledby="routes-h" style={css('display: flex; flex-direction: column; gap: 8px')}>
            <h2 id="routes-h" style={css('margin: 0; font-size: 13px; font-weight: 500; color: #5B6578')}>已存的路線（<span className="num">{routes.length}</span> 條）</h2>
            <div role="radiogroup" aria-labelledby="routes-h" style={css('display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px')}>
              {routes.map((r) => {
                const on = r.id === cur.id;
                return (
                  <button key={r.id} role="radio" aria-checked={on} onClick={() => setSel(r.id)} style={css('min-height: 120px; padding: 10px; border-radius: 14px; font: inherit; text-align: left; display: flex; flex-direction: column; gap: 4px; ' + (on ? 'border: 0; background: var(--ticket-ink); color: #fff' : 'border: 1px solid #DCE1E8; background: #FFFFFF; color: #1E2A44'))}>
                    <span style={css('align-self: flex-start; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 8px; ' + (r.primary ? 'background: #DDF1E8; color: #1F7A5C' : on ? 'background: rgba(255,255,255,0.16); color: #fff' : 'background: #EEF1F5; color: #5B6578'))}>{r.primary ? '主方案' : '備案'}</span>
                    <span style={css('font-size: 14px; font-weight: 700; line-height: 1.3')}>{r.name}</span>
                    <span className="num" style={css('font-size: 13px')}>{r.minutes} 分</span>
                    <span className="num" style={css('font-size: 12px; ' + (on ? 'color: #c9d1de' : 'color: #5B6578'))}>{r.fare == null ? '費用未填' : money(r.fare, r)}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="detail-h" style={css('padding: 4px 0 0; display: flex; flex-direction: column; gap: 14px')}>
            <div style={css('display: flex; justify-content: space-between; align-items: flex-start; gap: 8px')}>
              <div>
                <h2 id="detail-h" style={css('margin: 0; font-size: 18px; font-weight: 700')}>{cur.name}</h2>
                <p className="num" style={css('margin: 2px 0 0; font-size: 13px; color: #5B6578')}>全程約 {cur.minutes} 分鐘，{transfers(cur)}</p>
              </div>
              {!cur.primary && <button onClick={() => setPrimary(cur)} style={css('height: 40px; flex-shrink: 0; padding: 0 12px; border-radius: 10px; border: 1px solid #DCE1E8; background: #FFFFFF; color: #1E2A44; font: inherit; font-size: 13px; font-weight: 500')}>設為主方案</button>}
            </div>
            <ol aria-label="路段" style={css('list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column')}>
              {cur.legs.map((l, k) => (
                <li key={k} style={css('display: flex; gap: 12px; min-height: 40px')}>
                  <span aria-hidden="true" style={css('width: 12px; height: 12px; margin-top: 4px; flex-shrink: 0; border-radius: 6px; background: ' + DOT[l.mode])} />
                  <span style={css('flex: 1; display: flex; justify-content: space-between; gap: 8px; font-size: 14px; padding-bottom: 10px')}><span>{l.label}</span><span className="num" style={css('color: #5B6578; flex-shrink: 0')}>{l.minutes} 分鐘</span></span>
                </li>
              ))}
            </ol>
          </section>

          {plan && (
            <section aria-labelledby="dep-h" style={css('background: #FFFFFF; border-radius: 16px; padding: 16px; display: flex; flex-direction: column; gap: 4px')}>
              <div style={css('display: flex; justify-content: space-between; align-items: center')}>
                <h2 id="dep-h" style={css('margin: 0; font-size: 16px; font-weight: 700')}>{depTitle}</h2>
                {cur.mode !== 'walk' && <button onClick={() => setAddingDep((v) => !v)} aria-expanded={addingDep} style={css('height: 40px; padding: 0 4px; border: 0; background: transparent; color: #1E2A44; font: inherit; font-size: 14px; font-weight: 500')}>＋ 自己加一個班次</button>}
              </div>
              <p style={css('margin: 0 0 6px; padding: 10px 12px; border-radius: 10px; background: #F4F6F9; font-size: 13px; line-height: 1.6; color: #1E2A44')}>
                {isToday
                  ? <>以目前時間 <span className="num" style={css('font-weight: 700')}>{clock.time}</span> 判斷。</>
                  : <>這天是 <span className="num">{item.date ? md(item.date) : '未排日期'}</span>，當天會以目前時間判斷；先用前一站結束的時間 <span className="num" style={css('font-weight: 700')}>{judgeAt}</span> 試算。</>}
                {plan.note && <><br />{plan.note}</>}
              </p>
              {addingDep && <AddDeparture route={cur} onDone={() => setAddingDep(false)} />}
              <div role="radiogroup" aria-labelledby="dep-h" style={css('display: flex; flex-direction: column')}>
                {plan.judged.map((j, i) => {
                  const past = j.kind === 'gone' || j.kind === 'miss';
                  const on = i === plan.pick;
                  return (
                    <label key={j.dep + i} style={css('display: flex; align-items: center; gap: 12px; min-height: 60px; padding: 6px 10px; margin: 0 -10px; border-radius: 10px; cursor: pointer; ' + (on ? 'background: #F4F6F9; box-shadow: inset 0 0 0 2px #1E2A44' : ''))}>
                      <input type="radio" name="dep" checked={on} onChange={() => setDepPick({ ...depPick, [cur.id]: i })} style={css('width: 20px; height: 20px; margin: 0; flex-shrink: 0; accent-color: #1E2A44')} />
                      <span style={css('flex: 1; display: flex; flex-direction: column; align-items: flex-start; gap: 4px')}>
                        <span className="num" style={css('font-size: 17px; font-weight: 700; ' + (past ? 'color: #5B6578; text-decoration: line-through' : ''))}>{j.leave} 出發去搭車</span>
                        <span className="num" style={css('font-size: 12px; color: #5B6578')}>{j.dep} 出發 → {j.arr} 抵達，{j.info}</span>
                        <span className="num" style={DEP_PILL[j.kind]}>{j.status}</span>
                      </span>
                    </label>
                  );
                })}
                {!plan.judged.length && <p style={css('margin: 0; font-size: 14px; color: #5B6578')}>還沒有班次。按「自己加一個班次」輸入時刻表上的時間。</p>}
              </div>
            </section>
          )}

          <section aria-labelledby="fare-h" style={css('display: flex; flex-direction: column')}>
            <h2 id="fare-h" style={css('margin: 0 0 4px; font-size: 16px; font-weight: 700')}>費用</h2>
            <div style={css(ROW)}><span style={css('color: #5B6578')}>{byCar(cur.mode) ? '預估車資（一台）' : '單人車資'}</span><span className="num">{money(cur.fare, cur)}</span></div>
            <button onClick={() => setSheet('pay')} style={css('font: inherit; ' + ROW + '; width: 100%; padding: 0; border-left: 0; border-right: 0; border-bottom: 0; background: transparent; color: #1E2A44; text-align: left')}>
              <span style={css('color: #5B6578')}>付款方式</span>
              <span style={css('display: flex; align-items: center; gap: 4px; ' + (cur.pay ? '' : 'color: #5B6578'))}>{cur.pay || '未填'}{I.chev}</span>
            </button>
            <div style={css('display: flex; justify-content: space-between; align-items: center; min-height: 44px; border-top: 1px solid #DCE1E8')}>
              <span style={css('font-size: 14px; font-weight: 700')}>{byCar(cur.mode) ? '合計（一台）' : <><span className="num">{trip.people}</span> 人合計</>}</span>
              <span className="num" style={css('font-size: 20px; font-weight: 700')}>{cur.fare == null ? '未填' : money(byCar(cur.mode) ? cur.fare : cur.fare * trip.people, cur)}</span>
            </div>
          </section>

          <section aria-labelledby="book-h" style={css('display: flex; flex-direction: column; gap: 8px')}>
            <div style={css('display: flex; justify-content: space-between; align-items: center')}>
              <h2 id="book-h" style={css('margin: 0; font-size: 16px; font-weight: 700')}>訂票資訊</h2>
              {cur.booking && <span style={STATUS_PILL[cur.booking]}>{STATUS.find((s) => s[0] === cur.booking)![1]}</span>}
            </div>
            {cur.booking ? (
              <>
                <div style={css('display: flex; flex-direction: column')}>
                  {TICKET_KEYS.filter(([k]) => cur.ticket?.[k]).map(([k, label]) => (
                    <div key={k} style={css(ROW)}><span style={css('color: #5B6578; flex-shrink: 0')}>{label}</span><span className="num" style={css('text-align: right')}>{cur.ticket![k]}</span></div>
                  ))}
                  {!TICKET_KEYS.some(([k]) => cur.ticket?.[k]) && <p style={css('margin: 0; font-size: 14px; color: #5B6578')}>還沒填預約編號、上車地點等資訊。</p>}
                  {!!docs && <div style={css(ROW)}><span style={css('color: #5B6578')}>票券截圖</span><a href={href('essentials')} className="num" style={css('color: #1E2A44')}>已附 {docs} 張</a></div>}
                </div>
                <div style={css('display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px')}>
                  <button onClick={() => setSheet('ticket')} style={css(OUTLINE_BTN)}>編輯訂票資訊</button>
                  <button onClick={() => fileRef.current?.click()} style={css(OUTLINE_BTN)}>附上票券截圖</button>
                  <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => { attach(e.target.files); e.target.value = ''; }} />
                </div>
              </>
            ) : (
              <>
                <p style={css('margin: 0; font-size: 14px; color: #5B6578')}>{cur.noBookNote || '這條路線不用訂票。'}</p>
                <button onClick={async () => { await db.routes.update(cur.id, { booking: 'none' }); setSheet('ticket'); }} style={css('height: 44px; border-radius: 12px; border: 1px dashed #B8C0CC; background: transparent; color: #1E2A44; font: inherit; font-size: 14px; font-weight: 500')}>＋ 新增訂票資訊</button>
              </>
            )}
          </section>
        </>
      )}

      {sheet === 'add' && <AddRoute itemId={item.id} sym={sym} hasPrimary={routes.some((r) => r.primary)} onClose={() => setSheet('')} onSaved={(id) => setSel(id)} />}
      {sheet === 'ticket' && cur && <TicketSheet route={cur} onClose={() => setSheet('')} />}
      {sheet === 'pay' && cur && <PaySheet route={cur} onClose={() => setSheet('')} />}
      {toast && <DToast text={toast} bottom={24} />}
    </main>
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
    <div style={css('display: flex; flex-direction: column; gap: 10px; padding: 4px 0 10px')}>
      <div style={css('display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px')}>
        <label style={css(FIELD_LABEL)}>出發<input type="time" className="num" value={dep} onChange={(e) => setDep(e.target.value)} style={css(FIELD_INPUT + '; padding: 0 6px')} /></label>
        <label style={css(FIELD_LABEL)}>抵達<input type="time" className="num" value={arr} onChange={(e) => setArr(e.target.value)} style={css(FIELD_INPUT + '; padding: 0 6px')} /></label>
      </div>
      <label style={css(FIELD_LABEL)}>備註（車種、月台）<input value={info} onChange={(e) => setInfo(e.target.value)} placeholder="例如：快速，32 號月台" style={css(FIELD_INPUT)} /></label>
      {err && <p role="alert" style={css('margin: 0; padding: 10px 12px; border-radius: 10px; background: #F9E1DF; color: #B83A32; font-size: 13px')}>{err}</p>}
      <button onClick={save} style={css(BTN_PRIMARY + '; height: 48px')}>加入這個班次</button>
    </div>
  );
}

function AddRoute({ itemId, sym, hasPrimary, onClose, onSaved }: { itemId: string; sym: string; hasPrimary: boolean; onClose: () => void; onSaved: (id: string) => void }) {
  const [mode, setMode] = useState<Mode>('train');
  const [name, setName] = useState('');
  const [dep, setDep] = useState('');
  const [arr, setArr] = useState('');
  const [fare, setFare] = useState('');
  const [needBook, setNeedBook] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    const n = name.trim().slice(0, 40);
    const d = toMin(dep), a = toMin(arr);
    if (!n) return setErr('請填路線名稱。');
    if (isNaN(d) || isNaN(a)) return setErr('請填出發和抵達時間。');
    if (a <= d) return setErr('抵達時間要比出發時間晚。');
    const id = uid();
    const label = MODES.find((x) => x[0] === mode)![1];
    await db.routes.add({
      id, itemId, name: n, mode, minutes: a - d, walk: 0, place: '',
      legs: [{ mode, label: label + '：' + n, minutes: a - d }], departures: [{ dep, arr, info: '自己新增的班次' }],
      fare: fare === '' ? null : Math.max(0, parseInt(fare, 10) || 0), booking: needBook ? 'none' : undefined, primary: !hasPrimary,
    });
    onSaved(id);
    onClose();
  };
  return (
    <DSheet title="新增路線" onClose={onClose}>
      <fieldset style={css('border: 0; margin: 0; padding: 0')}>
        <legend style={css('font-size: 13px; color: #5B6578; padding: 0; margin-bottom: 8px')}>交通方式</legend>
        <div style={css('display: flex; flex-wrap: wrap; gap: 8px')}>
          {MODES.map(([k, l]) => <button key={k} aria-pressed={mode === k} onClick={() => { setMode(k); setErr(''); }} style={css('height: 40px; padding: 0 14px; border-radius: 20px; font: inherit; font-size: 14px; ' + (mode === k ? 'border: 0; background: #1E2A44; color: #FFFFFF; font-weight: 700' : 'border: 1px solid #DCE1E8; background: #FFFFFF; color: #1E2A44'))}>{l}</button>)}
        </div>
      </fieldset>
      <label style={css(FIELD_LABEL)}>路線名稱<input value={name} onChange={(e) => { setName(e.target.value); setErr(''); }} placeholder="例如：阪急電車 河原町 → 嵐山" style={css(FIELD_INPUT)} /></label>
      <div style={css('display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px')}>
        <label style={css(FIELD_LABEL)}>出發<input type="time" className="num" value={dep} onChange={(e) => { setDep(e.target.value); setErr(''); }} style={css(FIELD_INPUT + '; padding: 0 6px; font-size: 15px')} /></label>
        <label style={css(FIELD_LABEL)}>抵達<input type="time" className="num" value={arr} onChange={(e) => { setArr(e.target.value); setErr(''); }} style={css(FIELD_INPUT + '; padding: 0 6px; font-size: 15px')} /></label>
        <label style={css(FIELD_LABEL)}>單人費用{sym ? '（' + sym + '）' : ''}<input type="number" inputMode="numeric" min="0" className="num" value={fare} onChange={(e) => setFare(e.target.value)} style={css(FIELD_INPUT + '; padding: 0 10px; font-size: 15px')} /></label>
      </div>
      <label style={css('display: flex; align-items: center; gap: 10px; min-height: 44px; font-size: 15px')}><input type="checkbox" checked={needBook} onChange={() => setNeedBook((v) => !v)} style={css('width: 22px; height: 22px; accent-color: #1E2A44')} />需要先訂票或預約</label>
      {err && <p role="alert" style={css('margin: 0; padding: 10px 12px; border-radius: 10px; background: #F9E1DF; color: #B83A32; font-size: 13px')}>{err}</p>}
      <button onClick={save} style={css(BTN_PRIMARY + '; height: 52px')}>{hasPrimary ? '儲存為備案路線' : '儲存為主方案'}</button>
    </DSheet>
  );
}

function TicketSheet({ route, onClose }: { route: Route; onClose: () => void }) {
  const [status, setStatus] = useState<BookingStatus>(route.booking ?? 'none');
  const [t, setT] = useState<NonNullable<Route['ticket']>>(route.ticket ?? {});
  const save = async () => {
    const ticket = Object.fromEntries(Object.entries(t).map(([k, v]) => [k, (v ?? '').trim()]).filter(([, v]) => v));
    await db.routes.update(route.id, { booking: status, ticket });
    onClose();
  };
  return (
    <DSheet title="訂票資訊" sub={route.name} onClose={onClose}>
      <fieldset style={css('border: 0; margin: 0; padding: 0')}>
        <legend style={css('font-size: 13px; color: #5B6578; padding: 0; margin-bottom: 8px')}>訂購狀態</legend>
        <div style={css('display: flex; flex-wrap: wrap; gap: 8px')}>
          {STATUS.map(([k, l]) => <button key={k} aria-pressed={status === k} onClick={() => setStatus(k)} style={css('height: 40px; padding: 0 16px; border-radius: 20px; font: inherit; font-size: 14px; ' + (status === k ? 'border: 0; background: #1E2A44; color: #FFFFFF; font-weight: 700' : 'border: 1px solid #DCE1E8; background: #FFFFFF; color: #1E2A44'))}>{l}</button>)}
        </div>
      </fieldset>
      {TICKET_KEYS.map(([k, label, ph]) => (
        <label key={k} style={css(FIELD_LABEL)}>{label}<input value={t[k] ?? ''} onChange={(e) => setT({ ...t, [k]: e.target.value })} placeholder={ph} inputMode={k === 'phone' ? 'tel' : undefined} style={css(FIELD_INPUT)} /></label>
      ))}
      <button onClick={save} style={css(BTN_PRIMARY + '; height: 52px')}>儲存</button>
      <button onClick={async () => { await db.routes.update(route.id, { booking: undefined, ticket: undefined }); onClose(); }} style={css('height: 44px; border: 0; background: transparent; color: #B83A32; font: inherit; font-size: 15px')}>這條路線不用訂票</button>
    </DSheet>
  );
}

function PaySheet({ route, onClose }: { route: Route; onClose: () => void }) {
  const [pay, setPay] = useState(route.pay ?? '');
  const save = async (e: React.FormEvent) => { e.preventDefault(); await db.routes.update(route.id, { pay: pay.trim() || undefined }); onClose(); };
  return (
    <DSheet title="付款方式" sub={route.name} onClose={onClose}>
      <form onSubmit={save} style={css('display: flex; flex-direction: column; gap: 14px')}>
        <label style={css(FIELD_LABEL)}>怎麼付<input value={pay} onChange={(e) => setPay(e.target.value)} placeholder="例如：IC 卡、現金、信用卡" list="pay-opts" style={css(FIELD_INPUT)} /></label>
        <datalist id="pay-opts">{['IC 卡', '現金', 'IC 卡或現金', '信用卡', '信用卡（車上付款）', '已預付'].map((o) => <option key={o} value={o} />)}</datalist>
        <button style={css(BTN_PRIMARY + '; height: 52px')}>儲存</button>
      </form>
    </DSheet>
  );
}
