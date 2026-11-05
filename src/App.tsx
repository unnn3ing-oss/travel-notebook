import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ensureSeed } from './db';
import { useClock } from './lib/clock';
import { href, useRoute } from './lib/route';
import { Nav } from './design';
import { Place } from './screens/Place';
import { Reminders, useNotifier } from './screens/Reminders';
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
import { PrintView, Settings } from './screens/Settings';
import type { Trip } from './types';

export default function App() {
  const [ready,setReady]=useState(false); const [failed,setFailed]=useState('');
  const [selected,setSelected]=useState(()=>localStorage.getItem('travel-selected-trip'));
  useEffect(()=>{db.open().then(()=>new URLSearchParams(location.search).has("demo")?ensureSeed():undefined).then(()=>setReady(true),e=>setFailed(String(e?.message??e)));document.documentElement.dataset.theme=localStorage.getItem('travel-theme')||'system';},[]);
  const trips=useLiveQuery(()=>ready?db.trips.orderBy('start').toArray():[],[ready]);
  const clock=useClock(trips?.find(t=>t.id===selected)?.timezone); const [page,arg,arg2]=useRoute();
  useNotifier(trips?.find(t=>t.id===selected)?.id??trips?.find(t=>t.end>=clock.date)?.id, clock);
  const select=(t:Trip)=>{localStorage.setItem('travel-selected-trip',t.id);setSelected(t.id);};
  if(failed)return <main className="screen"><h1>資料庫打不開</h1><p>{failed}</p><button className="btn primary" onClick={()=>location.reload()}>重新載入</button></main>;
  if(!ready||!trips)return <main className="screen" role="status">正在開啟旅行手帳…</main>;
  const trip=trips.find(t=>t.id===selected)??trips.find(t=>t.end>=clock.date)??trips[0];
  const during=trip&&trip.start<=clock.date&&clock.date<=trip.end;
  const landing=!page||page==='welcome';
  const tabs=['today','overview','plan','bookings','essentials','prep'];
  const showNav=!landing&&tabs.includes(page)&&!(page==='bookings'&&arg);
  return <div className={'app'+(landing?' welcome-app':page==='plan'?' planning-app':'')}>
    {landing?<Welcome trips={trips} today={clock.date} select={select}/>:page==='new'?<NewTrip select={select}/>:page==='past'?<PastTrips trips={trips} today={clock.date} select={select}/>:trip?<>
      {clock.simulated&&<div className="sim" aria-hidden="true">模擬 {clock.date} {clock.time}</div>}
      {page==='today'&&during&&<Today trip={trip} clock={clock}/>}
      {(page==='overview'||(page==='today'&&!during))&&<Overview trip={trip} clock={clock}/>}
      {page==='plan'&&<Plan key={trip.id} trip={trip} day={arg}/>}
      {page==='transit'&&arg&&<Transit trip={trip} clock={clock} itemId={arg}/>}
      {page==='prep'&&<Prep trip={trip} clock={clock}/>}
      {page==='bookings'&&<Bookings key={arg??'list'} trip={trip} mode={arg} id={arg2}/>}
      {page==='essentials'&&<Essentials key={trip.id} trip={trip} clock={clock}/>}
      {page==='library'&&<Library trip={trip}/>}
      {page==='settings'&&<Settings trip={trip}/>}
      {page==='place'&&arg&&<Place trip={trip} itemId={arg}/>}
      {page==='reminders'&&<Reminders trip={trip} clock={clock}/>}
      {page==='print'&&<PrintView trip={trip}/>}
      {!['today','overview','plan','transit','prep','bookings','essentials','library','settings','place','reminders','print'].includes(page)&&<main className="screen"><h1>找不到這個頁面</h1><a className="btn primary" href={href('')}>回起始頁</a></main>}
    </>:<main className="screen"><h1>還沒有旅程</h1><a className="btn primary" href={href('new')}>開始新旅程</a></main>}
    <UndoToastHost/>
    {showNav&&trip&&<Nav current={page==='today'&&!during?'overview':page==='overview'&&during?'today':page==='prep'?'essentials':page} during={!!during}/>}
  </div>;
}
