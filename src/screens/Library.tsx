import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid } from '../db';
import { Back } from './Trips';
import { addDays, daysBetween, md, weekday } from '../lib/time';
import type { Trip } from '../types';
export function Library({trip}:{trip:Trip}) {
  const items=useLiveQuery(()=>db.items.where({tripId:trip.id}).toArray(),[trip.id])??[];
  const [q,setQ]=useState('');const [filter,setFilter]=useState('全部');const [name,setName]=useState('');const [error,setError]=useState('');
  const days=Array.from({length:daysBetween(trip.start,trip.end)+1},(_,k)=>addDays(trip.start,k));
  const list=items.filter(i=>['place','restaurant'].includes(i.type) && i.title.includes(q) && (filter==='全部'||(filter==='還沒排'? !i.date:i.type===(filter==='景點'?'place':'restaurant'))));
  return <main className="screen standalone"><Back to="plan"/><header><p className="eyebrow">{items.filter(i=>['place','restaurant'].includes(i.type)).length} 個地點</p><h1>景點庫</h1></header>
    <label className="field"><span className="visually-hidden">搜尋景點</span><input type="search" placeholder="搜尋景點" value={q} onChange={e=>setQ(e.target.value)}/></label>
    <div className="chips">{['全部','還沒排','景點','餐廳'].map(t=><button className="chip" key={t} aria-pressed={filter===t} onClick={()=>setFilter(t)}>{t}</button>)}</div>
    {list.map(i=><article className="card" key={i.id}><div className="between"><h2>{i.title}</h2><span className="pill plain">{i.type==='place'?'景點':'餐廳'}</span></div>{i.note&&<p className="small muted">{i.note}</p>}<label className="setting-row">排進哪一天<select value={i.date??''} onChange={e=>db.items.update(i.id,{date:e.target.value||null})}><option value="">還沒排</option>{days.map(d=><option key={d} value={d}>{md(d)} {weekday(d)}</option>)}</select></label></article>)}
    {!list.length&&<p className="muted">{q?`找不到「${q}」。可以直接在下面新增。`:'還沒有景點，先存想去的地方。'}</p>}
    <form className="card" onSubmit={async e=>{e.preventDefault();if(!name.trim())return;try{await db.items.add({id:uid(),tripId:trip.id,date:null,start:'',end:'',title:name.trim(),type:'place'});setName('');}catch{setError('景點未能儲存。');}}}><label className="field">新景點名稱<input required value={name} onChange={e=>setName(e.target.value)} placeholder="想去哪裡？"/></label><button className="btn primary">新增</button>{error&&<p className="error" role="alert">{error}</p>}</form>
  </main>;
}
