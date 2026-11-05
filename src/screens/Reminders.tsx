import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { addDays, md } from '../lib/time';
import { href } from '../lib/route';
import { buildReminders, isOn, loadRules, quiet, saveRules, type Rules } from '../lib/reminders';
import { BackLink, css } from '../design';
import type { Trip } from '../types';
import type { Clock } from '../lib/clock';

const SEL = 'height: 40px; border: 1px solid #DCE1E8; border-radius: 10px; padding: 0 8px; font: inherit; font-size: 14px; color: #1E2A44; background: #FFFFFF';
const RULE = 'display: flex; justify-content: space-between; align-items: center; gap: 12px; min-height: 56px; border-bottom: 1px solid #DCE1E8; font-size: 15px';
const SWITCH = 'width: 44px; height: 26px; flex-shrink: 0; accent-color: #1F7A5C';

/** 設計稿「提醒」(Reminders) */
export function Reminders({ trip, clock }: { trip: Trip; clock: Clock }) {
  const items = useLiveQuery(() => db.items.where({ tripId: trip.id }).toArray(), [trip.id]) ?? [];
  const routes = useLiveQuery(() => db.routes.toArray(), []) ?? [];
  const [rules, setRules] = useState<Rules>(loadRules);
  const [perm, setPerm] = useState(() => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission));
  const set = (p: Partial<Rules>) => { const r = { ...rules, ...p }; setRules(r); saveRules(r); };
  const list = buildReminders(items, routes, rules, clock.date).filter((r) => r.date > clock.date || r.time >= clock.time);
  const tomorrow = addDays(clock.date, 1);
  const groups: { title: string; items: typeof list }[] = [];
  for (const r of list) {
    const title = r.date === clock.date ? '今天 ' + md(r.date) : r.date === tomorrow ? '明天 ' + md(r.date) : '之後';
    let g = groups.find((x) => x.title === title);
    if (!g) groups.push((g = { title, items: [] }));
    g.items.push(r);
  }
  const standalone = typeof matchMedia !== 'undefined' && matchMedia('(display-mode: standalone)').matches;
  const ios = /iPhone|iPad/.test(navigator.userAgent);

  return (
    <main style={css('flex: 1; padding: 52px 20px 32px; display: flex; flex-direction: column; gap: 20px')}>
      <BackLink to={href('today')} label="返回今日" />
      <header>
        <h1 style={css('margin: 0; font-size: 28px; font-weight: 700')}>提醒</h1>
        <p style={css('margin: 4px 0 0; font-size: 14px; color: #5B6578')}>依行程、交通和預訂自動排好，不想要的可以關掉。</p>
      </header>

      {perm !== 'granted' && (
        <div style={css('padding: 14px; border-radius: 14px; background: #FCEFC7; display: flex; flex-direction: column; gap: 8px')}>
          <p style={css('margin: 0; font-size: 14px; line-height: 1.6')}>
            {ios && !standalone ? <><strong>iPhone 要先把 App 加到主畫面</strong>，才收得到提醒。在 Safari 按分享，選「加入主畫面」。</>
              : perm === 'denied' ? <>通知被關掉了，要到瀏覽器或手機設定裡打開。</>
              : perm === 'unsupported' ? <>這個瀏覽器不支援通知。</>
              : <>打開通知，App 開著的時候到點會跳提醒。</>}
          </p>
          {perm === 'default' && <button onClick={async () => setPerm(await Notification.requestPermission())} style={css('align-self: flex-start; height: 40px; padding: 0 14px; border-radius: 10px; border: 0; background: #1E2A44; color: #FFFFFF; font: inherit; font-size: 14px; font-weight: 700')}>開啟通知</button>}
        </div>
      )}

      {groups.map((g) => (
        <section key={g.title} style={css('display: flex; flex-direction: column')}>
          <h2 style={css('margin: 0 0 4px; font-size: 14px; font-weight: 700; color: #5B6578')}>{g.title}</h2>
          <ul style={css('list-style: none; margin: 0; padding: 0')}>
            {g.items.map((r) => {
              const on = isOn(r, rules);
              const ruleOff = r.kind === 'transit' && !rules.transitOn;
              const time = g.title === '之後' ? md(r.date) + ' ' + r.time : r.time;
              return (
                <li key={r.id} style={css('display: flex; align-items: center; gap: 12px; min-height: 64px; border-bottom: 1px solid #DCE1E8')}>
                  <span className="num" style={css('width: ' + (time.length > 5 ? '84px' : '48px') + '; flex-shrink: 0; font-size: 15px; font-weight: 700; ' + (on ? '' : 'color: #8A94A6'))}>{time}</span>
                  <span style={css('flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px')}>
                    <span style={css('font-size: 15px; font-weight: 700; ' + (on ? (r.warn ? 'color: #B83A32' : '') : 'color: #8A94A6; text-decoration: line-through'))}>{r.text}</span>
                    <span style={css('font-size: 12px; color: #5B6578')}>{ruleOff ? '交通提醒已在下方規則關閉' : r.why}{on && quiet(r.time) ? '（在安靜時段，不會跳通知）' : ''}</span>
                  </span>
                  <input type="checkbox" role="switch" aria-label={r.text + ' 的提醒'} checked={on} disabled={ruleOff} onChange={() => set({ off: on ? [...rules.off, r.id] : rules.off.filter((x) => x !== r.id) })} style={css(SWITCH)} />
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {!groups.length && <p style={css('margin: 0; font-size: 14px; color: #5B6578')}>還沒有要提醒的事。排好行程、交通或預訂後，會自動出現在這裡。</p>}

      <section aria-labelledby="rule-h" style={css('display: flex; flex-direction: column')}>
        <h2 id="rule-h" style={css('margin: 0 0 4px; font-size: 14px; font-weight: 700; color: #5B6578')}>自動提醒規則</h2>
        <label style={css(RULE)}>行程開始前
          <select value={rules.lead} onChange={(e) => set({ lead: +e.target.value })} style={css(SEL)}><option value={10}>10 分鐘</option><option value={30}>30 分鐘</option><option value={60}>1 小時</option></select>
        </label>
        <label style={css(RULE)}>交通：最晚出發去搭車的時間
          <input type="checkbox" role="switch" checked={rules.transitOn} onChange={() => set({ transitOn: !rules.transitOn })} style={css(SWITCH)} />
        </label>
        <label style={css(RULE)}>預訂的免費取消期限前
          <select value={rules.cancelLead} onChange={(e) => set({ cancelLead: +e.target.value })} style={css(SEL)}><option value={1}>1 天</option><option value={2}>2 天</option><option value={3}>3 天</option></select>
        </label>
        <div style={css(RULE)}>安靜時段（不提醒）<span className="num" style={css('font-size: 14px; color: #5B6578')}>23:00 – 06:00</span></div>
      </section>
    </main>
  );
}

/** App 開著時，到點用系統通知提醒（同一則只跳一次） */
export function useNotifier(tripId: string | undefined, clock: Clock) {
  const items = useLiveQuery(() => (tripId ? db.items.where({ tripId }).toArray() : []), [tripId]);
  const routes = useLiveQuery(() => db.routes.toArray(), []);
  useEffect(() => {
    if (!items || !routes || typeof Notification === 'undefined' || Notification.permission !== 'granted' || clock.simulated) return;
    const rules = loadRules();
    let fired: string[] = [];
    try { fired = JSON.parse(localStorage.getItem('travel-fired') || '[]'); } catch { /* ignore */ }
    const due = buildReminders(items, routes, rules, clock.date).filter((r) => r.date === clock.date && r.time <= clock.time && isOn(r, rules) && !quiet(r.time) && !fired.includes(r.date + r.id));
    for (const r of due) {
      try { new Notification(r.text, { body: r.why, tag: r.id }); } catch { /* iOS 需透過 service worker，失敗就略過 */ }
      fired.push(r.date + r.id);
    }
    if (due.length) try { localStorage.setItem('travel-fired', JSON.stringify(fired.slice(-200))); } catch { /* ignore */ }
  }, [items, routes, clock.date, clock.time, clock.simulated]);
}
