import { useState } from 'react';
import { db } from '../db';
import type { Item, Route, Trip } from '../types';
import { md, weekday } from '../lib/time';
import { orderedDay } from '../lib/entryStore';
import { href } from '../lib/route';
import { Icon } from '../components/ui';
import { ItineraryCard } from '../components/ItineraryCard';

/** 桌機（寬螢幕）多日規劃欄 */
export function PlanBoard({trip,days,items,routes,edit,onImport}: {trip:Trip;days:string[];items:Item[];routes:Route[];edit:(item:Item|'new')=>void;onImport:()=>void}) {
  const [drag,setDrag] = useState<string|null>(null);
  const [error,setError] = useState('');
  const sorted=(d:string|null)=>orderedDay(items,d);
  async function drop(date:string|null,before?:string) {
    if(!drag)return; const item=items.find(i=>i.id===drag);if(!item)return;
    const list=sorted(date).filter(i=>i.id!==drag);const at=before?list.findIndex(i=>i.id===before):-1;list.splice(at<0?list.length:at,0,item);
    try{await db.transaction('rw',db.items,async()=>{for(const [order,i] of list.entries())await db.items.update(i.id,{date,order});});}catch{setError('卡片未能移動，請再試一次。');}setDrag(null);
  }
  return <><div className="between board-heading"><div><a href={href('overview')} className="small">回總覽</a><h2 style={{fontSize:24,marginTop:8}}>行程規劃：{trip.name}</h2><p className="small muted" style={{marginTop:8}}>拖曳卡片調整順序，點卡片查看完整資訊。拖曳只改順序，時間要另外調。</p></div><div className="board-actions"><button className="btn" onClick={onImport}>AI 匯入訂單</button><button className="btn primary" onClick={()=>edit('new')}><Icon name="plus"/>新增卡片</button></div></div>
    {error&&<p className="error" role="alert">{error}</p>}
    <div className="board-columns">{[...days,null].map(d=><section key={d??'pool'} className="board-column" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();drop(d);}}><header className="between"><h2>{d?md(d)+' '+weekday(d):'還沒排'}</h2><small className="num muted">{sorted(d).length} 張卡片</small></header>
      {sorted(d).map(i=><article key={i.id} className="board-card illustrated-board-card" draggable onDragStart={e=>{setDrag(i.id);e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',i.id);}} onDragEnd={()=>setDrag(null)} onDrop={e=>{e.preventDefault();e.stopPropagation();drop(d,i.id);}}><button className="board-entry" aria-label={'查看 '+i.title} onClick={()=>edit(i)}><ItineraryCard item={i} routes={routes} compact showTime/></button></article>)}
      {!sorted(d).length&&<div className="board-drop">把卡片拖到這裡</div>}
    </section>)}</div></>;
}
