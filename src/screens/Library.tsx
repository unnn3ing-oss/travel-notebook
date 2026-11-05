import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid } from '../db';
import { addDays, daysBetween, md, weekday } from '../lib/time';
import { href } from '../lib/route';
import { BackLink, css } from '../design';
import { TAGS } from './Place';
import type { Item, Trip } from '../types';

const KIND: Record<string, string> = { place: '景點', restaurant: '餐廳', other: '店家' };

/** 設計稿「景點庫」(Library) */
export function Library({ trip }: { trip: Trip }) {
  const all = useLiveQuery(() => db.items.where({ tripId: trip.id }).toArray(), [trip.id]) ?? [];
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('全部');
  const [name, setName] = useState('');
  const [toast, setToast] = useState('');
  const days = Array.from({ length: daysBetween(trip.start, trip.end) + 1 }, (_, k) => addDays(trip.start, k));
  const list = all.filter((i) => i.type in KIND);
  const ql = q.trim().toLowerCase();
  const shown = list.filter((p) => (tag === '全部' || (p.tags ?? []).includes(tag)) && (!ql || (p.title + (p.note ?? '')).toLowerCase().includes(ql)))
    .sort((a, b) => Number(!!a.date) - Number(!!b.date) || (a.date ?? '').localeCompare(b.date ?? ''));
  const unplanned = list.filter((p) => !p.date).length;
  const setDay = async (p: Item, d: string) => {
    const order = all.filter((x) => x.date === (d || null)).length;
    await db.items.update(p.id, { date: d || null, order });
    setToast(d ? '已把「' + p.title + '」排到 ' + md(d) + ' ' + weekday(d) + '，時間之後再定' : '已把「' + p.title + '」移回未排程');
  };
  const add = async () => {
    const n = name.trim().slice(0, 40);
    if (!n) return;
    if (list.some((p) => p.title === n)) return setToast('景點庫裡已經有「' + n + '」');
    await db.items.add({ id: uid(), tripId: trip.id, date: null, start: '', end: '', title: n, type: 'place', tags: [] });
    setName(''); setQ(''); setTag('全部');
    setToast('已新增「' + n + '」');
  };

  return (
    <main style={css('flex: 1; padding: 52px 20px 32px; display: flex; flex-direction: column; gap: 16px')}>
      <div style={css('display: flex; justify-content: space-between; align-items: center')}>
        <BackLink to={href('plan')} label="返回行程" />
        <span className="num" style={css('font-size: 13px; color: #5B6578')}>{list.length} 個地點，{unplanned} 個還沒排</span>
      </div>
      <h1 style={css('margin: 0; font-size: 28px; font-weight: 700')}>景點庫</h1>

      <label style={css('position: relative; display: block')}>
        <span className="visually-hidden">搜尋景點</span>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{ ...css('position: absolute; left: 14px; top: 15px; color: #5B6578') }}><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
        <input type="search" value={q} onChange={(e) => { setQ(e.target.value); setToast(''); }} placeholder="搜尋名稱或筆記" style={css('width: 100%; height: 48px; box-sizing: border-box; border: 1px solid #DCE1E8; border-radius: 12px; padding: 0 12px 0 40px; font: inherit; font-size: 16px; color: #1E2A44; background: #FFFFFF')} />
      </label>

      <div role="group" aria-label="依標籤篩選" className="noscrollbar" style={css('display: flex; gap: 6px; overflow-x: auto; margin: 0 -20px; padding: 0 20px')}>
        {['全部', '必去', '想去', '想看', '喜歡'].map((t) => <button key={t} aria-pressed={t === tag} onClick={() => setTag(t)} style={css('flex: 0 0 auto; height: 38px; padding: 0 14px; border-radius: 19px; font: inherit; font-size: 14px; ' + (t === tag ? 'border: 0; background: #1E2A44; color: #FFFFFF; font-weight: 700' : 'border: 1px solid #DCE1E8; background: #FFFFFF; color: #1E2A44'))}>{t}</button>)}
      </div>

      {toast && <p role="status" style={css('margin: 0; padding: 10px 14px; border-radius: 12px; background: #DDF1E8; color: #1F7A5C; font-size: 14px; font-weight: 700')}>{toast}</p>}

      <ul style={css('list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px')}>
        {shown.map((p) => (
          <li key={p.id} style={css('padding: 14px; border-radius: 14px; background: #FFFFFF; display: flex; flex-direction: column; gap: 8px')}>
            <div style={css('display: flex; justify-content: space-between; align-items: flex-start; gap: 8px')}>
              <a href={href('place', p.id)} style={css('font-size: 16px; font-weight: 700; text-decoration: none')}>{p.title}</a>
              <span style={css('font-size: 12px; color: #5B6578; flex-shrink: 0')}>{KIND[p.type]}</span>
            </div>
            <span style={css('font-size: 13px; color: #5B6578')}>{p.tags?.length ? TAGS.filter((t) => p.tags!.includes(t)).join('、') : '沒有標籤'}</span>
            {p.note && <span style={css('font-size: 13px; line-height: 1.5')}>{p.note}</span>}
            <label style={css('display: flex; align-items: center; gap: 8px; font-size: 13px; color: #5B6578')}>{p.date ? '排在' : '加到'}
              <select value={p.date ?? ''} onChange={(e) => setDay(p, e.target.value)} style={css('flex: 1; height: 40px; border: 1px solid #DCE1E8; border-radius: 10px; padding: 0 8px; font: inherit; font-size: 16px; color: #1E2A44; background: #FFFFFF')}>
                <option value="">還沒排</option>
                {days.map((d) => <option key={d} value={d}>{md(d)} {weekday(d)}</option>)}
              </select>
            </label>
          </li>
        ))}
      </ul>
      {!shown.length && <p style={css('margin: 0; padding: 24px 12px; border: 1.5px dashed #B8C0CC; border-radius: 12px; text-align: center; font-size: 14px; color: #5B6578')}>{q ? '找不到「' + q + '」。可以直接在下面新增。' : list.length ? '這個標籤還沒有地點。' : '還沒有地點，先存想去的地方。'}</p>}

      <form onSubmit={(e) => { e.preventDefault(); add(); }} style={css('display: flex; gap: 8px; padding: 12px; border-radius: 14px; background: #E4E8EE')}>
        <label style={css('flex: 1; min-width: 0')}><span className="visually-hidden">新景點名稱</span><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="新增景點，例如：銀閣寺" style={css('width: 100%; height: 44px; box-sizing: border-box; border: 1px solid #DCE1E8; border-radius: 10px; padding: 0 12px; font: inherit; font-size: 16px; color: #1E2A44; background: #FFFFFF')} /></label>
        <button style={css('height: 44px; flex-shrink: 0; padding: 0 16px; border-radius: 10px; border: 0; background: #1E2A44; color: #FFFFFF; font: inherit; font-size: 14px; font-weight: 700')}>新增</button>
      </form>
    </main>
  );
}
