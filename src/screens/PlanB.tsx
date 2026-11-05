import { useEffect, useState } from 'react';
import { db } from '../db';
import type { Alternative, Item } from '../types';
import { BTN_GHOST, BTN_PRIMARY, css, DSheet, DToast } from '../design';
import { swapAlt } from './Bookings';

const REASONS = ['客滿', '誤點', '停駛', '不想去了'];

/** 設計稿「改用備案」(PlanB) 面板：換成備案，可復原 */
export function PlanB({ item, onClose, initialPick = 0 }: { item: Item; onClose: () => void; initialPick?: number }) {
  const [reason, setReason] = useState(REASONS[0]);
  const [pick, setPick] = useState(initialPick);
  const alts = item.alts ?? [];
  const chosen = alts[pick];

  const apply = async () => {
    if (!chosen) return;
    await db.items.update(item.id, swapAlt(item, pick, reason));
    onClose();
    showUndo(item, chosen.name);
  };
  const impact = (a: Alternative) => {
    if (a.note === '不用預約' || a.status === 'confirmed') return { text: (a.status === 'confirmed' ? '訂單確認' : '不用預約') + '，可以直接去', warn: false };
    if (a.status === 'ordered') return { text: '已訂購，還沒收到確認信', warn: false };
    return { text: '還沒訂，要先訂到才能用' + (a.note ? '（' + a.note + '）' : ''), warn: true };
  };

  return (
    <DSheet title={item.title + '不能去了？'} sub={item.start ? item.start + (item.end ? ' – ' + item.end : '') : undefined} onClose={onClose}>
      <fieldset style={css('border: 0; margin: 0; padding: 0')}>
        <legend style={css('font-size: 13px; color: #5B6578; padding: 0; margin-bottom: 8px')}>原因</legend>
        <div style={css('display: flex; flex-wrap: wrap; gap: 8px')}>
          {REASONS.map((r) => <button key={r} aria-pressed={reason === r} onClick={() => setReason(r)} style={css('height: 40px; padding: 0 16px; border-radius: 20px; font: inherit; font-size: 14px; ' + (r === reason ? 'border: 0; background: #1E2A44; color: #FFFFFF; font-weight: 700' : 'border: 1px solid #DCE1E8; background: #FFFFFF; color: #1E2A44'))}>{r}</button>)}
        </div>
      </fieldset>
      <fieldset style={css('border: 0; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px')}>
        <legend style={css('font-size: 13px; color: #5B6578; padding: 0; margin-bottom: 8px')}>選一個備案</legend>
        {alts.map((a, i) => {
          const im = impact(a);
          return (
            <label key={i} style={css('display: flex; gap: 12px; padding: 14px; border-radius: 14px; cursor: pointer; ' + (i === pick ? 'border: 2px solid #1E2A44; background: #FFFFFF' : 'border: 1px solid #DCE1E8; background: #F4F6F9'))}>
              <input type="radio" name="alt" checked={i === pick} onChange={() => setPick(i)} style={css('width: 20px; height: 20px; margin: 2px 0 0; accent-color: #1E2A44')} />
              <span style={css('flex: 1; display: flex; flex-direction: column; gap: 3px')}>
                <span style={css('font-size: 16px; font-weight: 700')}>{a.name}</span>
                {item.start && <span className="num" style={css('font-size: 13px; color: #5B6578')}>{item.start}{item.end ? ' – ' + item.end : ''}</span>}
                <span style={css('font-size: 13px; font-weight: 700; color: ' + (im.warn ? '#B83A32' : '#1F7A5C'))}>{im.text}</span>
              </span>
            </label>
          );
        })}
      </fieldset>
      <button onClick={apply} disabled={!chosen} style={css(BTN_PRIMARY)}>改用{chosen?.name ?? '備案'}</button>
      <button onClick={onClose} style={css(BTN_GHOST)}>先不換，照原行程</button>
    </DSheet>
  );
}

type Undo = { text: string; undo: () => void };
const listeners = new Set<(t: Undo) => void>();

/** Lives at the app root so the toast outlives the sheet that triggered it. */
export function UndoToastHost() {
  const [t, setT] = useState<Undo | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const on = (v: Undo) => {
      setT(v);
      clearTimeout(timer);
      timer = setTimeout(() => setT(null), 8000);
    };
    listeners.add(on);
    return () => { listeners.delete(on); clearTimeout(timer); };
  }, []);
  return t ? <DToast text={t.text} action="復原" onAction={() => { t.undo(); setT(null); }} /> : null;
}

function showUndo(before: Item, name: string) {
  const t: Undo = { text: '已改用' + name + '，行程已更新', undo: () => { db.items.put(before); } };
  listeners.forEach((f) => f(t));
}
