import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid } from '../db';
import type { Trip } from '../types';
import type { Clock } from '../lib/clock';
import { dueInfo } from '../lib/checklist';
import { md } from '../lib/time';
import { BTN_PRIMARY, css, DSheet, FIELD_INPUT, FIELD_LABEL, I, ROUND_PLUS, TabPage } from '../design';

/** 設計稿「出發前準備」(Checklist) */
export function Prep({ trip, clock }: { trip: Trip; clock: Clock }) {
  const tasks = useLiveQuery(() => db.tasks.where({ tripId: trip.id }).toArray(), [trip.id]);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [daysBefore, setDaysBefore] = useState('3');
  const [group, setGroup] = useState('');
  if (!tasks) return <TabPage><span /></TabPage>;
  const groups = [...new Set(tasks.map((t) => t.group))];
  const done = tasks.filter((t) => t.done).length;

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await db.tasks.add({ id: uid(), tripId: trip.id, group: group.trim() || '其他', title: title.trim(), daysBefore: Math.max(0, parseInt(daysBefore, 10) || 0), done: false });
    setTitle('');
    setAdding(false);
  };

  return (
    <TabPage gap={14}>
      <header style={css('display: flex; justify-content: space-between; align-items: center')}>
        <h1 style={css('margin: 0; font-size: 28px; font-weight: 700')}>出發前準備</h1>
        <button aria-label="新增項目" onClick={() => setAdding(true)} style={css(ROUND_PLUS)}>{I.plus}</button>
      </header>

      <div style={css('display: flex; align-items: center; gap: 12px')}>
        <div role="progressbar" aria-label="準備進度" aria-valuenow={done} aria-valuemin={0} aria-valuemax={tasks.length} style={css('flex: 1; height: 8px; border-radius: 4px; background: #DCE1E8; overflow: hidden')}>
          <div style={{ ...css('height: 100%; background: #1F7A5C'), width: Math.round((done / Math.max(1, tasks.length)) * 100) + '%' }} />
        </div>
        <span className="num" style={css('font-size: 14px; font-weight: 700')}>{done} / {tasks.length}</span>
      </div>
      <p style={css('margin: -6px 0 0; font-size: 13px; color: #5B6578')}>截止日從出發日 {md(trip.start)} 往前算，改了出發日會自動更新。</p>

      {groups.map((g) => (
        <section key={g} style={css('background: #FFFFFF; border-radius: 16px; padding: 10px 16px')}>
          <h2 style={css('margin: 4px 0; font-size: 14px; font-weight: 700; color: #5B6578')}>{g}</h2>
          {tasks.filter((t) => t.group === g).sort((a, b) => b.daysBefore - a.daysBefore).map((t) => {
            const d = dueInfo({ start: trip.start, daysBefore: t.daysBefore, today: clock.date });
            return (
              <div key={t.id} style={css('display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 2px; min-height: 44px; padding: 8px 0; box-sizing: border-box; border-top: 1px solid #EEF1F5')}>
                <label style={css('display: flex; align-items: center; gap: 10px; font-size: 15px; ' + (t.done ? 'color: #5B6578; text-decoration: line-through' : 'color: #1E2A44'))}>
                  <input type="checkbox" checked={t.done} onChange={() => db.tasks.update(t.id, { done: !t.done })} style={css('width: 20px; height: 20px; flex-shrink: 0; accent-color: #1F7A5C')} />{t.title}
                </label>
                <span style={css('margin-left: 30px; font-size: 13px; ' + (t.done ? 'color: #1F7A5C; font-weight: 700' : d.urgent ? 'font-weight: 700; color: #B83A32' : 'color: #5B6578'))}>{t.done ? '完成' : d.text}</span>
              </div>
            );
          })}
        </section>
      ))}
      {!tasks.length && <p style={css('margin: 0; font-size: 14px; color: #5B6578')}>還沒有準備事項。按右上角 ＋ 加一項，例如「換外幣」「買網卡」。</p>}

      {adding && (
        <DSheet title="新增準備事項" onClose={() => setAdding(false)}>
          <form onSubmit={add} style={css('display: flex; flex-direction: column; gap: 14px')}>
            <label style={css(FIELD_LABEL)}>要做什麼<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：預約租車" style={css(FIELD_INPUT)} /></label>
            <div style={css('display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px')}>
              <label style={css(FIELD_LABEL)}>分類<input value={group} onChange={(e) => setGroup(e.target.value)} list="groups" placeholder="其他" style={css(FIELD_INPUT)} /></label>
              <label style={css(FIELD_LABEL)}>出發前幾天完成<input inputMode="numeric" value={daysBefore} onChange={(e) => setDaysBefore(e.target.value.replace(/\D/g, ''))} style={css(FIELD_INPUT)} /></label>
            </div>
            <datalist id="groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
            <button disabled={!title.trim()} style={{ ...css(BTN_PRIMARY), opacity: title.trim() ? 1 : 0.45 }}>加入清單</button>
          </form>
        </DSheet>
      )}
    </TabPage>
  );
}
