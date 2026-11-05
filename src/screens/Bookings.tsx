import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid } from '../db';
import { daysBetween, md } from '../lib/time';
import { href } from '../lib/route';
import { css, DToast, I, PILL_NONE, PILL_ORDERED, ROUND_PLUS, TabPage, Skeleton, SK } from '../design';
import type { Alternative, BookingStatus, Item, ItemType, Trip } from '../types';

const FILTERS: [string, ItemType[]][] = [['全部', []], ['交通', ['flight', 'transit', 'car']], ['住宿', ['hotel']], ['餐廳', ['restaurant']], ['門票', ['ticket']]];
const NEED: Partial<Record<ItemType, string>> = { hotel: '需先訂房', restaurant: '需先訂位' };

/** 主方案換成第 k 個備案；原本的放到備案第一個，隨時能換回 */
export function swapAlt(item: Item, k: number, reason = ''): Partial<Item> {
  const alts = item.alts ?? [];
  const chosen = alts[k];
  const original: Alternative = { name: item.title, status: item.booking ?? 'none', note: '原本的安排', ...(item.cancelBefore ? { cancelBefore: item.cancelBefore } : {}) };
  const back = item.replaced && item.replaced.title === chosen.name;
  return {
    title: chosen.name, booking: chosen.status, cancelBefore: chosen.cancelBefore,
    alts: [original, ...alts.filter((_, i) => i !== k)],
    replaced: back ? undefined : { title: item.title, booking: item.booking, reason },
  };
}

function when(i: Item, trip: Trip) {
  if (!i.date) return '還沒排日期';
  const t = md(i.date) + (i.start ? ' ' + i.start : '');
  if (i.type === 'flight') return t + ' 起飛';
  if (i.type === 'hotel') { const n = daysBetween(i.date, trip.end); return t + ' 入住' + (n > 0 ? '，' + n + ' 晚' : ''); }
  if (i.type === 'car') return t + ' 取車';
  return t;
}

/** 設計稿「預訂」(Bookings) */
export function Bookings({ trip, mode, id }: { trip: Trip; mode?: string; id?: string }) {
  if (mode === 'new' || (mode === 'edit' && id)) return <BookingEdit key={id ?? 'new'} trip={trip} id={mode === 'edit' ? id : undefined} />;
  return <BookingList trip={trip} />;
}

function BookingList({ trip }: { trip: Trip }) {
  const items = useLiveQuery(() => db.items.where({ tripId: trip.id }).toArray(), [trip.id]);
  const [filter, setFilter] = useState('全部');
  const [toast, setToast] = useState<{ text: string; before: Item } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  if (!items) return <Skeleton blocks={SK.bookings} gap={14} />;
  const types = FILTERS.find((f) => f[0] === filter)![1];
  const list = items.filter((i) => i.booking && (!types.length || types.includes(i.type)))
    .sort((a, b) => (a.date ?? '9').localeCompare(b.date ?? '9') || a.start.localeCompare(b.start));
  const use = async (i: Item, k: number) => {
    const p = swapAlt(i, k);
    await db.items.update(i.id, p);
    setToast({ text: '已改用 ' + p.title, before: i });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 8000);
  };

  return (
    <TabPage gap={14}>
      <header style={css('display: flex; justify-content: space-between; align-items: center')}>
        <h1 style={css('margin: 0; font-size: 28px; font-weight: 700')}>預訂</h1>
        <a href={href('bookings', 'new')} aria-label="新增預訂" style={css(ROUND_PLUS)}>{I.plus}</a>
      </header>

      <div role="group" aria-label="篩選類別" className="noscrollbar" style={css('display: flex; gap: 8px; overflow-x: auto; margin: 0 -20px; padding: 0 20px')}>
        {FILTERS.map(([l]) => {
          const on = l === filter;
          return <button key={l} aria-pressed={on} onClick={() => setFilter(l)} style={css('height: 36px; flex-shrink: 0; padding: 0 14px; border-radius: 18px; font: inherit; font-size: 14px; ' + (on ? 'border: 0; background: #1E2A44; color: #FFFFFF' : 'border: 1px solid #DCE1E8; background: #FFFFFF; color: #1E2A44'))}>{l}</button>;
        })}
      </div>

      {list.map((i) => {
        const none = i.booking === 'none';
        const open = href('bookings', 'edit', i.id);
        if (i.alts?.length && !none) {
          return (
            <article key={i.id} style={css('position: relative; background: #FFFFFF; border-radius: 16px')}>
              <a href={open} style={css('padding: 16px; display: flex; flex-direction: column; gap: 6px; text-decoration: none; color: #1E2A44')}>
                <div style={css('display: flex; justify-content: space-between; align-items: flex-start; gap: 8px')}>
                  <div>
                    <p className="num" style={css('margin: 0; font-size: 12px; color: #5B6578')}>{when(i, trip)}</p>
                    <h2 style={css('margin: 2px 0 0; font-size: 17px; font-weight: 700')}>{i.title}</h2>
                  </div>
                  {i.replaced ? <span style={css('font-size: 12px; font-weight: 700; color: #FFFFFF; background: #1E2A44; padding: 4px 10px; border-radius: 12px; white-space: nowrap')}>已改用備案</span>
                    : i.booking === 'ordered' ? <span style={PILL_ORDERED}>已訂購</span> : null}
                </div>
                {i.orderNumber && <p className="num" style={css('margin: 0; font-size: 13px; color: #5B6578')}>訂單編號 {i.orderNumber}</p>}
              </a>
              <div aria-hidden="true" style={css('position: relative; height: 0; border-top: 2px dashed #DCE1E8; margin: 0 14px')} />
              <span aria-hidden="true" style={css('position: absolute; left: -10px; width: 20px; height: 20px; border-radius: 10px; background: #F4F6F9; margin-top: -11px')} />
              <span aria-hidden="true" style={css('position: absolute; right: -10px; width: 20px; height: 20px; border-radius: 10px; background: #F4F6F9; margin-top: -11px')} />
              <div style={css('padding: 12px 16px 16px; display: flex; flex-direction: column; gap: 10px')}>
                <h3 style={css('margin: 0; font-size: 13px; font-weight: 500; color: #5B6578')}>備案：主方案不行時，照順序改用</h3>
                {i.alts.map((a, k) => {
                  const ready = a.status !== 'none';
                  const isBack = !!i.replaced && i.replaced.title === a.name;
                  const sub = isBack ? '原本的安排，訂單還在，隨時能換回' : a.status === 'confirmed' ? '訂單確認' + (a.cancelBefore ? '，' + md(a.cancelBefore) + ' 前可免費取消' : '') : a.status === 'ordered' ? '已訂購，還沒收到確認信' : '還沒訂';
                  return (
                    <div key={k} style={css('display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 12px; background: #F4F6F9')}>
                      <span className="num" style={css('width: 26px; height: 26px; flex-shrink: 0; border-radius: 13px; box-sizing: border-box; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; ' + (ready ? 'background: #1E2A44; color: #FFFFFF' : 'background: #FFFFFF; border: 1px solid #B8C0CC'))}>{k + 1}</span>
                      <span style={css('flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px')}><span style={css('font-size: 15px; font-weight: 700')}>{a.name}</span><span className="num" style={css('font-size: 12px; color: #5B6578')}>{sub}{a.note && !isBack && a.note !== '原本的安排' ? '，' + a.note : ''}</span></span>
                      {ready
                        ? <button onClick={() => use(i, k)} style={css('height: 40px; flex-shrink: 0; padding: 0 12px; border-radius: 10px; border: 0; background: #1E2A44; color: #FFFFFF; font: inherit; font-size: 13px; font-weight: 700')}>{isBack ? '換回' : '改用'} {a.name}</button>
                        : <a href={open} style={css('height: 40px; flex-shrink: 0; box-sizing: border-box; padding: 0 12px; border-radius: 10px; border: 1px solid #DCE1E8; background: #FFFFFF; font-size: 13px; font-weight: 500; text-decoration: none; display: flex; align-items: center')}>{NEED[i.type] ?? '需先訂'}</a>}
                    </div>
                  );
                })}
              </div>
            </article>
          );
        }
        return (
          <a key={i.id} href={open} style={css('background: #FFFFFF; border-radius: 16px; padding: 14px 16px; display: flex; flex-direction: column; gap: 6px; text-decoration: none; color: #1E2A44' + (none ? '; border: 1.5px solid #E8B4AF' : ''))}>
            <div style={css('display: flex; justify-content: space-between; align-items: flex-start; gap: 8px')}>
              <div>
                <p className="num" style={css('margin: 0; font-size: 12px; color: #5B6578')}>{when(i, trip)}</p>
                <h2 className="num" style={css('margin: 2px 0 0; font-size: 17px; font-weight: 700')}>{i.title}</h2>
              </div>
              {none && <span style={PILL_NONE}>還沒訂</span>}
              {i.booking === 'ordered' && <span style={PILL_ORDERED}>已訂購</span>}
            </div>
            {none && <p style={css('margin: 0; font-size: 13px; color: #5B6578')}>還沒訂。{i.alts?.length ? '備案：' + i.alts.map((a) => a.name).join('、') : '可以先存一個備案。'}</p>}
            {!none && i.orderNumber && <p className="num" style={css('margin: 0; font-size: 13px; color: #5B6578')}>訂單編號 {i.orderNumber}</p>}
          </a>
        );
      })}
      {!list.length && (
        <section style={css('padding: 28px 20px; border: 1.5px dashed #B8C0CC; border-radius: 18px; display: flex; flex-direction: column; gap: 12px; text-align: center')}>
          <h2 style={css('margin: 0; font-size: 18px; font-weight: 700')}>{filter === '全部' ? '把訂好的都放在這裡' : '沒有' + filter + '的預訂'}</h2>
          <p style={css('margin: 0; font-size: 14px; line-height: 1.6; color: #5B6578')}>機票、住宿、餐廳、門票，也可以先存備案。</p>
          <a href={href('bookings', 'new')} style={css('height: 48px; border-radius: 12px; background: #1E2A44; color: #FFFFFF; font-size: 15px; font-weight: 700; text-decoration: none; display: flex; align-items: center; justify-content: center')}>新增預訂</a>
        </section>
      )}

      {toast && <DToast text={toast.text} action="復原" onAction={() => { db.items.put(toast.before); setToast(null); }} />}
    </TabPage>
  );
}

const T: [ItemType, string][] = [['flight', '機票'], ['hotel', '住宿'], ['transit', '車票'], ['ticket', '門票'], ['restaurant', '餐廳'], ['car', '租車']];
const LBL: Partial<Record<ItemType, [string, string]>> = { hotel: ['入住日', '入住時間'], flight: ['起飛日', '起飛時間'], restaurant: ['日期', '訂位時間'], car: ['取車日', '取車時間'] };
const STATUS: Record<BookingStatus, string> = { none: '還沒訂，要用時需先訂', ordered: '已訂購，還沒收到確認信', confirmed: '訂單確認' };
const L = 'display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #5B6578';
const IN = 'height: 48px; box-sizing: border-box; border: 1px solid #DCE1E8; border-radius: 12px; padding: 0 12px; font-size: 15px; color: #1E2A44; background: #FFFFFF; width: 100%';
const chip = (on: boolean) => css('height: 40px; padding: 0 14px; border-radius: 20px; font: inherit; font-size: 14px; ' + (on ? 'border: 0; background: #1E2A44; color: #FFFFFF; font-weight: 700' : 'border: 1px solid #DCE1E8; background: #FFFFFF; color: #1E2A44'));

/** 設計稿「編輯預訂」(BookingEdit) */
function BookingEdit({ trip, id }: { trip: Trip; id?: string }) {
  const existing = useLiveQuery<Item | null>(async () => (id ? (await db.items.get(id)) ?? null : null), [id]);
  const shots = useLiveQuery(() => (id ? db.documents.where({ tripId: trip.id }).filter((d) => d.itemId === id).count() : 0), [id]) ?? 0;
  const [f, setF] = useState<Item | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [newAlt, setNewAlt] = useState('');
  const [newStatus, setNewStatus] = useState<BookingStatus>('none');
  const file = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<File[]>([]);
  useEffect(() => {
    if (existing === undefined || f || (id && !existing)) return;
    setF(existing ?? { id: uid(), tripId: trip.id, date: trip.start, start: '', end: '', title: '', type: 'hotel', booking: 'confirmed', alts: [], cancelRemind: true });
  }, [existing, f, trip]);
  if (id && existing === null) return <main style={css('padding: 52px 20px')}><a href={href('bookings')}>回預訂</a><p>找不到這筆預訂。</p></main>;
  if (!f) return <Skeleton blocks={SK.page} />;
  const set = (p: Partial<Item>) => { setF({ ...f, ...p }); setMsg(null); };
  const lbl = LBL[f.type] ?? ['日期', '時間'];
  const alts = f.alts ?? [];
  const remind = f.cancelRemind ?? true;
  const lead = (() => { try { return JSON.parse(localStorage.getItem('travel-reminder-rules') || '{}').cancelLead ?? 2; } catch { return 2; } })();

  const save = async () => {
    if (!f.title.trim()) return setMsg({ text: '請填名稱。', ok: false });
    if (!f.date) return setMsg({ text: '請填' + lbl[0] + '。', ok: false });
    if (f.cancelBefore && f.cancelBefore > f.date) return setMsg({ text: '免費取消期限晚於' + lbl[0] + '，請再確認。', ok: false });
    try {
      await db.items.put({ ...f, title: f.title.trim(), end: f.end || f.start });
      for (const p of pending) await db.documents.add({ id: uid(), tripId: trip.id, name: p.name, file: p, itemId: f.id });
      setPending([]);
      setMsg({ text: '已儲存，' + alts.length + ' 個備案' + (remind && f.cancelBefore ? '，取消期限前 ' + lead + ' 天會提醒你' : ''), ok: true });
    } catch { setMsg({ text: '沒存成功，請確認手機空間後再試一次。', ok: false }); }
  };
  const remove = async () => {
    if (!id || !confirm('刪除「' + f.title + '」這筆預訂？')) return;
    await db.items.delete(id);
    location.hash = href('bookings');
  };

  return (
    <div style={css('flex: 1; display: flex; flex-direction: column')}>
      <header style={css('padding: 52px 20px 12px; display: flex; justify-content: space-between; align-items: center')}>
        <a href={href('bookings')} style={css('height: 44px; display: flex; align-items: center; font-size: 15px; text-decoration: none')}>取消</a>
        <h1 style={css('margin: 0; font-size: 17px; font-weight: 700')}>{id ? '編輯預訂' : '新增預訂'}</h1>
        <button onClick={save} style={css('height: 40px; padding: 0 16px; border-radius: 10px; border: 0; background: #1E2A44; color: #FFFFFF; font: inherit; font-size: 15px; font-weight: 700')}>儲存</button>
      </header>

      <main style={css('flex: 1; padding: 8px 20px 32px; display: flex; flex-direction: column; gap: 22px')}>
        {msg && <p role="status" style={css('margin: 0; padding: 12px 14px; border-radius: 12px; font-size: 14px; font-weight: 700; ' + (msg.ok ? 'background: #DDF1E8; color: #1F7A5C' : 'background: #F9E1DF; color: #B83A32'))}>{msg.text}</p>}

        <fieldset style={css('border: 0; margin: 0; padding: 0')}>
          <legend style={css('font-size: 13px; color: #5B6578; padding: 0; margin-bottom: 8px')}>類型</legend>
          <div style={css('display: flex; flex-wrap: wrap; gap: 8px')}>
            {T.map(([k, l]) => <button key={k} aria-pressed={f.type === k} onClick={() => set({ type: k })} style={chip(f.type === k)}>{l}</button>)}
          </div>
        </fieldset>

        <fieldset style={css('border: 0; margin: 0; padding: 0')}>
          <legend style={css('font-size: 13px; color: #5B6578; padding: 0; margin-bottom: 8px')}>訂購狀態</legend>
          <div style={css('display: flex; flex-wrap: wrap; gap: 8px')}>
            {(['none', 'ordered', 'confirmed'] as BookingStatus[]).map((s) => <button key={s} aria-pressed={f.booking === s} onClick={() => set({ booking: s })} style={chip(f.booking === s)}>{s === 'none' ? '還沒訂' : s === 'ordered' ? '已訂購' : '訂單確認'}</button>)}
          </div>
        </fieldset>

        <div style={css('display: flex; flex-direction: column; gap: 12px')}>
          <label style={css(L)}>名稱
            <input type="text" value={f.title} onChange={(e) => set({ title: e.target.value })} style={css('height: 48px; box-sizing: border-box; border: 1px solid #DCE1E8; border-radius: 12px; padding: 0 12px; font: inherit; font-size: 17px; font-weight: 700; color: #1E2A44; background: #FFFFFF')} />
          </label>
          <div style={css('display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px')}>
            <label style={css(L)}>{lbl[0]}<input type="date" value={f.date ?? ''} onChange={(e) => set({ date: e.target.value || null })} className="num" style={css(IN + '; padding: 0 8px')} /></label>
            <label style={css(L)}>{lbl[1]}<input type="time" value={f.start} onChange={(e) => set({ start: e.target.value })} className="num" style={css(IN + '; padding: 0 8px')} /></label>
          </div>
          <label style={css(L)}>訂單編號<input type="text" value={f.orderNumber ?? ''} onChange={(e) => set({ orderNumber: e.target.value })} placeholder="確認信上的訂單或訂位代號" className="num" style={css(IN)} /></label>
          <div style={css('display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px')}>
            <label style={css(L)}>費用<input type="text" value={f.price ?? (f.cost != null ? String(f.cost) : '')} onChange={(e) => set({ price: e.target.value })} placeholder="例如 ¥48,000" className="num" style={css(IN)} /></label>
            <label style={css(L)}>免費取消期限<input type="date" value={f.cancelBefore ?? ''} onChange={(e) => set({ cancelBefore: e.target.value || undefined })} className="num" style={css(IN + '; padding: 0 8px')} /></label>
          </div>
          <label style={css('display: flex; align-items: center; gap: 10px; min-height: 44px; font-size: 15px')}><input type="checkbox" checked={remind} onChange={() => set({ cancelRemind: !remind })} style={css('width: 22px; height: 22px; accent-color: #1E2A44')} />取消期限前 {lead} 天提醒我</label>
          <button onClick={() => file.current?.click()} style={css('height: 48px; border-radius: 12px; border: 1px dashed #B8C0CC; background: transparent; color: #1E2A44; font: inherit; font-size: 15px')}>
            ＋ 附上確認信截圖{shots + pending.length ? '（已附 ' + (shots + pending.length) + ' 張' + (pending.length ? '，儲存後保留' : '') + '）' : ''}
          </button>
          <input ref={file} type="file" accept="image/*,application/pdf" multiple className="visually-hidden" onChange={(e) => { setPending([...pending, ...Array.from(e.target.files ?? [])]); e.target.value = ''; }} />
        </div>

        <section aria-labelledby="alt-h" style={css('display: flex; flex-direction: column; gap: 10px; border-top: 1px solid #DCE1E8; padding-top: 18px')}>
          <div>
            <h2 id="alt-h" style={css('margin: 0; font-size: 17px; font-weight: 700')}>備案</h2>
            <p style={css('margin: 4px 0 0; font-size: 13px; color: #5B6578')}>主方案不行時，照這個順序改用。</p>
          </div>
          <ol style={css('list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px')}>
            {alts.map((a, i) => (
              <li key={i} style={css('display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 12px; background: #FFFFFF')}>
                <span className="num" style={css('width: 26px; height: 26px; flex-shrink: 0; border-radius: 13px; background: #1E2A44; color: #FFFFFF; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center')}>{i + 1}</span>
                <span style={css('flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px')}><span style={css('font-size: 15px; font-weight: 700')}>{a.name}</span>
                  <span style={css('font-size: 12px; ' + (a.status === 'confirmed' ? 'color: #1F7A5C' : a.status === 'ordered' ? 'color: #8A5A00' : 'color: #5B6578'))}>{STATUS[a.status]}{a.status !== 'none' && a.cancelBefore ? '，' + md(a.cancelBefore) + ' 前可免費取消' : ''}</span></span>
                <button aria-label={'上移 ' + a.name} disabled={i === 0} onClick={() => { const n = alts.slice(); [n[i - 1], n[i]] = [n[i], n[i - 1]]; set({ alts: n }); }} style={{ ...css('width: 36px; height: 36px; flex-shrink: 0; border-radius: 8px; border: 1px solid #DCE1E8; background: #FFFFFF; color: #1E2A44; display: flex; align-items: center; justify-content: center'), opacity: i === 0 ? 0.4 : 1 }}><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 15l6-6 6 6" /></svg></button>
                <button aria-label={'刪除備案 ' + a.name} onClick={() => set({ alts: alts.filter((_, k) => k !== i) })} style={css('width: 36px; height: 36px; flex-shrink: 0; border-radius: 8px; border: 1px solid #DCE1E8; background: #FFFFFF; color: #B83A32; display: flex; align-items: center; justify-content: center')}><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
              </li>
            ))}
          </ol>
          {!alts.length && <p style={css('margin: 0; padding: 16px; border: 1.5px dashed #B8C0CC; border-radius: 12px; font-size: 14px; color: #5B6578; text-align: center')}>還沒有備案。先存一個，主方案出狀況時可以直接換。</p>}
          <div style={css('display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: 12px; background: #E4E8EE')}>
            <label style={css(L)}>新增備案
              <input type="text" value={newAlt} onChange={(e) => setNewAlt(e.target.value)} placeholder="例如：Hotel C 四條" style={css('height: 44px; box-sizing: border-box; border: 1px solid #DCE1E8; border-radius: 10px; padding: 0 12px; font: inherit; font-size: 15px; color: #1E2A44; background: #FFFFFF')} />
            </label>
            <div style={css('display: flex; align-items: center; justify-content: space-between; gap: 8px')}>
              <label style={css('display: flex; align-items: center; gap: 8px; font-size: 14px')}>狀態<select value={newStatus} onChange={(e) => setNewStatus(e.target.value as BookingStatus)} style={css('height: 40px; border: 1px solid #DCE1E8; border-radius: 10px; padding: 0 8px; font: inherit; font-size: 14px; color: #1E2A44; background: #FFFFFF')}><option value="none">還沒訂</option><option value="ordered">已訂購</option><option value="confirmed">訂單確認</option></select></label>
              <button onClick={() => { const n = newAlt.trim().slice(0, 40); if (!n) return; set({ alts: [...alts, { name: n, status: newStatus }] }); setNewAlt(''); setNewStatus('none'); }} style={css('height: 40px; padding: 0 16px; border-radius: 10px; border: 0; background: #1E2A44; color: #FFFFFF; font: inherit; font-size: 14px; font-weight: 700')}>加入備案</button>
            </div>
          </div>
        </section>

        {id && <button onClick={remove} style={css('height: 48px; border-radius: 12px; border: 0; background: transparent; color: #B83A32; font: inherit; font-size: 15px; font-weight: 700')}>刪除這筆預訂</button>}
      </main>
    </div>
  );
}
