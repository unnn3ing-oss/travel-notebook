import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ensureSeed } from './db';
import { useClock } from './lib/clock';
import { href, useRoute } from './lib/route';
import { daysBetween } from './lib/time';
import { Icon } from './components/ui';
import { Today } from './screens/Today';
import { Overview } from './screens/Overview';
import { Plan } from './screens/Plan';
import { Transit } from './screens/Transit';
import { Prep } from './screens/Prep';
import { UndoToastHost } from './screens/PlanB';

export default function App() {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState('');
  useEffect(() => { ensureSeed().then(() => setReady(true), (e) => setFailed(String(e?.message ?? e))); }, []);
  const trip = useLiveQuery(() => (ready ? db.trips.orderBy('start').first() : undefined), [ready]);
  const clock = useClock();
  const [page, arg] = useRoute();

  if (failed) return <main className="screen"><h1>資料庫打不開</h1><p>{failed}</p><p className="muted">Safari 的無痕模式不能存資料，請用一般模式開啟。</p></main>;
  if (!trip) return null;

  const during = daysBetween(trip.start, clock.date) >= 0 && daysBetween(clock.date, trip.end) >= 0;
  const home = during ? 'today' : 'overview';
  const p = page || home;

  return (
    <div className="app">
      {clock.simulated && <div className="sim">模擬時間：{clock.date} {clock.time}</div>}
      {p === 'today' && during && <Today trip={trip} clock={clock} />}
      {(p === 'overview' || (p === 'today' && !during)) && <Overview trip={trip} clock={clock} />}
      {p === 'plan' && <Plan trip={trip} day={arg} />}
      {p === 'transit' && arg && <Transit trip={trip} clock={clock} itemId={arg} />}
      {p === 'prep' && <Prep trip={trip} clock={clock} />}
      <UndoToastHost />
      <nav className="nav" aria-label="主選單">
        <ul>
          <li><a href={href(home)} aria-current={p === home ? 'page' : undefined}><span className="ic"><Icon name={during ? 'sun' : 'home'} size={22} /></span>{during ? '今日' : '總覽'}</a></li>
          <li><a href={href('plan')} aria-current={p === 'plan' || p === 'transit' ? 'page' : undefined}><span className="ic"><Icon name="calendar" size={22} /></span>行程</a></li>
          <li><a href={href('prep')} aria-current={p === 'prep' ? 'page' : undefined}><span className="ic"><Icon name="checks" size={22} /></span>準備</a></li>
        </ul>
      </nav>
    </div>
  );
}
