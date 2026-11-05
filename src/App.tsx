import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { useClock } from './lib/clock';
import { href, useRoute } from './lib/route';
import { Icon } from './components/ui';
import { Today } from './screens/Today';
import { Overview } from './screens/Overview';
import { Plan } from './screens/Plan';
import { Transit } from './screens/Transit';
import { Prep } from './screens/Prep';
import { UndoToastHost } from './screens/PlanB';
import { Welcome } from './screens/Welcome';
import { NewTrip, PastTrips } from './screens/Trips';
import { Bookings } from './screens/Bookings';
import { Essentials } from './screens/Essentials';
import { Library } from './screens/Library';
import { Settings } from './screens/Settings';
import type { Trip } from './types';

export default function App() {
  const [ready,setReady]=useState(false); const [failed,setFailed]=useState('');
  const [selected,setSelected]=useState(()=>localStorage.getItem('travel-selected-trip'));
  useEffect(()=>{db.open().then(()=>setReady(true),e=>setFailed(String(e?.message??e)));document.documentElement.dataset.theme=localStorage.getItem('travel-theme')||'system';},[]);
  const trips=useLiveQuery(()=>ready?db.trips.orderBy('start').toArray():[],[ready]);
  const clock=useClock(trips?.find(t=>t.id===selected)?.timezone); const [page,arg]=useRoute();
  const select=(t:Trip)=>{localStorage.setItem('travel-selected-trip',t.id);setSelected(t.id);};
  if(failed)return <main className="screen"><h1>資料庫打不開</h1><p>{failed}</p><button className="btn primary" onClick={()=>location.reload()}>重新載入</button></main>;
  if(!ready||!trips)return <main className="screen" role="status">正在開啟旅行手帳…</main>;
  const trip=trips.find(t=>t.id===selected)??trips.find(t=>t.end>=clock.date)??trips[0];
  const during=trip&&trip.start<=clock.date&&clock.date<=trip.end;
  const home=during?'today':'overview';
  const landing=!page||page==='welcome';
  const standalone=landing||['new','past','library','settings','prep'].includes(page);
  return <div className={'app'+(landing?' welcome-app':page==='plan'?' planning-app':'')}>
    {landing?<Welcome trips={trips} today={clock.date} select={select}/>:page==='new'?<NewTrip select={select}/>:page==='past'?<PastTrips trips={trips} today={clock.date} select={select}/>:trip?<>
      {clock.simulated&&<div className="sim">模擬時間：{clock.date} {clock.time}</div>}
      {page==='today'&&during&&<Today trip={trip} clock={clock}/>}
      {(page==='overview'||(page==='today'&&!during))&&<Overview trip={trip} clock={clock}/>}
      {page==='plan'&&<Plan key={trip.id} trip={trip} day={arg}/>}
      {page==='transit'&&arg&&<Transit trip={trip} clock={clock} itemId={arg}/>}
      {page==='prep'&&<Prep trip={trip} clock={clock}/>}
      {page==='bookings'&&<Bookings trip={trip}/>}
      {page==='essentials'&&<Essentials key={trip.id} trip={trip} clock={clock}/>}
      {page==='library'&&<Library trip={trip}/>}
      {page==='settings'&&<Settings trip={trip}/>}
      {!['today','overview','plan','transit','prep','bookings','essentials','library','settings'].includes(page)&&<main className="screen"><h1>找不到這個頁面</h1><a className="btn primary" href={href('')}>回起始頁</a></main>}
    </>:<main className="screen"><h1>還沒有旅程</h1><a className="btn primary" href={href('new')}>開始新旅程</a></main>}
    <UndoToastHost/>
    {!standalone&&trip&&<nav className="nav" aria-label="主選單"><ul>{[[home,during?'今日':'總覽',during?'sun':'home'],['plan','行程','calendar'],['bookings','預訂','ticket'],['essentials','必備','checks']].map(([to,label,icon])=><li key={to}><a href={href(to)} aria-current={page===to||(to==='plan'&&page==='transit')?'page':undefined}><span className="ic"><Icon name={icon} size={22}/></span>{label}</a></li>)}</ul></nav>}
  </div>;
}
