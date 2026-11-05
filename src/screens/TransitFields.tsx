import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid } from '../db';
import type { Mode, Route, Trip } from '../types';
import { routeSummary, type TransitDraft } from '../lib/entries';
import { Choice, Field, Section } from './EntryForm';

const MODES: readonly (readonly [Mode,string])[] = [['walk','步行'],['train','電車'],['subway','地鐵'],['bus','巴士'],['tram','路面電車'],['car','計程車'],['ferry','渡輪'],['rental','租車'],['plane','飛機']];
const LABEL = Object.fromEntries(MODES);
type Leg = Route['legs'][number];
const emptyLeg = ():Leg => ({mode:'train',label:'',minutes:0,fare:0,place:''});
export function TransitFields({value:d,set,itemId,trip}: {value:TransitDraft;set:(v:TransitDraft)=>void;itemId:string;trip:Trip}) {
  const [selected,setSelected] = useState(0);
  const [leg,setLeg] = useState<Leg>(emptyLeg);
  const [legOpen,setLegOpen] = useState(false);
  const [error,setError] = useState('');
  const [message,setMessage] = useState('');
  const items=useLiveQuery(()=>db.items.where({tripId:trip.id,date:d.date}).toArray(),[trip.id,d.date])??[];
  const next=items.filter(i=>i.id!==itemId&&i.start>=d.arriveBy&&i.type!=='transit').sort((a,b)=>a.start.localeCompare(b.start))[0];
  const route=d.routes[selected];
  const summary=routeSummary(route);
  const update=(patch:Partial<Route>)=>set({...d,routes:d.routes.map((r,k)=>k===selected?{...r,...patch}:r)});
  const money=(n:number)=>n?`${trip.currency} ${n.toLocaleString()}`:'免費';
  function openLeg(){setLeg(emptyLeg());setError('');setLegOpen(true);}
  function addLeg(){
    if(!leg.label.trim())return setError('請填這一段的說明。');
    if(!Number.isFinite(leg.minutes)||leg.minutes<=0)return setError('請填大於 0 的分鐘數。');
    if(!Number.isFinite(leg.fare)||leg.fare!<0)return setError('費用不可為負數。');
    update({legs:[...route.legs,{...leg,label:leg.label.trim()}]});setLegOpen(false);
  }
  return <>
    <div className="transit-endpoints"><div className="entry-grid"><Field label="從" value={d.from} onChange={v=>set({...d,from:v})} placeholder="例如：京都車站"/><Field label="到" value={d.to} onChange={v=>set({...d,to:v})} placeholder="例如：嵯峨嵐山站"/></div><button type="button" className="swap-endpoints" aria-label="交換出發地與目的地" onClick={()=>set({...d,from:d.to,to:d.from})}>⇄</button></div>
    <div className="entry-grid"><Field label="日期" type="date" value={d.date} onChange={v=>set({...d,date:v})}/><Field label="最晚幾點要到" type="time" value={d.arriveBy} onChange={v=>set({...d,arriveBy:v})}/></div>
    {next&&d.arriveBy&&<p className="entry-hint">接下來是「{next.title}」 {next.start}，判斷班次會用這個時間。</p>}
    <Section title="路線"><p className="small muted">先建立主要路線，再加備用。主要路線不行時，可以直接改用備用。</p>
      <div className="entry-routes" role="tablist" aria-label="主要與備用路線">{d.routes.map((r,k)=>{const s=routeSummary(r);return <button type="button" role="tab" key={r.id} aria-selected={selected===k} onClick={()=>{setSelected(k);setLegOpen(false);}}><small className={'route-role '+(k===0?'primary':'')}>{k===0?'主要':'備用 '+k}</small><strong>{r.name||'未命名路線'}</strong><small className="num">{s.minutes} 分・{s.transfers?'轉乘 '+s.transfers+' 次':'直達'}</small></button>;})}<button type="button" onClick={()=>{set({...d,routes:[...d.routes,{id:uid(),itemId,name:'',mode:'train',minutes:0,walk:0,place:'',legs:[],departures:[],fare:0,primary:false}]});setSelected(d.routes.length);openLeg();}}>＋ 備用路線</button></div>
      {message&&<p className="entry-hint" role="status">{message}</p>}
      <div className="entry-white route-editor"><Field label="路線名稱" value={route.name} onChange={name=>update({name})} placeholder="例如：JR 嵯峨野線"/>
        <dl className="route-totals"><div><dt>全程</dt><dd className="num">{summary.minutes} 分</dd></div><div><dt>轉乘</dt><dd>{summary.transfers?summary.transfers+' 次':'直達'}</dd></div><div><dt>單人</dt><dd className="num">{money(summary.fare)}</dd></div></dl>
        <ol className="entry-legs">{route.legs.map((l,k)=><li key={k}><span className={'leg-dot '+l.mode}/><div className="entry-leg-content">{k>0&&l.mode!=='walk'&&route.legs.slice(0,k).some(v=>v.mode!=='walk')&&<small className="transfer-label">轉乘</small>}<div><small className="leg-mode">{LABEL[l.mode]}</small><b>{l.label}</b></div><p className="num small muted">{l.minutes} 分鐘{l.fare?'・'+money(l.fare):''}{l.place?'・'+l.place:''}</p></div><div className="entry-leg-actions"><button type="button" aria-label={'上移 '+l.label} disabled={k===0} onClick={()=>{const legs=[...route.legs];[legs[k-1],legs[k]]=[legs[k],legs[k-1]];update({legs});}}>↑</button><button type="button" aria-label={'刪除 '+l.label} onClick={()=>update({legs:route.legs.filter((_,i)=>i!==k)})}>×</button></div></li>)}</ol>
        {!route.legs.length&&<p className="entry-hint">還沒有路段。從出發地開始，一段一段加，例如「步行到車站」→「電車」→「步行出站」。</p>}
        {!legOpen?<button type="button" className="entry-attach" onClick={openLeg}>＋ 加一段（轉乘、步行）</button>:<section className="entry-leg-form"><Choice label="這一段搭什麼" value={leg.mode} options={MODES} onChange={v=>setLeg({...leg,mode:v as Mode})}/><Field label="說明" value={leg.label} onChange={v=>setLeg({...leg,label:v})} placeholder="例如：JR 嵯峨野線，往園部"/><div className="entry-grid"><Field label="幾分鐘" type="number" min={1} max={1439} value={leg.minutes||''} onChange={v=>setLeg({...leg,minutes:Number(v)})}/><Field label={'單人費用（'+trip.currency+'）'} type="number" min={0} step="0.01" value={leg.fare??0} onChange={v=>setLeg({...leg,fare:Number(v)})}/></div>{leg.mode!=='walk'&&<Field label="上車地點、月台" value={leg.place??''} onChange={v=>setLeg({...leg,place:v})}/>} {error&&<p className="error" role="alert">{error}</p>}<div className="entry-grid"><button type="button" className="btn" onClick={()=>setLegOpen(false)}>取消這一段</button><button type="button" className="btn primary" onClick={addLeg}>加入這一段</button></div></section>}
        <label className="entry-check"><input type="checkbox" checked={!!route.booking} onChange={e=>update({booking:e.target.checked?'none':undefined})}/>這條路線要先訂票或預約</label>
        {selected===0?<p className="entry-hint">這是主要路線。行程清單和今日頁會用它來判斷出發時間。</p>:<div className="entry-grid"><button type="button" className="btn primary" onClick={()=>{const routes=d.routes.filter((_,k)=>k!==selected);routes.unshift(route);set({...d,routes});setSelected(0);setMessage('已改用「'+route.name+'」為主要路線，原本的主要路線改為備用。');}}>改用這條為主要</button><button type="button" className="btn danger" onClick={()=>{set({...d,routes:d.routes.filter((_,k)=>k!==selected)});setSelected(0);setLegOpen(false);}}>刪除這條備用</button></div>}
      </div>
    </Section>
    <p className="entry-hint">班次時刻可以存好後在「路線與班次」頁加；沒有班次的路線（步行、計程車）會用卡片的開始時間判斷。</p>
  </>;
}
