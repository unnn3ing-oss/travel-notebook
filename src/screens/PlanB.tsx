import { useEffect, useState } from 'react';
import { db } from '../db';
import type { Item } from '../types';
import { BOOKING_LABEL, Sheet, Toast } from '../components/ui';

const REASONS = ['停駛', '客滿', '誤點', '不想去了'];

/** 改用備案：swap the card for one of its alternatives, with undo. */
export function PlanB({ item, onClose, initialPick = 0 }: { item: Item; onClose: () => void; initialPick?: number }) {
  const [reason, setReason] = useState(REASONS[0]);
  const [pick, setPick] = useState(initialPick);
  const alts = item.alts ?? [];
  const chosen = alts[pick];

  const apply = async () => {
    if (!chosen) return;
    const rest = alts.filter((_, i) => i !== pick);
    await db.items.update(item.id, {
      title: chosen.name,
      booking: chosen.status,
      alts: [{ name: item.title, status: item.booking ?? 'none', note: '原本的安排' }, ...rest],
      replaced: { title: item.title, booking: item.booking, reason },
    });
    onClose();
    showUndo(item, chosen.name);
  };

  return (
    <Sheet title={item.title + '不能去了？'} onClose={onClose}>
      <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
        <legend className="eyebrow" style={{ padding: 0, marginBottom: 8 }}>原因</legend>
        <div className="chips">
          {REASONS.map((r) => <button key={r} className="chip" aria-pressed={reason === r} onClick={() => setReason(r)}>{r}</button>)}
        </div>
      </fieldset>
      <fieldset style={{ border: 0, margin: 0, padding: 0 }} className="stack">
        <legend className="eyebrow" style={{ padding: 0, marginBottom: 8 }}>選一個備案</legend>
        {alts.map((a, i) => (
          <label key={i} className={'dep' + (i === pick ? ' on' : '')} style={{ margin: 0 }}>
            <input type="radio" name="alt" checked={i === pick} onChange={() => setPick(i)} />
            <span className="stack" style={{ gap: 2 }}>
              <b>{a.name}</b>
              <span className="small muted">{BOOKING_LABEL[a.status]}{a.note ? '，' + a.note : ''}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <button className="btn primary" onClick={apply} disabled={!chosen}>改用{chosen?.name ?? '備案'}</button>
      <button className="btn link" onClick={onClose}>先不換，照原行程</button>
    </Sheet>
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
  return t ? <Toast text={t.text} action="復原" onAction={() => { t.undo(); setT(null); }} /> : null;
}

function showUndo(before: Item, name: string) {
  const t: Undo = { text: '已改用' + name + '，行程已更新', undo: () => { db.items.put(before); } };
  listeners.forEach((f) => f(t));
}
