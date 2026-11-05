import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { href } from '../lib/route';
import { addDays, daysBetween, md, weekday } from '../lib/time';
import { BackLink, css, I } from '../design';
import { dayCards, TYPE_LABEL } from './Plan';
import type { Trip } from '../types';

const TABLES = ['trips', 'items', 'routes', 'tasks', 'expenses', 'details', 'documents'];
const TZ: Record<string, string> = { 'Asia/Tokyo': '日本（UTC+9）', 'Asia/Seoul': '韓國（UTC+9）', 'Asia/Bangkok': '泰國（UTC+7）', 'Asia/Taipei': '台灣（UTC+8）', 'Europe/Paris': '法國（UTC+1）' };
const ROW = 'min-height: 56px; border: 0; border-bottom: 1px solid #DCE1E8; background: transparent; color: #1E2A44; font: inherit; font-size: 15px; text-align: left; display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 0; text-decoration: none';
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href: url, download: name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 設計稿「設定與備份」(Settings) */
export function Settings({ trip }: { trip: Trip }) {
  const input = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);
  const [theme, setTheme] = useState(read('travel-theme') || 'system');
  const [last, setLast] = useState(read('travel-last-backup'));
  const [confirmKind, setConfirm] = useState<null | 'restore' | 'del'>(null);

  async function backup() {
    try {
      const data: Record<string, unknown> = { format: 'travel-notebook', version: 2 };
      for (const t of TABLES) {
        const rows = await db.table(t).toArray();
        data[t] = t === 'documents' ? await Promise.all(rows.map(async (d) => ({ ...d, file: await new Promise<string>((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = no; r.readAsDataURL(d.file); }) }))) : rows;
      }
      download('旅行手帳備份-' + new Date().toISOString().slice(0, 10) + '.json', new Blob([JSON.stringify(data)], { type: 'application/json' }));
      const now = new Date().toISOString();
      write('travel-last-backup', now);
      setLast(now);
      setNote(null);
    } catch { setNote({ text: '備份失敗，請再試一次。', ok: false }); }
  }
  async function restore(f: File | undefined) {
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (data.format !== 'travel-notebook' || data.version !== 2 || !TABLES.every((t) => Array.isArray(data[t]) && data[t].every((r: Record<string, unknown>) => typeof r.id === 'string'))) throw Error();
      if (!data.trips.every((t: Trip) => typeof t.name === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.start) && /^\d{4}-\d{2}-\d{2}$/.test(t.end) && t.end >= t.start && t.people >= 1 && typeof t.currency === 'string')) throw Error();
      for (const d of data.documents) { if (typeof d.file !== 'string' || !d.file.startsWith('data:')) throw Error(); d.file = await (await fetch(d.file)).blob(); }
      await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => { for (const t of TABLES) { await db.table(t).clear(); await db.table(t).bulkPut(data[t]); } });
      setNote({ text: '已用備份檔還原。', ok: true });
    } catch { setNote({ text: '沒辦法還原：請選旅行手帳產生的備份檔。', ok: false }); }
  }
  async function exportIcs() {
    const items = (await db.items.where({ tripId: trip.id }).toArray()).filter((i) => i.date && i.start);
    const tz = trip.timezone;
    const dt = (d: string, t: string) => d.replace(/-/g, '') + 'T' + t.replace(':', '') + '00';
    const esc = (s: string) => s.replace(/[\\,;]/g, (m) => '\\' + m).replace(/\n/g, '\\n');
    const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
    const ev = items.map((i) => ['BEGIN:VEVENT', 'UID:' + i.id + '@travel-notebook', 'DTSTAMP:' + stamp,
      'DTSTART' + (tz ? ';TZID=' + tz : '') + ':' + dt(i.date!, i.start), 'DTEND' + (tz ? ';TZID=' + tz : '') + ':' + dt(i.date!, i.end && i.end > i.start ? i.end : i.start),
      'SUMMARY:' + esc(i.title), ...(i.note ? ['DESCRIPTION:' + esc(i.note)] : []), 'END:VEVENT'].join('\r\n'));
    download(trip.name + '.ics', new Blob([['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//travel-notebook//ZH', 'CALSCALE:GREGORIAN', ...ev, 'END:VCALENDAR'].join('\r\n')], { type: 'text/calendar' }));
  }
  function changeTheme(v: string) { setTheme(v); write('travel-theme', v); document.documentElement.dataset.theme = v; }
  async function deleteTrip() {
    await db.transaction('rw', db.tables, async () => {
      const ids = await db.items.where({ tripId: trip.id }).primaryKeys();
      await db.routes.where('itemId').anyOf(ids).delete();
      for (const t of ['items', 'tasks', 'expenses', 'documents']) await db.table(t).where({ tripId: trip.id }).delete();
      await db.details.delete(trip.id);
      await db.trips.delete(trip.id);
    });
    location.hash = href('');
  }
  const CF = {
    restore: ['用備份檔還原？', '目前手機裡的資料會被備份檔的內容取代。建議先按「備份成檔案」存一份現在的資料。', '選擇檔案並還原'],
    del: ['刪除「' + trip.name + '」？', '行程、預訂、備案、筆記和花費都會一起刪除，而且無法復原。', '刪除旅程'],
  };
  const ago = last ? (() => { const m = Math.round((Date.now() - new Date(last).getTime()) / 60000); return m < 2 ? '剛剛' : m < 60 ? m + ' 分鐘前' : m < 1440 ? Math.round(m / 60) + ' 小時前' : Math.round(m / 1440) + ' 天前'; })() : '';

  return (
    <main style={css('flex: 1; padding: 52px 20px 32px; display: flex; flex-direction: column; gap: 24px')}>
      <BackLink to={href('essentials')} />
      <h1 style={css('margin: 0; font-size: 28px; font-weight: 700')}>設定與備份</h1>

      <section aria-labelledby="bk-h" style={css('display: flex; flex-direction: column; gap: 10px')}>
        <h2 id="bk-h" style={css('margin: 0; font-size: 16px; font-weight: 700')}>資料備份</h2>
        <div style={css('padding: 14px; border-radius: 14px; display: flex; flex-direction: column; gap: 6px; ' + (last ? 'background: #DDF1E8; color: #1F7A5C' : 'background: #F9E1DF; color: #B83A32'))}>
          <p style={css('margin: 0; font-size: 14px; line-height: 1.6')}>{last ? '已存好一份備份。換手機或手機遺失時，可以用這個檔案還原。' : '資料只存在這支手機。換手機、清除 Safari 資料或手機遺失，資料就會不見。出發前至少備份一次。'}</p>
          <p className="num" style={css('margin: 0; font-size: 13px; font-weight: 700')}>{last ? '上次備份：' + ago : '還沒備份過'}</p>
        </div>
        <button onClick={backup} style={css('height: 52px; border-radius: 14px; border: 0; background: #1E2A44; color: #FFFFFF; font: inherit; font-size: 16px; font-weight: 700')}>備份成檔案</button>
        <p style={css('margin: 0; font-size: 13px; color: #5B6578')}>會存成一個 .json 檔，可以放到 iCloud 雲碟或傳給自己。檔案裡有訂單編號，不要分享給別人。</p>
        <button onClick={() => setConfirm('restore')} style={css('height: 48px; border-radius: 12px; border: 1px solid #DCE1E8; background: #FFFFFF; color: #1E2A44; font: inherit; font-size: 15px')}>從備份檔還原</button>
        <input ref={input} type="file" accept="application/json,.json" className="visually-hidden" onChange={(e) => { restore(e.target.files?.[0]); e.target.value = ''; }} />
        {note && <p role="status" style={css('margin: 0; padding: 12px 14px; border-radius: 12px; font-size: 14px; font-weight: 700; ' + (note.ok ? 'background: #DDF1E8; color: #1F7A5C' : 'background: #F9E1DF; color: #B83A32'))}>{note.text}</p>}
      </section>

      <section aria-labelledby="ex-h" style={css('display: flex; flex-direction: column')}>
        <h2 id="ex-h" style={css('margin: 0 0 4px; font-size: 16px; font-weight: 700')}>匯出</h2>
        <button onClick={exportIcs} style={css(ROW)}>加到 iPhone 行事曆<span style={css('font-size: 13px; color: #5B6578')}>.ics 檔</span></button>
        <a href={href('print')} style={css(ROW)}>行程表 PDF<span style={css('font-size: 13px; color: #5B6578')}>可以印出來或傳給同行的人</span></a>
      </section>

      <section aria-labelledby="look-h" style={css('display: flex; flex-direction: column; gap: 10px')}>
        <h2 id="look-h" style={css('margin: 0; font-size: 16px; font-weight: 700')}>外觀</h2>
        <div role="radiogroup" aria-labelledby="look-h" style={css('display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); background: #E4E8EE; border-radius: 12px; padding: 3px')}>
          {[['light', '淺色'], ['dark', '深色'], ['system', '跟隨系統']].map(([k, l]) => <button key={k} role="radio" aria-checked={theme === k} onClick={() => changeTheme(k)} style={css('height: 40px; border: 0; border-radius: 10px; font: inherit; font-size: 14px; ' + (theme === k ? 'background: #FFFFFF; color: #1E2A44; font-weight: 700' : 'background: transparent; color: #5B6578'))}>{l}</button>)}
        </div>
      </section>

      <section aria-labelledby="more-h" style={css('display: flex; flex-direction: column')}>
        <h2 id="more-h" style={css('margin: 0 0 4px; font-size: 16px; font-weight: 700')}>其他</h2>
        <a href={href('reminders')} style={css(ROW)}>提醒設定{I.chev}</a>
        <a href={href('')} style={css(ROW)}>切換旅程{I.chev}</a>
        <div style={css(ROW)}>這趟旅程的時區<span style={css('font-size: 14px; color: #5B6578')}>{trip.timezone ? TZ[trip.timezone] ?? trip.timezone : '跟手機時間一樣'}</span></div>
        <button onClick={() => setConfirm('del')} style={css('min-height: 56px; border: 0; background: transparent; color: #B83A32; font: inherit; font-size: 15px; font-weight: 700; text-align: left; padding: 0')}>刪除「{trip.name}」</button>
      </section>

      {confirmKind && (
        <div style={css('position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; padding: 20px')}>
          <div aria-hidden="true" onClick={() => setConfirm(null)} style={css('position: absolute; inset: 0; background: rgba(30,42,68,0.55)')} />
          <section role="alertdialog" aria-modal="true" aria-labelledby="cf-h" aria-describedby="cf-d" style={css('position: relative; width: 100%; max-width: 400px; background: #FFFFFF; border-radius: 20px; padding: 20px; display: flex; flex-direction: column; gap: 12px')}>
            <h2 id="cf-h" style={css('margin: 0; font-size: 18px; font-weight: 700')}>{CF[confirmKind][0]}</h2>
            <p id="cf-d" style={css('margin: 0; font-size: 14px; line-height: 1.6; color: #5B6578')}>{CF[confirmKind][1]}</p>
            <div style={css('display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px')}>
              <button autoFocus onClick={() => setConfirm(null)} style={css('height: 48px; border-radius: 12px; border: 1px solid #DCE1E8; background: #FFFFFF; color: #1E2A44; font: inherit; font-size: 15px')}>取消</button>
              <button onClick={() => { const k = confirmKind; setConfirm(null); if (k === 'restore') input.current?.click(); else deleteTrip(); }} style={css('height: 48px; border-radius: 12px; border: 0; background: #b83a32; color: #fff; font: inherit; font-size: 15px; font-weight: 700')}>{CF[confirmKind][2]}</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

/** 行程表（列印或另存 PDF） */
export function PrintView({ trip }: { trip: Trip }) {
  const items = useLiveQuery(() => db.items.where({ tripId: trip.id }).toArray(), [trip.id]);
  const days = Array.from({ length: daysBetween(trip.start, trip.end) + 1 }, (_, k) => addDays(trip.start, k));
  useEffect(() => { if (items) setTimeout(() => window.print(), 400); }, [items]);
  if (!items) return <main />;
  return (
    <main style={css('flex: 1; padding: 32px 20px; display: flex; flex-direction: column; gap: 18px; background: #fff; color: #1e2a44')}>
      <div className="noprint" style={css('display: flex; gap: 8px; align-items: center')}><BackLink to={href('settings')} /><button onClick={() => window.print()} style={css('height: 44px; padding: 0 16px; border-radius: 22px; border: 0; background: #1E2A44; color: #FFFFFF; font: inherit; font-size: 14px; font-weight: 700')}>列印／存成 PDF</button></div>
      <header><h1 style={css('margin: 0; font-size: 26px; font-weight: 700')}>{trip.name}</h1><p className="num" style={css('margin: 4px 0 0; font-size: 13px; color: #5b6578')}>{md(trip.start)} – {md(trip.end)}，{trip.people} 人</p></header>
      {days.map((d, k) => (
        <section key={d} style={css('break-inside: avoid')}>
          <h2 style={css('margin: 0 0 6px; font-size: 16px; font-weight: 700')}>第 {k + 1} 天　{md(d)} {weekday(d)}</h2>
          {dayCards(items, d).map((i) => (
            <div key={i.id} style={css('display: flex; gap: 12px; padding: 6px 0; border-top: 1px solid #dce1e8; font-size: 14px')}>
              <span className="num" style={css('width: 92px; flex-shrink: 0; color: #5b6578')}>{i.start ? i.start + (i.end ? ' – ' + i.end : '') : '未定'}</span>
              <span style={css('flex: 1')}><b>{i.title}</b><span style={css('color: #5b6578')}>　{TYPE_LABEL[i.type]}{i.orderNumber ? '，訂單 ' + i.orderNumber : ''}</span>{i.note && <span style={css('display: block; color: #5b6578; font-size: 12px')}>{i.note}</span>}</span>
            </div>
          ))}
          {!dayCards(items, d).length && <p style={css('margin: 0; font-size: 13px; color: #5b6578')}>（還沒排）</p>}
        </section>
      ))}
    </main>
  );
}
