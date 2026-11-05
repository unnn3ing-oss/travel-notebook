import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid } from '../db';
import type { BookingStatus, FlightDetails, HotelDetails, Item, Route, TicketDetails, Trip } from '../types';
import { I, Skeleton, SK } from '../design';
import { href } from '../lib/route';
import { addDays, daysBetween, md, weekday } from '../lib/time';
import { earlier, flightItem, flightMinutes, hotelItems, isEntryKind, ticketItem, transitEntry, type EntryKind, type TransitDraft } from '../lib/entries';
import { DeleteEntry } from '../components/DeleteEntry';
import { recoverEntry } from '../lib/importer';
import { saveEntries } from '../lib/entryStore';
import { TransitFields } from './TransitFields';

const shortDate = (date:string) => date ? md(date) : '—';
const NAMES: Record<EntryKind,string> = {flight:'航班',hotel:'住宿',ticket:'門票',transit:'交通'};
const STATUS: [BookingStatus,string][] = [['none','還沒訂'],['ordered','已訂購'],['confirmed','訂單確認']];
export function EntryChooser({ day }: { day: string }) {
  return <main className="entry-page"><header className="entry-header"><a href={href('plan',day)}>取消</a><h1>新增行程</h1><span/></header><div className="entry-body"><div className="entry-grid">{Object.entries(NAMES).map(([k,n])=><a className="btn" key={k} href={href('add',k,day)}>{n}</a>)}</div><a className="btn" href={href('bookings','new')}>其他預訂與備案</a></div></main>;
}
export function EntryPage({ trip, kind, day, id }: { trip: Trip; kind?: string; day?: string; id?: string }) {
  const existing = useLiveQuery<Item|null>(async()=>id ? (await db.items.get(id))??null : null,[id]);
  const parent = useLiveQuery<Item|null>(async()=>existing?.linkedStayId ? (await db.items.get(existing.linkedStayId))??null : null,[existing?.linkedStayId]);
  const routes = useLiveQuery(()=>id ? db.routes.where({itemId:id}).toArray() : [],[id]);
  if(existing===undefined||parent===undefined||routes===undefined)return <Skeleton blocks={SK.page}/>;
  if(id && (!existing || existing.tripId!==trip.id))return <main className="entry-page entry-body"><h1>找不到這張卡片</h1><a href={href('plan')}>回行程</a></main>;
  const item=parent?.tripId===trip.id?parent:existing;
  const type=item?.type??kind;
  if(!type||!isEntryKind(type))return <EntryChooser day={day??trip.start}/>;
  return <EntryForm key={item?.id??type} trip={trip} kind={type} day={day} existing={item??undefined} routes={routes}/>;
}
function newRoute(itemId: string): Route { return {id:uid(),itemId,name:'',mode:'train',minutes:0,walk:0,place:'',legs:[],departures:[],fare:0,primary:true}; }
const AIRPORTS: Record<string,string> = {TPE:'Asia/Taipei',TSA:'Asia/Taipei',KHH:'Asia/Taipei',KIX:'Asia/Tokyo',NRT:'Asia/Tokyo',HND:'Asia/Tokyo',FUK:'Asia/Tokyo',CTS:'Asia/Tokyo',OKA:'Asia/Tokyo',ICN:'Asia/Seoul',GMP:'Asia/Seoul',PUS:'Asia/Seoul',BKK:'Asia/Bangkok',DMK:'Asia/Bangkok',HKG:'Asia/Hong_Kong',SIN:'Asia/Singapore',CDG:'Europe/Paris',LHR:'Europe/London',LAX:'America/Los_Angeles',SFO:'America/Los_Angeles',JFK:'America/New_York',SYD:'Australia/Sydney'};
const ZONES = [...new Set([...Object.values(AIRPORTS),...(typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [])])];
function routeForEditing(r:Route):Route {
  const legs=r.legs.length?r.legs:[{mode:r.mode,label:r.name,minutes:r.minutes}];
  const ride=Math.max(0,legs.findIndex(l=>l.mode!=='walk'));
  const hasFares=legs.some(l=>l.fare!==undefined);
  return {...r,legs:legs.map((l,k)=>({...l,...(!hasFares&&k===ride?{fare:r.fare??0}:{}),...(k===ride&&!l.place?{place:r.place}:{} )}))};
}
export function EntryForm({trip,kind,day,existing,routes}: {trip:Trip;kind:EntryKind;day?:string;existing?:Item;routes:Route[]}) {
  const [base] = useState<Item>(()=>existing?recoverEntry(existing):{id:uid(),tripId:trip.id,type:kind,title:'',date:day&&day!=='pool'?day:trip.start,start:'',end:'',...(kind==='transit'?{}:{booking:'none' as const})});
  const date=base.date??trip.start;
  const [status,setStatus]=useState<BookingStatus>(base.booking??'none');
  const [flight,setFlight]=useState<FlightDetails>(()=>base.flight??{airline:'',flightNo:'',from:base.from??'',fromTerminal:'',departureDate:date,departureTime:base.start,departureZone:'Asia/Taipei',to:base.to??'',toTerminal:'',arrivalDate:date,arrivalTime:base.end,arrivalZone:trip.timezone??'Asia/Tokyo',reference:base.orderNumber??'',seat:'',cabin:'economy',bags:1,bagKg:23,carryKg:7,checkinMinutes:60,remind:true,price:base.price??'',rules:base.note??''});
  const [hotel,setHotel]=useState<HotelDetails>(()=>base.hotel??{name:existing?base.title.replace(/\s*入住$/,''):'',checkinDate:date,checkoutDate:date<trip.end?addDays(date,1):trip.end,checkinTime:base.start||'15:00',checkoutTime:'11:00',address:'',phone:'',reference:base.orderNumber??'',room:'',guests:trip.people,breakfast:false,total:base.price??'',payment:'later',cancelBy:base.cancelBefore??'',remind:base.cancelRemind??true,note:base.note??''});
  const [ticket,setTicket]=useState<TicketDetails>(()=>base.ticket??{name:existing?base.title:'',venue:'',date,time:base.start,early:30,kinds:[{label:'成人',price:0,quantity:trip.people},{label:'兒童',price:0,quantity:0}],pickup:'qr',place:'',reference:base.orderNumber??''});
  const [transit,setTransit]=useState<TransitDraft>(()=>({from:base.from??'',to:base.to??'',date,arriveBy:base.end,routes:routes.length?[...routes].sort((a,b)=>Number(b.primary)-Number(a.primary)).map(routeForEditing):[newRoute(base.id)]}));
  const [missing,setMissing]=useState(base.missingFields??[]);
  const confirmFields=(patch:Record<string,unknown>,labels:Record<string,string>)=>setMissing(previous=>previous.filter(label=>!Object.entries(patch).some(([key,value])=>labels[key]===label&&value!==''&&value!==undefined)));
  const [note,setNote]=useState(base.note??'');
  const [pending,setPending]=useState<File[]>([]);
  const [error,setError]=useState(''); const [saving,setSaving]=useState(false);
  const file=useRef<HTMLInputElement>(null); const errorRef=useRef<HTMLParagraphElement>(null);
  const docs=useLiveQuery(()=>db.documents.where({tripId:trip.id}).filter(d=>d.itemId===base.id).toArray(),[base.id,trip.id])??[];
  useEffect(()=>{if(error)errorRef.current?.scrollIntoView({block:'center',behavior:'smooth'});},[error]);
  const back=existing?href('item',existing.id):href('plan',day??trip.start);
  async function save(e:React.FormEvent) {
    e.preventDefault();if(saving)return;setSaving(true);setError('');
    try {
      const b={...base,note,missingFields:missing,...(kind==='transit'?{}:{booking:status})};
      let items:Item[]=[]; let updatedRoutes:Route[]|undefined;
      if(kind==='flight')items=[flightItem(b,flight,trip)];
      if(kind==='hotel')items=hotelItems(b,hotel,trip,base.hotel?.checkoutId??uid());
      if(kind==='ticket')items=[ticketItem(b,ticket,trip)];
      if(kind==='transit'){const result=transitEntry(b,transit,trip);items=[result.item];updatedRoutes=result.routes;}
      await saveEntries(items,updatedRoutes,pending);
      location.hash=existing?href('item',items[0].id):href('plan',items[0].date??trip.start);
    }catch(e){setError(e instanceof Error?e.message:'沒存成功，請確認手機空間後再試一次。');setSaving(false);}
  }
  const attachmentLabel=kind==='flight'?'＋ 附上電子機票':kind==='hotel'?'＋ 附上訂房確認信':ticket.pickup==='qr'?'＋ 附上 QR code 截圖':'＋ 附上確認信或兌換券';
  return <form className="entry-page" onSubmit={save} noValidate>
    <header className="entry-header"><a href={back}>取消</a><h1>{existing?'編輯':'新增'}{NAMES[kind]}</h1><button type="submit" disabled={saving}>{saving?'儲存中…':'儲存'}</button></header>
    <main className="entry-body">
      {!!missing.length&&<p className="entry-hint">訂單未提供：{missing.join('、')}。請核對訂單後補齊。</p>}
      {error&&<p className="error" ref={errorRef} role="alert">{error}</p>}
      {kind==='flight'&&<FlightFields value={flight} set={p=>{setFlight({...flight,...p});confirmFields(p,{airline:'航空公司',flightNo:'航班號碼',departureZone:'出發地時區',arrivalDate:'抵達日',arrivalZone:'抵達地時區',bags:'託運件數',bagKg:'託運重量',carryKg:'手提重量',checkinMinutes:'報到截止時間'});}} status={status} setStatus={setStatus}/>}
      {kind==='hotel'&&<HotelFields value={hotel} set={p=>{setHotel({...hotel,...p});confirmFields(p,{address:'住宿地址',checkoutDate:'退房日',checkinTime:'入住時間',checkoutTime:'退房時間',room:'房型',guests:'入住人數',breakfast:'早餐'});}} status={status} setStatus={setStatus} trip={trip}/>}
      {kind==='ticket'&&<TicketFields value={ticket} set={p=>setTicket({...ticket,...p})} status={status} setStatus={setStatus} trip={trip}/>}
      {kind==='transit'&&<TransitFields value={transit} set={setTransit} itemId={base.id} trip={trip}/>}
      {kind!=='hotel'&&<label className="entry-field">筆記<textarea rows={3} value={note} onChange={e=>setNote(e.target.value)}/></label>}
      {kind!=='transit'&&<><button type="button" className="entry-attach" onClick={()=>file.current?.click()}>{attachmentLabel}</button><input ref={file} type="file" multiple accept="image/*,application/pdf" className="visually-hidden" onChange={e=>{setPending([...pending,...Array.from(e.target.files??[])]);e.target.value='';}}/>
        {!!docs.length&&<p className="small muted">已儲存 {docs.length} 份附件，可在「旅途必備」查看。</p>}
        {pending.map((p,k)=><div className="between small" key={k}><span>{p.name}</span><button type="button" className="btn small" onClick={()=>setPending(pending.filter((_,j)=>j!==k))}>移除</button></div>)}
      </>}
      {existing&&<DeleteEntry id={existing.id} title={existing.title} back={href('plan',existing.date??'pool')} paired={!!existing.hotel?.checkoutId}/>}
    </main>
  </form>;
}
export function Field({label,value,onChange,type='text',placeholder,min,max,step,className='',disabled=false}: {label:string;value:string|number;onChange:(value:string)=>void;type?:string;placeholder?:string;min?:string|number;max?:string|number;step?:string|number;className?:string;disabled?:boolean}) {
  return <label className={'entry-field '+className}>{label}<input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} min={min} max={max} step={step} disabled={disabled} className={['date','time','number','tel'].includes(type)?'num':undefined}/></label>;
}
export function Section({title,children}: {title:string;children:ReactNode}) { return <section className="entry-section"><h2>{title}</h2>{children}</section>; }
export function Choice({label,value,options,onChange}: {label:string;value:string;options:readonly (readonly [string,string])[];onChange:(value:string)=>void}) {
  return <fieldset className="entry-choice"><legend>{label}</legend><div className="entry-chips">{options.map(([k,l])=><button type="button" key={k} aria-pressed={k===value} onClick={()=>onChange(k)}>{l}</button>)}</div></fieldset>;
}
export function Stepper({label,value,set,min=0,max=20,unit=''}:{label:string;value:number;set:(n:number)=>void;min?:number;max?:number;unit?:string}) {return <div className="entry-stepper"><span>{label}</span><div><button type="button" aria-label={'減少'+label} disabled={value<=min} onClick={()=>set(value-1)}>−</button><b className="num" aria-live="polite">{value} {unit}</b><button type="button" aria-label={'增加'+label} disabled={value>=max} onClick={()=>set(value+1)}>＋</button></div></div>;}
export function Status({value,set}:{value:BookingStatus;set:(s:BookingStatus)=>void}) { return <Choice label="訂購狀態" value={value} options={STATUS} onChange={v=>set(v as BookingStatus)}/>; }
function Zone({label,value,set}: {label:string;value:string;set:(v:string)=>void}) {return <label className="entry-field">{label}<select value={value} onChange={e=>set(e.target.value)}>{ZONES.map(z=><option key={z} value={z}>{z}</option>)}</select></label>;}
function FlightFields({value:f,set,status,setStatus}:{value:FlightDetails;set:(p:Partial<FlightDetails>)=>void;status:BookingStatus;setStatus:(s:BookingStatus)=>void}) {
  const checkin=f.departureTime&&f.departureDate?earlier(f.departureDate,f.departureTime,f.checkinMinutes):null;
  const depart=f.departureTime&&f.departureDate?earlier(f.departureDate,f.departureTime,180):null;
  const duration=flightMinutes(f);
  return <>
    <section className="flight-pass" aria-label="航班摘要"><div className="between"><b className="num">{f.airline||'航空公司'} {f.flightNo}</b><span className={'pill '+status}>{STATUS.find(([k])=>k===status)?.[1]}</span></div><div className="flight-airports"><span><strong className="num">{f.from||'———'}</strong><small className="num">{f.fromTerminal}・{f.departureTime||'—'} 起飛</small></span>{I.plane}<span><strong className="num">{f.to||'———'}</strong><small className="num">{f.arrivalTime||'—'} 抵達・{f.toTerminal}</small></span></div><dl><div><dt>日期</dt><dd className="num">{f.departureDate?md(f.departureDate):'—'}</dd></div><div><dt>報到截止</dt><dd className="num">{checkin?.time??'—'}</dd></div><div><dt>座位</dt><dd>{f.seat||'—'}</dd></div><div><dt>行李</dt><dd className="num">{f.bags?`${f.bags}×${f.bagKg}`:'無'}</dd></div></dl></section>
    <Status value={status} set={setStatus}/>
    <Section title="航班"><div className="entry-grid"><Field label="航空公司代碼" value={f.airline} onChange={v=>set({airline:v.toUpperCase()})} placeholder="CI"/><Field label="航班號碼" value={f.flightNo} onChange={v=>set({flightNo:v})} placeholder="156"/></div>
      <div className="flight-direction"><h3>出發</h3><div className="entry-grid"><Field label="出發機場代碼" value={f.from} onChange={v=>set({from:v.toUpperCase(),...(AIRPORTS[v.toUpperCase()]?{departureZone:AIRPORTS[v.toUpperCase()]}:{})})} placeholder="TPE"/><Field label="出發航廈" value={f.fromTerminal} onChange={v=>set({fromTerminal:v})} placeholder="T2"/><Field label="起飛日" type="date" value={f.departureDate} onChange={v=>set({departureDate:v})}/><Field label="起飛時間（當地）" type="time" value={f.departureTime} onChange={v=>set({departureTime:v})}/></div><Zone label="出發地時區" value={f.departureZone} set={v=>set({departureZone:v})}/></div>
      <div className="flight-direction"><h3>抵達</h3><div className="entry-grid"><Field label="抵達機場代碼" value={f.to} onChange={v=>set({to:v.toUpperCase(),...(AIRPORTS[v.toUpperCase()]?{arrivalZone:AIRPORTS[v.toUpperCase()]}:{})})} placeholder="KIX"/><Field label="抵達航廈" value={f.toTerminal} onChange={v=>set({toTerminal:v})} placeholder="T1"/><Field label="抵達日" type="date" value={f.arrivalDate} onChange={v=>set({arrivalDate:v})}/><Field label="抵達時間（當地）" type="time" value={f.arrivalTime} onChange={v=>set({arrivalTime:v})}/></div><Zone label="抵達地時區" value={f.arrivalZone} set={v=>set({arrivalZone:v})}/></div>
      <p className="entry-hint">{duration>0?`飛行約 ${Math.floor(duration/60)} 小時 ${duration%60} 分（已依兩地時區換算）`:'填好起飛與抵達時間後，會依兩地時區算出飛行時間。'}</p>
    </Section>
    <Section title="訂位與座位"><div className="entry-grid"><Field label="訂位代號" value={f.reference} onChange={v=>set({reference:v})}/><Field label="座位" value={f.seat} onChange={v=>set({seat:v})} placeholder="34A、34B"/></div><Choice label="艙等" value={f.cabin} options={[["economy","經濟艙"],["premium","豪華經濟艙"],["business","商務艙"],["first","頭等艙"]]} onChange={v=>set({cabin:v})}/></Section>
    <Section title="行李"><div className="entry-white"><Stepper label="託運行李" value={f.bags} set={v=>set({bags:v})} max={9} unit="件"/><div className="entry-grid"><Field label="每件託運重量（kg）" type="number" min={0} max={100} value={f.bagKg} onChange={v=>set({bagKg:Number(v)})}/><Field label="手提重量上限（kg）" type="number" min={0} max={100} value={f.carryKg} onChange={v=>set({carryKg:Number(v)})}/></div></div></Section>
    <Section title="報到與提醒"><Choice label="櫃台在起飛前幾分鐘關閉" value={String(f.checkinMinutes)} options={['40','50','60','90'].map(v=>[v,v+' 分'])} onChange={v=>set({checkinMinutes:Number(v)})}/><p className="entry-hint">{checkin?`${md(checkin.date)} ${checkin.time} 前要完成報到，建議 ${md(depart!.date)} ${depart!.time} 出發去機場。`:'填好起飛時間後，會算出最晚報到時間。'}</p><label className="entry-check"><input type="checkbox" checked={f.remind} onChange={e=>set({remind:e.target.checked})}/>起飛前 3 小時提醒我出發去機場</label></Section>
    <Field label="費用" value={f.price} onChange={v=>set({price:v})} placeholder="例如：NT$12,000"/><label className="entry-field">改期、退票規定<textarea rows={2} value={f.rules} onChange={e=>set({rules:e.target.value})}/></label>
  </>;
}
function HotelFields({value:h,set,status,setStatus,trip}:{value:HotelDetails;set:(p:Partial<HotelDetails>)=>void;status:BookingStatus;setStatus:(s:BookingStatus)=>void;trip:Trip}) {
  const nights=daysBetween(h.checkinDate,h.checkoutDate);const amount=Number(h.total.replace(/[^\d.]/g,''));
  return <><Field label="住宿名稱" className="entry-title-field" value={h.name} onChange={v=>set({name:v})} placeholder="例如 京都車站前飯店"/><Status value={status} set={setStatus}/>
    <Section title="入住期間"><div className="entry-white stay-summary"><div className="stay-dates"><div><small>入住</small><strong className="num">{shortDate(h.checkinDate)}</strong><small className="num">{h.checkinDate?weekday(h.checkinDate):''} {h.checkinTime} 起</small></div><span className="pill now">共 {nights>0?nights:'—'} 晚</span><div><small>退房</small><strong className="num">{shortDate(h.checkoutDate)}</strong><small className="num">{h.checkoutDate?weekday(h.checkoutDate):''} {h.checkoutTime} 前</small></div></div><div className="entry-grid"><Field label="入住日" type="date" value={h.checkinDate} onChange={v=>set({checkinDate:v})}/><Field label="退房日" type="date" value={h.checkoutDate} onChange={v=>set({checkoutDate:v})}/><Field label="最早入住" type="time" value={h.checkinTime} onChange={v=>set({checkinTime:v})}/><Field label="最晚退房" type="time" value={h.checkoutTime} onChange={v=>set({checkoutTime:v})}/></div><p className="entry-hint">儲存後會在行程裡放兩張卡片：{shortDate(h.checkinDate)} 入住、{shortDate(h.checkoutDate)} 退房。</p></div></Section>
    <Section title="地址與聯絡"><label className="entry-field">當地語言地址（給司機看）<textarea rows={2} value={h.address} onChange={e=>set({address:e.target.value})} placeholder="例如 京都府京都市下京区…"/></label><div className="entry-grid"><Field label="電話" type="tel" value={h.phone} onChange={v=>set({phone:v})} placeholder="+81 75-…"/><Field label="訂單編號" value={h.reference} onChange={v=>set({reference:v})}/></div></Section>
    <Section title="房型"><Field label="房型名稱" value={h.room} onChange={v=>set({room:v})} placeholder="例如 雙人房（禁菸）"/><div className="entry-white"><Stepper label="人數" value={h.guests} min={1} max={99} unit="人" set={v=>set({guests:v})}/><label className="entry-check between">含早餐<input type="checkbox" checked={h.breakfast} onChange={e=>set({breakfast:e.target.checked})}/></label></div></Section>
    <Section title="費用與取消"><div className="entry-grid"><Field label="總金額" value={h.total} onChange={v=>set({total:v})} placeholder={'例如 '+trip.currency+' 54,000'}/><label className="entry-field">每晚約<output className="num">{nights>0&&amount?`${trip.currency} ${Math.round(amount/nights).toLocaleString()}`:'—'}</output></label></div><Choice label="付款方式" value={h.payment} options={[["now","已付清"],["later","現場付款"]]} onChange={v=>set({payment:v})}/><Field label="免費取消期限" type="date" value={h.cancelBy} onChange={v=>set({cancelBy:v})}/><p className="entry-hint">{h.cancelBy?`要在 ${md(h.cancelBy)} 前取消`:'沒有免費取消，或還不確定。'}</p><label className="entry-check"><input type="checkbox" checked={h.remind} onChange={e=>set({remind:e.target.checked})}/>取消期限前 3 天提醒我</label></Section>
    <label className="entry-field">備註<textarea rows={2} value={h.note} onChange={e=>set({note:e.target.value})} placeholder="例如：櫃台 23:00 關閉，晚到要先寄信"/></label>
  </>;
}
function TicketFields({value:t,set,status,setStatus,trip}:{value:TicketDetails;set:(p:Partial<TicketDetails>)=>void;status:BookingStatus;setStatus:(s:BookingStatus)=>void;trip:Trip}) {
  const total=t.kinds.reduce((n,k)=>n+k.price*k.quantity,0);const count=t.kinds.reduce((n,k)=>n+k.quantity,0);
  const arrival=t.time&&t.date?earlier(t.date,t.time,t.early):null;
  const hint={qr:'入場時出示 QR code 就好，建議先截圖，沒網路也能用。',counter:'到現場報訂單編號或出示確認信換票。',voucher:'先拿兌換券到指定地點換成正式門票。'};
  const update=(k:number,patch:Partial<TicketDetails['kinds'][number]>)=>set({kinds:t.kinds.map((r,i)=>i===k?{...r,...patch}:r)});
  return <><Field label="活動或景點名稱" className="entry-title-field" value={t.name} onChange={v=>set({name:v})} placeholder="例如 日本環球影城"/><Field label="場館或入口" value={t.venue} onChange={v=>set({venue:v})} placeholder="例如：主要入口"/><Status value={status} set={setStatus}/>
    <Section title="日期與場次"><div className="entry-grid"><Field label="日期" type="date" value={t.date} onChange={v=>set({date:v})}/><Field label="入場時間" type="time" value={t.time} onChange={v=>set({time:v})}/></div><Choice label="要提前幾分鐘到" value={String(t.early)} options={[["0","不用"],["15","15 分"],["30","30 分"],["60","60 分"]]} onChange={v=>set({early:Number(v)})}/><p className="entry-hint">{arrival?`${md(arrival.date)} ${arrival.time} 前要到${t.venue||'現場'}${t.pickup!=='qr'?'，取票要再多抓一點時間。':'。'}`:'填好入場時間後，會算出最晚抵達時間。'}</p></Section>
    <Section title="票種與張數"><div className="entry-white ticket-kinds">{t.kinds.map((k,i)=><div key={i} className="ticket-kind"><div><b>{k.label}</b><Field label={k.label+'單價'} type="number" min={0} step="0.01" value={k.price} onChange={v=>update(i,{price:Number(v)})}/></div><Stepper label={k.label+'張數'} value={k.quantity} max={99} unit="張" set={v=>update(i,{quantity:v})}/></div>)}<div className="between"><b>小計</b><strong className="num">{trip.currency} {total.toLocaleString()}・{count} 張</strong></div></div></Section>
    <Section title="取票方式"><Choice label="取票方式" value={t.pickup} options={[["qr","電子票 QR"],["counter","現場取票"],["voucher","兌換券"]]} onChange={v=>set({pickup:v as TicketDetails['pickup']})}/><p className="entry-hint">{hint[t.pickup]}</p>{t.pickup!=='qr'&&<Field label={t.pickup==='voucher'?'兌換地點':'取票地點'} value={t.place} onChange={v=>set({place:v})}/>}<Field label="訂單編號" value={t.reference} onChange={v=>set({reference:v})}/></Section>
  </>;
}
