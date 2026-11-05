import { useEffect, useRef, type ReactNode } from 'react';
import type { BookingStatus } from '../types';

export const BOOKING_LABEL: Record<BookingStatus, string> = { none: '還沒訂', ordered: '已訂購', confirmed: '訂單確認' };
export const BOOKING_HELP: Record<BookingStatus, string> = {
  none: '還沒下訂',
  ordered: '付款了，還沒收到確認信',
  confirmed: '收到確認信了',
};

export function BookingPill({ status }: { status?: BookingStatus }) {
  if (!status) return null;
  return <span className={'pill ' + status}>{BOOKING_LABEL[status]}</span>;
}

export function Sheet({ title, onClose, children, actions }: { title: string; onClose: () => void; children: ReactNode; actions?: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus(); };
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section ref={ref} className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <span className="grip" aria-hidden="true" />
        <div className="between">
          <h2 style={{ fontSize: 20 }}>{title}</h2>
          {actions}
        </div>
        {children}
      </section>
    </div>
  );
}

export function Toast({ text, action, onAction }: { text: string; action?: string; onAction?: () => void }) {
  return (
    <div className="toast" role="status">
      <span>{text}</span>
      {action && <button onClick={onAction}>{action}</button>}
    </div>
  );
}

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const paths: Record<string, ReactNode> = {
  home: <><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  checks: <><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  back: <path d="M15 18l-6-6 6-6" />,
  chevron: <path d="M9 6l6 6-6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  alert: <path d="M12 9v4M12 17h.01M10.3 3.9L2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />,
  walk: <><circle cx="13" cy="4" r="2" /><path d="M10 22l2-7 3 3v4M8 12l3-4 3 3 3 1" /></>,
};
export function Icon({ name, size = 20 }: { name: keyof typeof paths | string; size?: number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" {...P}>{paths[name]}</svg>;
}
