import { useState } from 'react';
import { db } from '../db';
import type { Item, ItemType, Trip } from '../types';
import { md, toMin, weekday } from '../lib/time';
import { byTime } from '../lib/day';
import { href } from '../lib/route';
import { BookingPill, Icon } from '../components/ui';

const TYPES: [ItemType, string][] = [['place', '景點'], ['restaurant', '餐廳'], ['transit', '交通'], ['hotel', '住宿'], ['flight', '航班'], ['ticket', '門票'], ['car', '租車'], ['other', '其他']];
const typeLabel = (t: ItemType) => TYPES.find((x) => x[0] === t)![1];

/** 桌機（寬螢幕）多日規劃欄 */
export function PlanBoard({trip,days,items,edit}: {trip:Trip;days:string[];items:Item[];edit:(item:Item|'new')=>void}) {
  const [drag,setDrag] = useState<string|null>(null);
  const [error,setError] = useState('');
  const sorted=(d:string|null)=>items.filter(i=>i.date===d).sort((a,b)=>(a.order??toMin(a.start||'23:59'))-(b.order??toMin(b.start||'23:59'))||byTime(a,b));
  async function drop(date:string|null,before?:string) {
    if(!drag)return; const item=items.find(i=>i.id===drag);if(!item)return;
    const list=sorted(date).filter(i=>i.id!==drag);const at=before?list.findIndex(i=>i.id===before):-1;list.splice(at<0?list.length:at,0,item);
    try{await db.transaction('rw',db.items,async()=>{for(const [order,i] of list.entries())await db.items.update(i.id,{date,order});});}catch{setError('卡片未能移動，請再試一次。');}setDrag(null);
  }
  return <><div className="between"><div><a href={href('overview')} className="small">回總覽</a><h2 style={{fontSize:24,marginTop:8}}>行程規劃：{trip.name}</h2><p className="small muted" style={{marginTop:8}}>拖曳卡片調整順序，點卡片就能編輯。拖曳只改順序，時間要另外調。</p></div><button className="btn primary" onClick={()=>edit('new')}><Icon name="plus"/>新增卡片</button></div>
    {error&&<p className="error" role="alert">{error}</p>}
    <div className="board-columns">{[...days,null].map(d=><section key={d??'pool'} className="board-column" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();drop(d);}}><header className="between"><h2>{d?md(d)+' '+weekday(d):'還沒排'}</h2><small className="num muted">{sorted(d).length} 張卡片</small></header>
      {sorted(d).map(i=><article key={i.id} className="board-card" draggable onDragStart={e=>{setDrag(i.id);e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',i.id);}} onDragEnd={()=>setDrag(null)} onDrop={e=>{e.preventDefault();e.stopPropagation();drop(d,i.id);}}><span className="small muted">⠿　{typeLabel(i.type)}</span><button onClick={()=>edit(i)}>{i.title}</button><span className="num small muted">{i.start||'還沒設定時間'}{i.end?' – '+i.end:''}</span><div className="between"><BookingPill status={i.booking}/><label className="small muted">移到<select aria-label={'移動 '+i.title} value={d??''} onChange={e=>db.items.update(i.id,{date:e.target.value||null,order:undefined})}><option value="">還沒排</option>{days.map(day=><option key={day} value={day}>{md(day)}</option>)}</select></label></div></article>)}
      {!sorted(d).length&&<div className="board-drop">把卡片拖到這裡</div>}
    </section>)}</div></>;
}
