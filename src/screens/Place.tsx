import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { addDays, daysBetween, md, toMin, weekday } from '../lib/time';
import { href } from '../lib/route';
import { BackLink, css, I } from '../design';
import type { Trip } from '../types';

export const TAGS = ['喜歡', '想去', '想看', '必去'];
const ROW = 'display: flex; justify-content: space-between; align-items: center; min-height: 44px; border-top: 1px solid #DCE1E8; font-size: 15px';
const INPUT = 'font: inherit; font-size: 15px; color: #1E2A44; border: 1px solid #DCE1E8; border-radius: 10px; padding: 10px 12px; background: #FFFFFF';

/** 設計稿「景點筆記」(Place) */
export function Place({ trip, itemId }: { trip: Trip; itemId: string }) {
  const item = useLiveQuery(() => db.items.get(itemId), [itemId]);
  const [adding, setAdding] = useState('');
  const [open, setOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  if (item === undefined) return <main />;
  if (!item) return <main style={css('padding: 52px 20px')}><BackLink to={href('plan')} /><h1>找不到這個景點</h1></main>;
  const tags = item.tags ?? [];
  const days = Array.from({ length: daysBetween(trip.start, trip.end) + 1 }, (_, k) => addDays(trip.start, k));
  const stay = item.stay ?? (item.start && item.end ? toMin(item.end) - toMin(item.start) : 0);
  const back = href('plan', item.date ?? 'pool');
  const save = (p: Partial<typeof item>) => db.items.update(item.id, p);

  return (
    <main style={css('flex: 1; padding: 52px 20px 24px; display: flex; flex-direction: column; gap: 16px')}>
      <div style={css('display: flex; justify-content: space-between; align-items: center')}>
        <BackLink to={back} label="返回行程" />
        <a href={'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(item.title)} target="_blank" rel="noreferrer" style={css('height: 44px; box-sizing: border-box; padding: 0 16px; border-radius: 22px; border: 0; background: #FFFFFF; color: #1E2A44; font-size: 14px; font-weight: 500; display: flex; align-items: center; gap: 6px; text-decoration: none')}>{I.pin}在地圖開啟</a>
      </div>

      <header>
        <h1 style={css('margin: 0; font-size: 28px; font-weight: 700')}>{item.title}</h1>
        <p style={css('margin: 4px 0 0; font-size: 14px; color: #5B6578')}>
          {item.date ? <>排在 <span className="num">{md(item.date)}{item.start && ' ' + item.start}</span></> : '還沒排進行程'}
          {stay > 0 && <>，建議停留 {stay % 60 === 0 ? stay / 60 + ' 小時' : stay + ' 分鐘'}</>}
        </p>
      </header>

      <div role="group" aria-label="這個景點對我來說是" style={css('display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px')}>
        {TAGS.map((l) => {
          const on = tags.includes(l);
          return <button key={l} aria-pressed={on} onClick={() => save({ tags: on ? tags.filter((t) => t !== l) : [...tags, l] })} style={css('height: 44px; border-radius: 12px; font: inherit; font-size: 14px; ' + (on ? 'border: 0; background: #1E2A44; color: #FFFFFF; font-weight: 700' : 'border: 1px solid #DCE1E8; background: #FFFFFF; color: #5B6578'))}>{l}</button>;
        })}
      </div>

      <section aria-labelledby="want-h" style={css('display: flex; flex-direction: column')}>
        <div style={css('display: flex; justify-content: space-between; align-items: center')}>
          <h2 id="want-h" style={css('margin: 0; font-size: 16px; font-weight: 700')}>想看清單</h2>
          <button onClick={() => setOpen(true)} style={css('height: 40px; padding: 0 4px; border: 0; background: transparent; color: #1E2A44; font: inherit; font-size: 14px; font-weight: 500')}>＋ 新增</button>
        </div>
        {(item.watch ?? []).map((w, k) => (
          <label key={k} style={css('display: flex; align-items: center; gap: 10px; min-height: 44px; font-size: 15px; border-top: 1px solid #DCE1E8' + (w.done ? '; color: #5B6578; text-decoration: line-through' : ''))}>
            <input type="checkbox" checked={w.done} onChange={() => save({ watch: item.watch!.map((x, i) => (i === k ? { ...x, done: !x.done } : x)) })} style={css('width: 20px; height: 20px; accent-color: #1F7A5C')} /> {w.text}
          </label>
        ))}
        {!item.watch?.length && !open && <p style={css('margin: 0; min-height: 44px; display: flex; align-items: center; border-top: 1px solid #DCE1E8; font-size: 14px; color: #5B6578')}>還沒有想看的，到現場可以一項項打勾。</p>}
        {open && (
          <form onSubmit={(e) => { e.preventDefault(); if (!adding.trim()) return; save({ watch: [...(item.watch ?? []), { text: adding.trim(), done: false }] }); setAdding(''); }} style={css('display: flex; gap: 8px; padding-top: 8px; border-top: 1px solid #DCE1E8')}>
            <input autoFocus aria-label="想看的東西" value={adding} onChange={(e) => setAdding(e.target.value)} placeholder="例如：千本鳥居" style={css(INPUT + '; flex: 1; min-width: 0; height: 44px; box-sizing: border-box')} />
            <button style={css('height: 44px; padding: 0 16px; border-radius: 10px; border: 0; background: #1E2A44; color: #FFFFFF; font: inherit; font-size: 14px; font-weight: 700')}>加入</button>
          </form>
        )}
      </section>

      <section aria-labelledby="note-h" style={css('display: flex; flex-direction: column; gap: 8px')}>
        <label id="note-h" htmlFor="note" style={css('font-size: 16px; font-weight: 700')}>筆記</label>
        <textarea id="note" rows={3} defaultValue={item.note ?? ''} placeholder="開放時間、拍照點、要帶什麼…" onBlur={(e) => save({ note: e.target.value })} style={css(INPUT + '; line-height: 1.6; resize: none')} />
      </section>

      <section aria-labelledby="info-h" style={css('display: flex; flex-direction: column')}>
        <h2 id="info-h" style={css('margin: 0 0 4px; font-size: 16px; font-weight: 700')}>資訊與連結</h2>
        <label style={css(ROW)}><span style={css('color: #5B6578')}>開放時間</span><input aria-label="開放時間" defaultValue={item.hours ?? ''} placeholder="未填" onBlur={(e) => save({ hours: e.target.value })} style={css('border: 0; background: transparent; font: inherit; font-size: 15px; color: #1E2A44; text-align: right; width: 50%')} /></label>
        {item.url
          ? <a href={item.url} target="_blank" rel="noreferrer" style={css(ROW + '; text-decoration: none')}>官方網站{I.out}</a>
          : <label style={css(ROW)}><span style={css('color: #5B6578')}>官方網站</span><input aria-label="官方網站網址" type="url" placeholder="貼上網址" onBlur={(e) => /^https?:\/\//.test(e.target.value) && save({ url: e.target.value })} style={css('border: 0; background: transparent; font: inherit; font-size: 15px; color: #1E2A44; text-align: right; width: 60%')} /></label>}
      </section>

      {moving ? (
        <label style={css('display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #5B6578')}>移到哪一天
          <select autoFocus value={item.date ?? ''} onChange={(e) => { save({ date: e.target.value || null }); setMoving(false); }} style={css('height: 52px; border-radius: 14px; border: 1px solid #DCE1E8; background: #FFFFFF; color: #1E2A44; font: inherit; font-size: 15px; padding: 0 12px')}>
            <option value="">還沒排（放回景點庫）</option>
            {days.map((d) => <option key={d} value={d}>{md(d)} {weekday(d)}</option>)}
          </select>
        </label>
      ) : (
        <button onClick={() => setMoving(true)} style={css('height: 52px; flex-shrink: 0; border-radius: 14px; border: 1px solid #DCE1E8; background: #FFFFFF; color: #1E2A44; font: inherit; font-size: 15px; font-weight: 500')}>移到其他天</button>
      )}
    </main>
  );
}
