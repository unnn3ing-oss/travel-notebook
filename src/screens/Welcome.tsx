import { upcomingTrips } from '../lib/trips';
import { href } from '../lib/route';
import { daysBetween, md } from '../lib/time';
import { Icon } from '../components/ui';
import type { Trip } from '../types';

export function Welcome({ trips, today, select }: { trips: Trip[]; today: string; select: (trip: Trip) => void }) {
  const upcoming = upcomingTrips(trips, today);
  return <main className="welcome">
    <svg className="welcome-route" aria-hidden="true" viewBox="0 0 390 300" fill="none"><path d="M-10 230 C 80 120, 170 260, 250 140 S 360 40, 410 70" stroke="#F2C14E" strokeWidth="2" strokeDasharray="6 8" strokeLinecap="round" /><circle cx="250" cy="140" r="6" fill="#F2C14E" /></svg>
    <h1>旅行<br />手帳</h1>
    <p className="welcome-intro">排行程、存備案，旅途中只看現在和下一站。</p>
    <div className="welcome-actions">
      {upcoming.map(t => <a key={t.id} className="welcome-action highlighted" href={href(t.start <= today ? 'today' : 'overview')} onClick={() => select(t)}>
        <span><small>{t.start <= today ? '旅程進行中' : `即將出發 · 還有 ${daysBetween(today, t.start)} 天`}</small><strong>{t.name}</strong><small className="num">{md(t.start)} – {md(t.end)} · {t.people} 人</small></span><Icon name="chevron" size={24} />
      </a>)}
      <a className={'welcome-action ' + (!upcoming.length ? 'highlighted' : 'outlined')} href={href('new')}><span><strong>開始新旅程</strong><small>設定目的地和日期，開始排行程</small></span><Icon name="plus" size={24} /></a>
      <a className="welcome-action outlined" href={href('past')}><span><strong>回顧過去旅行</strong><small>去過的地方、筆記和花費</small></span><Icon name="chevron" size={22} /></a>
    </div>
  </main>;
}
