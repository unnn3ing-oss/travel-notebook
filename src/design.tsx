import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { href } from './lib/route';

/**
 * 設計稿（Claude Design「旅行手帳 App 介面」）的樣式是 inline CSS 字串。
 * （小寫 hex 不轉換，用在不隨深淺色改變的地方，例如登機證票卡。）
 * 這裡直接吃同一段字串，讓畫面跟設計稿一字不差；顏色換成 CSS 變數，深色模式才跟得上。
 */
const COLOR: Record<string, string> = {
  '#1E2A44': 'var(--ink)', '#5B6578': 'var(--ink-2)', '#8A94A6': 'var(--ink-3)', '#B8C0CC': 'var(--ink-4)',
  '#F4F6F9': 'var(--bg)', '#DCE1E8': 'var(--line)', '#EEF1F5': 'var(--line-2)', '#E4E8EE': 'var(--seg)',
  '#FCEFC7': 'var(--ticket-soft)', '#B83A32': 'var(--warn)', '#F9E1DF': 'var(--warn-soft)', '#E8B4AF': 'var(--warn-line)',
  '#1F7A5C': 'var(--ok)', '#DDF1E8': 'var(--ok-soft)', '#8A5A00': 'var(--amber)', '#FBE9C0': 'var(--amber-soft)', '#C9D1DE': 'var(--on-ink-2)',
};
const cache = new Map<string, CSSProperties>();
export function css(s: string): CSSProperties {
  const hit = cache.get(s);
  if (hit) return hit;
  const out: Record<string, string> = {};
  for (const decl of s.split(';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim();
    let val = decl.slice(i + 1).trim();
    if (!prop) continue;
    val = val.replace(/#[0-9A-F]{6}\b/g, (u) => {
      if (u === '#FFFFFF') return /background/.test(prop) ? 'var(--card)' : 'var(--on-ink)';
      return COLOR[u] ?? u;
    });
    out[prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = val;
  }
  cache.set(s, out as CSSProperties);
  return out as CSSProperties;
}

const SVG = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
export const I = {
  back: <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" {...SVG} strokeWidth="2.2"><path d="M15 18l-6-6 6-6" /></svg>,
  down: <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" {...SVG} strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>,
  chev: <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" {...SVG} strokeWidth="2.2"><path d="M9 6l6 6-6 6" /></svg>,
  plus: <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" {...SVG} strokeWidth="2.4"><path d="M12 5v14M5 12h14" /></svg>,
  close: <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" {...SVG} strokeWidth="2.4"><path d="M6 6l12 12M18 6L6 18" /></svg>,
  clock: <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" {...SVG} strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>,
  pin: <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" {...SVG} strokeWidth="2"><path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>,
  out: <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" {...SVG} strokeWidth="2"><path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" /></svg>,
  search: <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" {...SVG} strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>,
  grip: <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" /><circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" /></svg>,
  plane: <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" {...SVG} stroke="var(--ink-2)" strokeWidth="2"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" /></svg>,
  bed: <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" {...SVG} stroke="var(--ink-2)" strokeWidth="2"><path d="M3 18V6M3 13h18v5M21 13a3 3 0 0 0-3-3h-7v3" /><circle cx="7" cy="10" r="1.5" /></svg>,
  train: <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" {...SVG} stroke="var(--ink-2)" strokeWidth="2"><rect x="5" y="3" width="14" height="14" rx="3" /><path d="M5 11h14M8 21l2-4M16 21l-2-4" /></svg>,
  food: <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" {...SVG} stroke="var(--ink-2)" strokeWidth="2"><path d="M7 3v8M5 3v4a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 0-3 2-3 5s1 4 3 4v9" /></svg>,
  ticket: <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" {...SVG} stroke="var(--ink-2)" strokeWidth="2"><path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z" /><path d="M15 7v10" strokeDasharray="2 2" /></svg>,
};

const NAV_ICON: Record<string, ReactNode> = {
  overview: <><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></>,
  today: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  plan: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  bookings: <><path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z" /><path d="M15 7v10" strokeDasharray="2 2" /></>,
  essentials: <><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" /></>,
};

/** 設計稿底部四格導覽：總覽（出發前）／今日（旅途中）、行程、預訂、必備 */
export function Nav({ current, during }: { current: string; during: boolean }) {
  const tabs: [string, string][] = [[during ? 'today' : 'overview', during ? '今日' : '總覽'], ['plan', '行程'], ['bookings', '預訂'], ['essentials', '必備']];
  return (
    <nav aria-label="主選單" className="dnav" style={css('min-height: 84px; box-sizing: border-box; padding: 6px 8px 24px; background: #FFFFFF; border-top: 1px solid #DCE1E8; display: flex')}>
      {tabs.map(([to, label]) => {
        const on = current === to;
        return (
          <a key={to} href={href(to)} aria-current={on ? 'page' : undefined} style={css('flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; text-decoration: none; font-size: 11px; ' + (on ? 'color: #1E2A44; font-weight: 700' : 'color: #5B6578'))}>
            <span style={css('width: 64px; min-height: 48px; padding: 4px 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; border-radius: 16px; ' + (on ? 'background: var(--ticket); color: var(--on-ticket)' : ''))}>
              <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" {...SVG} strokeWidth="2">{NAV_ICON[to]}</svg>
              <span>{label}</span>
            </span>
          </a>
        );
      })}
    </nav>
  );
}

/** 有底部導覽的主畫面：內容區 + 固定導覽 */
export function TabPage({ children, pad = '56px 20px 16px', gap = 16 }: { children: ReactNode; pad?: string; gap?: number }) {
  return <main className="dmain" style={{ padding: pad.replace(/^(\d+)px/, 'calc(env(safe-area-inset-top) + $1px)'), display: 'flex', flexDirection: 'column', gap }}>{children}</main>;
}

/** 返回鍵：設計稿 44px 白色圓鈕 */
export function BackLink({ to, label = '返回' }: { to: string; label?: string }) {
  return <a href={to} aria-label={label} style={css('width: 44px; height: 44px; flex-shrink: 0; border-radius: 22px; background: #FFFFFF; display: flex; align-items: center; justify-content: center; color: #1E2A44')}>{I.back}</a>;
}

export const pill = (bg: string, fg: string) => css('font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 12px; white-space: nowrap; background: ' + bg + '; color: ' + fg);
export const PILL_NONE = pill('#F9E1DF', '#B83A32');
export const PILL_ORDERED = pill('#FBE9C0', '#8A5A00');
export const PILL_OK = pill('#DDF1E8', '#1F7A5C');
export const PILL_NOW = css('font-size: 12px; font-weight: 700; background: var(--ticket); color: var(--on-ticket); padding: 4px 10px; border-radius: 12px');

/** 設計稿的底部面板（同 PlanB）：遮罩 + 圓角白底 + 拉桿 + 右上關閉 */
export function DSheet({ title, sub, onClose, children, wide=false }: { title: string; sub?: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose); closeRef.current=onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    (ref.current?.querySelector<HTMLElement>('input, select, textarea') || ref.current?.querySelector<HTMLElement>('button'))?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); closeRef.current(); }
      if (e.key === 'Tab' && ref.current) {
        const controls=Array.from(ref.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(el=>el.getClientRects().length);
        const first=controls[0],last=controls.at(-1),active=document.activeElement;
        if(!first){e.preventDefault();return;}
        if(!ref.current.contains(active)||e.shiftKey&&active===first||!e.shiftKey&&active===last){e.preventDefault();(e.shiftKey?last:first)?.focus();}
      }
    };
    addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { removeEventListener('keydown', onKey); document.body.style.overflow = ''; if(prev?.isConnected)prev.focus(); };
  }, []);
  return (
    <div className={'dsheet'+(wide?' dsheet-wide':'')} style={css('position: fixed; inset: 0; z-index: 40; display: flex; flex-direction: column; justify-content: flex-end; align-items: center')}>
      <div aria-hidden="true" onClick={onClose} style={css('position: absolute; inset: 0; background: rgba(30,42,68,0.55)')} />
      <section ref={ref} role="dialog" aria-modal="true" aria-labelledby="dsheet-h" style={{...css('position: relative; width: 100%; box-sizing: border-box; max-height: 92dvh; overflow-y: auto; background: #FFFFFF; border-radius: 24px 24px 0 0; padding: 10px 20px max(34px, env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 16px'),maxWidth:480}}>
        <span aria-hidden="true" style={css('align-self: center; width: 40px; height: 5px; flex-shrink: 0; border-radius: 3px; background: #DCE1E8')} />
        <div style={css('display: flex; justify-content: space-between; align-items: flex-start; gap: 12px')}>
          <div>
            {sub && <p className="num" style={css('margin: 0; font-size: 13px; color: #5B6578')}>{sub}</p>}
            <h2 id="dsheet-h" style={css('margin: 2px 0 0; font-size: 22px; font-weight: 700')}>{title}</h2>
          </div>
          <button onClick={onClose} aria-label="關閉" style={css('width: 44px; height: 44px; flex-shrink: 0; border-radius: 22px; border: 0; background: #F4F6F9; display: flex; align-items: center; justify-content: center; color: #1E2A44')}>{I.close}</button>
        </div>
        {children}
      </section>
    </div>
  );
}

/** 設計稿的欄位：小標 + 白底輸入框 */
export const FIELD_LABEL = 'display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #5B6578';
export const FIELD_INPUT = 'height: 48px; box-sizing: border-box; border: 1px solid #DCE1E8; border-radius: 12px; padding: 0 14px; font: inherit; font-size: 16px; color: #1E2A44; background: #FFFFFF; width: 100%';
export const BTN_PRIMARY = 'height: 54px; border-radius: 14px; border: 0; background: #1E2A44; color: #FFFFFF; font: inherit; font-size: 16px; font-weight: 700';
export const BTN_GHOST = 'height: 44px; border: 0; background: transparent; color: #1E2A44; font: inherit; font-size: 15px';
export const ROUND_PLUS = 'width: 44px; height: 44px; flex-shrink: 0; border-radius: 22px; border: 0; background: #1E2A44; color: #FFFFFF; display: flex; align-items: center; justify-content: center';

/** 底部黑色提示條（含「復原」） */
export function DToast({ text, action, onAction, bottom = 100 }: { text: ReactNode; action?: string; onAction?: () => void; bottom?: number }) {
  return (
    <div role="status" style={{ ...css('position: fixed; left: 20px; right: 20px; min-height: 52px; box-sizing: border-box; padding: 6px 8px 6px 16px; border-radius: 14px; background: var(--toast); color: #fff; display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 14px; z-index: 30; max-width: 440px; margin: 0 auto'), bottom }}>
      <span>{text}</span>
      {action && <button onClick={onAction} style={css('height: 40px; padding: 0 14px; border: 0; border-radius: 10px; background: transparent; color: var(--ticket); font: inherit; font-size: 14px; font-weight: 700')}>{action}</button>}
    </div>
  );
}

/**
 * 骨架屏：資料還沒讀出來時先畫出版面輪廓。每格 [高度, 圓角?, 寬度?]，
 * 尺寸照實際畫面量測，資料進來時版面不會跳。
 */
export type SkBlock = [number, number?, string?];
export function Skeleton({ blocks, pad = '56px 20px 16px', gap = 16 }: { blocks: SkBlock[]; pad?: string; gap?: number }) {
  return (
    <main className="dmain" aria-busy="true" style={{ padding: pad.replace(/^(\d+)px/, 'calc(env(safe-area-inset-top) + $1px)'), display: 'flex', flexDirection: 'column', gap }}>
      <span className="visually-hidden" role="status">載入中</span>
      {blocks.map(([h, r = 16, w = '100%'], i) => <div key={i} aria-hidden="true" className="sk" style={{ height: h, borderRadius: r, width: w, flexShrink: 0 }} />)}
    </main>
  );
}
export const SK = {
  overview: [[58, 12, '60%'], [121], [218], [252]] as SkBlock[],
  today: [[58, 12, '60%'], [295, 18], [150], [219]] as SkBlock[],
  plan: [[44, 12, '50%'], [64, 14], [88, 14], [88, 14], [88, 14], [88, 14]] as SkBlock[],
  bookings: [[44, 12, '50%'], [36, 18], [73], [98], [150], [73]] as SkBlock[],
  prep: [[44, 12, '50%'], [18, 4], [19, 6, '80%'], [176], [112], [176]] as SkBlock[],
  transit: [[44, 22, '44px'], [92], [120, 14], [150, 14], [260]] as SkBlock[],
  page: [[44, 22, '44px'], [72, 12, '70%'], [200], [160]] as SkBlock[],
};
