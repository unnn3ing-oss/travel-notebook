import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid } from '../db';
import type { Trip } from '../types';
import type { Clock } from '../lib/clock';
import { dueInfo } from '../lib/checklist';
import { Back } from './Trips';
import { md } from '../lib/time';

export function Prep({ trip, clock }: { trip: Trip; clock: Clock }) {
  const tasks = useLiveQuery(() => db.tasks.where({ tripId: trip.id }).toArray(), [trip.id]);
  const [title, setTitle] = useState('');
  const [daysBefore, setDaysBefore] = useState('3');
  const [group, setGroup] = useState('其他');
  if (!tasks) return null;
  const groups = [...new Set(tasks.map((t) => t.group))];
  const done = tasks.filter((t) => t.done).length;

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await db.tasks.add({ id: uid(), tripId: trip.id, group: group.trim() || '其他', title: title.trim(), daysBefore: Math.max(0, parseInt(daysBefore, 10) || 0), done: false });
    setTitle('');
  };

  return (
    <main className="screen standalone"><Back to="essentials"/>
      <header className="between" style={{ alignItems: 'flex-end' }}>
        <h1>出發前準備</h1>
        <b className="num">{done} / {tasks.length}</b>
      </header>
      <p className="small muted" style={{ margin: 0 }}>期限從出發日 {md(trip.start)} 往前算，改了出發日會自動更新。</p>

      {groups.map((g) => (
        <section key={g} className="card" style={{ gap: 0, padding: '8px 16px' }}>
          <h2 className="small muted" style={{ margin: '6px 0' }}>{g}</h2>
          {tasks.filter((t) => t.group === g).sort((a, b) => b.daysBefore - a.daysBefore).map((t) => {
            const d = dueInfo({ start: trip.start, daysBefore: t.daysBefore, today: clock.date });
            return (
              <div key={t.id} style={{ borderTop: '1px solid var(--line-2)', padding: '8px 0' }}>
                <label className={'check' + (t.done ? ' done' : '')}><input type="checkbox" checked={t.done} onChange={() => db.tasks.update(t.id, { done: !t.done })} /><span>{t.title}</span></label>
                <span className="small" style={{ marginLeft: 30, color: t.done ? 'var(--ok)' : d.urgent ? 'var(--warn)' : 'var(--ink-2)', fontWeight: t.done || d.urgent ? 700 : 400 }}>{t.done ? '完成' : d.text}</span>
              </div>
            );
          })}
        </section>
      ))}

      <form className="card" onSubmit={add} aria-labelledby="add-h">
        <h2 id="add-h">加一項準備</h2>
        <label className="field">要做什麼<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：預約租車" /></label>
        <div className="grid2">
          <label className="field">分類<input value={group} onChange={(e) => setGroup(e.target.value)} list="groups" /></label>
          <label className="field">出發前幾天要完成<input inputMode="numeric" value={daysBefore} onChange={(e) => setDaysBefore(e.target.value)} /></label>
        </div>
        <datalist id="groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
        <button className="btn primary" disabled={!title.trim()}>加入清單</button>
      </form>
    </main>
  );
}
