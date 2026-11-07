import { importMatches, sameImportedEntry, type ImportMatch } from './importDuplicates';
import type { BookingStatus, FlightDetails, HotelDetails, Item, ItemType, Mode, Route, TicketDetails, Trip } from '../types';

export interface ImportRow {
  title: string; date: string; start: string; end: string; type: ItemType; orderNumber: string;
  place: string; target: string | null; checked: boolean; flag: string;
  fields: Partial<Item>; routes: Omit<Route,'id'|'itemId'>[];
  duplicates?: ImportMatch[]; overwriteId?: string; batchDuplicate?: boolean; source?: unknown;
}
export type ImportResult = { error: string } | { rows: ImportRow[]; skipped: number };
type Obj = Record<string,unknown>;
const object = (v:unknown):Obj => v && typeof v==='object' && !Array.isArray(v) ? v as Obj : {};
const text = (v:unknown,max=4000) => typeof v==='string' ? v.trim().slice(0,max) : typeof v==='number' && Number.isFinite(v) ? String(v) : '';
const pick = (o:Obj,...keys:string[]) => keys.map(k=>o[k]).find(v=>v!==undefined&&v!==null&&v!=='');
const number = (v:unknown,fallback=0) => { const s=typeof v==='string'?v.replace(/[,，]/g,'').trim().replace(/^(?:[A-Z]{2,3}\$?|[$¥￥€₩฿])\s*/i,''):v; const n=typeof s==='number'||typeof s==='string'&&s!==''?Number(s):NaN; return Number.isFinite(n)&&n>=0 ? Math.min(n,1e9) : fallback; };
export const validImportDate = (v:string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,10)===v;
const date = (v:unknown) => validImportDate(text(v)) ? text(v) : '';
const time = (v:unknown) => { const s=text(v); const m=/^(\d{1,2}):([0-5]\d)(?::\d{2})?$/.exec(s);return m&&+m[1]<24?m[1].padStart(2,'0')+':'+m[2]:''; };
const zone = (v:unknown) => {const s=text(v,100);try{if(s)new Intl.DateTimeFormat('en',{timeZone:s});return s;}catch{return '';}};
const bool = (v:unknown) => v===true;
const optional = (v:unknown) => v===true||v===false ? v : undefined;
const status = (v:unknown):BookingStatus|undefined => {const map:Record<string,BookingStatus>={none:'none',ordered:'ordered',confirmed:'confirmed','還沒訂':'none','已訂購':'ordered','訂單確認':'confirmed'};const key=text(v);return Object.hasOwn(map,key)?map[key]:undefined;};
const MODES:Mode[]=['walk','train','subway','tram','bus','car','ferry','rental','plane'];
const mode = (v:unknown):Mode => {const s=text(v);return s==='taxi'?'car':MODES.includes(s as Mode)?s as Mode:'train';};
export { importPrompt } from './importPrompt';

export function sampleResult(trip:Trip) {
 return '```json\n'+JSON.stringify({version:2,items:[
 {type:'flight',title:'去程 CI 156 TPE → KIX',booking:'confirmed',notes:null,flight:{airline:'CI',flightNo:'156',from:'TPE',to:'KIX',departureDate:trip.start,departureTime:'06:00',departureZone:'Asia/Taipei',arrivalDate:trip.start,arrivalTime:'09:30',arrivalZone:'Asia/Tokyo',reference:'DEMO-PNR',seat:'34A、34B',bags:1,bagKg:23,carryKg:7}},
 {type:'hotel',title:'京都車站前飯店',booking:'confirmed',hotel:{name:'京都車站前飯店',checkinDate:trip.start,checkoutDate:trip.end,checkinTime:'15:00',checkoutTime:'11:00',address:'京都府京都市下京区東塩小路町（示範地址）',reference:'DEMO-HOTEL',room:'雙人房（禁菸）',guests:trip.people,total:'JPY 54,000',payment:'later',note:'晚到請先聯絡櫃台。'}}
 ],review:[]},null,2)+'\n```';
}

/** Normalize both current nested fields and known older flat AI response names. */
export function normalizeImportItem(raw:unknown):{fields:Partial<Item>;date:string;routes:ImportRow['routes'];place:string}|null {
 const o=object(raw);if(!Object.keys(o).length)return null;
 const aliases:Record<string,ItemType>={train:'transit',transport:'transit',accommodation:'hotel',flight:'flight',hotel:'hotel',transit:'transit',ticket:'ticket',restaurant:'restaurant',place:'place',car:'car',other:'other'};
 const type=Object.hasOwn(aliases,text(o.type))?aliases[text(o.type)]:'other';
 const rawNotes=pick(o,'notes','note','備註');const notes=Array.isArray(rawNotes)?rawNotes.map(v=>text(v,4000)).filter(Boolean).join('\n').slice(0,12000):text(rawNotes,12000);const place=text(pick(o,'place','address','location'),3000);
 const ref=text(pick(o,'orderNumber','orderNo','reference','bookingReference','pnr','訂單編號'),200);
 const missing:string[]=[];
 const fields:Partial<Item>={type,title:text(pick(o,'title','name'),300),note:notes||undefined,orderNumber:ref||undefined,price:text(pick(o,'price','cost','total'),200)||undefined,booking:status(pick(o,'booking','status')),from:text(o.from,200)||undefined,to:text(o.to,200)||undefined,imported:true,address:place||undefined,cancelBefore:date(pick(o,'cancelBefore','cancelBy'))||undefined,cancelRemind:optional(o.cancelRemind),hours:text(o.hours,1000)||undefined,url:/^https?:\/\//.test(text(o.url))?text(o.url,2000):undefined,tags:Array.isArray(o.tags)?o.tags.map(v=>text(v,50)).filter(Boolean).slice(0,20):undefined};
 let day=date(o.date),start=time(o.start),end=time(o.end);
 if(type==='flight') {
  const f={...o,...object(o.flight)};fields.booking??=status(f.status);
  const combined=text(pick(f,'flightNo','flightNumber','number','航班編號'),50)||text(o.title,300).match(/\b[A-Z0-9]{2}\s?\d{1,4}[A-Z]?\b/i)?.[0]||notes.match(/(?:航班|flight)\s*[:：]?\s*([A-Z0-9]{2}\s?\d{1,4}[A-Z]?)/i)?.[1]||'';
  const parts=/^([A-Z]{3}|[A-Z][A-Z0-9]|[0-9][A-Z])\s*[- ]?\s*(\d{1,4}[A-Z]?)$/i.exec(combined);
  const airports=text(o.title).match(/\b([A-Z]{3})\s*(?:→|->|－|–)\s*([A-Z]{3})\b/);
  const read=(...keys:string[])=>pick(f,...keys);
  const airline=text(read('airline','airlineCode','carrier'),50).toUpperCase()||parts?.[1].toUpperCase()||'';
  const flightNo=parts?.[2]||combined;
  const departureDate=date(read('departureDate','depDate'))||day;
  start=time(read('departureTime','depTime'))||start;end=time(read('arrivalTime','arrTime'))||end;day=departureDate;
  const data:FlightDetails={airline,flightNo,from:text(read('from','departureAirport','origin'),10).toUpperCase()||airports?.[1]||'',fromTerminal:text(read('fromTerminal','fromT','departureTerminal'),100),departureDate,departureTime:start,departureZone:zone(read('departureZone','departureTimezone','fromTimezone')),
   to:text(read('to','arrivalAirport','destination'),10).toUpperCase()||airports?.[2]||'',toTerminal:text(read('toTerminal','toT','arrivalTerminal'),100),arrivalDate:date(read('arrivalDate','arrDate')),arrivalTime:end,arrivalZone:zone(read('arrivalZone','arrivalTimezone','toTimezone')),reference:text(read('reference','pnr','bookingReference','orderNumber','orderNo'),200)||ref,seat:Array.isArray(read('seat','seats'))?(read('seat','seats') as unknown[]).map(v=>text(v,50)).filter(Boolean).join('、').slice(0,200):text(read('seat','seats'),200),cabin:text(read('cabin','class'),100),bags:number(read('bags','checkedBags')),bagKg:number(read('bagKg','checkedBaggageKg')),carryKg:number(read('carryKg','carryOnKg')),checkinMinutes:number(read('checkinMinutes','checkinCloseMinutes','close')),remind:false,price:text(read('price'),200)||fields.price||'',rules:text(read('rules','rule','cancellationPolicy'),4000)};
  for(const [k,label] of [['airline','航空公司'],['flightNo','航班號碼'],['departureZone','出發地時區'],['arrivalDate','抵達日'],['arrivalZone','抵達地時區'],['from','出發機場'],['to','抵達機場'],['departureTime','起飛時間'],['arrivalTime','抵達時間']] as const)if(!data[k])missing.push(label);
  for(const [,label,keys] of [['bags','託運件數',['bags','checkedBags']],['bagKg','託運重量',['bagKg','checkedBaggageKg']],['carryKg','手提重量',['carryKg','carryOnKg']],['checkinMinutes','報到截止時間',['checkinMinutes','checkinCloseMinutes','close']]] as const)if(read(...keys)===undefined||read(...keys)===null)missing.push(label);
  data.remind=optional(read('remind'))??true;
  fields.flight=data;fields.orderNumber=data.reference||undefined;fields.from=data.from;fields.to=data.to;
  fields.title=fields.title||[airline,flightNo,data.from&&data.to?`${data.from} → ${data.to}`:''].filter(Boolean).join(' ')||'航班';
 } else if(type==='hotel') {
  const h={...o,...object(o.hotel)};fields.booking??=status(h.status);const read=(...keys:string[])=>pick(h,...keys);
  day=date(read('checkinDate','checkInDate','inDate'))||day;start=time(read('checkinTime','checkInTime','inTime'))||start;
  const address=text(read('address','addr','hotelAddress','住房地址','住宿地址'),3000)||extractAddress(notes)||place;
  const data:HotelDetails={name:text(read('name','hotelName'),300)||fields.title||'',checkinDate:day,checkoutDate:date(read('checkoutDate','checkOutDate','outDate','endDate')),checkinTime:start,checkoutTime:time(read('checkoutTime','checkOutTime','outTime')),address,phone:text(read('phone','telephone'),200),reference:text(read('reference','ref','orderNumber','orderNo'),200)||ref,room:text(read('room','roomType'),500),guests:number(read('guests','people')),breakfast:bool(read('breakfast')),total:text(read('total','price'),200)||fields.price||'',payment:text(read('payment','pay'),100),cancelBy:date(read('cancelBy','cancelBefore','cancellationDeadline')),remind:optional(read('remind','cancelRemind'))??true,note:[notes,text(read('note'),12000)].filter((s,i,a)=>s&&a.indexOf(s)===i).join('\n')};
  for(const [k,label]of [['address','住宿地址'],['checkoutDate','退房日'],['checkinTime','入住時間'],['checkoutTime','退房時間'],['room','房型']]as const)if(!data[k])missing.push(label);
  if(read('guests','people')===undefined)missing.push('入住人數');if(optional(read('breakfast'))===undefined)missing.push('早餐');
  fields.hotel=data;fields.title=fields.title||data.name;fields.orderNumber=data.reference||undefined;fields.note=data.note||undefined;fields.price=data.total||undefined;fields.cancelBefore=data.cancelBy||undefined;fields.cancelRemind=data.remind;fields.cancelLead=3;
 } else if(type==='ticket') {
  const t={...o,...object(o.ticket)};fields.booking??=status(t.status);const read=(...keys:string[])=>pick(t,...keys);
  day=date(read('date'))||day;start=time(read('time'))||start;
  const kinds=Array.isArray(t.kinds)?t.kinds.slice(0,20).map(v=>{const k=object(v);const label=text(k.label,100);if(!Number.isFinite(number(k.price,NaN)))missing.push(label+'單價');if(!Number.isInteger(number(pick(k,'quantity','qty'),NaN)))missing.push(label+'張數');return {label,price:number(k.price),quantity:number(pick(k,'quantity','qty'))};}).filter(k=>k.label):[];
  const pickup=text(read('pickup','pick'));
  const data:TicketDetails={name:text(read('name'),300)||fields.title||'',venue:text(read('venue'),1000)||place,date:day,time:start,early:number(read('early')),kinds,pickup:['qr','counter','voucher'].includes(pickup)?pickup as TicketDetails['pickup']:'qr',place:text(read('place','pickupPlace'),2000),reference:text(read('reference','ref','orderNo','orderNumber'),200)||ref};
  if(!pickup)missing.push('取票方式');if(read('early')===undefined)missing.push('提前抵達時間');if(!kinds.length)missing.push('票種與張數');
  fields.ticket=data;fields.title=fields.title||data.name;fields.orderNumber=data.reference||undefined;if(kinds.length&&!kinds.some(k=>missing.includes(k.label+'張數')||(k.quantity>0&&missing.includes(k.label+'單價'))))fields.cost=kinds.reduce((n,k)=>n+k.price*k.quantity,0);
 }
 fields.date=day||null;fields.start=start;fields.end=end;
 fields.missingFields=missing;
 if(!fields.title||!day)return null;
 const routes:ImportRow['routes']=[];
 if(type==='transit'&&Array.isArray(o.routes))for(const rawRoute of o.routes.slice(0,20)) {
  const r=object(rawRoute);const legs=Array.isArray(r.legs)?r.legs.slice(0,50).map(v=>{const l=object(v);return {mode:mode(l.mode),label:text(pick(l,'label','text'),1000),minutes:number(pick(l,'minutes','min')),fare:number(l.fare),place:text(l.place,500)};}).filter(l=>l.label):[];
  const rides=legs.findIndex(l=>l.mode!=='walk');
  const departures=Array.isArray(r.departures)?r.departures.slice(0,200).map(v=>{const x=object(v);return {dep:time(x.dep),arr:time(x.arr),info:text(x.info,1000)};}).filter(x=>x.dep&&x.arr):[];
  routes.push({name:text(r.name,300)||'未命名路線',mode:legs[Math.max(0,rides)]?.mode??mode(r.mode),legs,minutes:legs.reduce((n,l)=>n+l.minutes,0)||number(r.minutes),walk:rides>0?legs.slice(0,rides).reduce((n,l)=>n+l.minutes,0):number(r.walk),place:legs[rides]?.place||text(r.place,500),fare:legs.length?legs.reduce((n,l)=>n+(l.fare||0),0):r.fare==null?null:number(r.fare),primary:bool(r.primary),departures,booking:status(r.booking),pay:text(r.pay,100)||undefined});
 }
 if(routes.length){const primary=routes.findIndex(r=>r.primary);routes.forEach((r,k)=>r.primary=k===(primary<0?0:primary));}
 return {fields,date:day,routes,place};
}
function extractAddress(notes:string) {
 return notes.split('\n').map(s=>s.trim()).find(s=>/^(?:住宿|住房|飯店|ホテル|旅館)?(?:地址|住所)\s*[:：]/.test(s))?.replace(/^.*?[:：]\s*/,'')||notes.split('\n').map(s=>s.trim()).find(s=>/(?:都|道|府|県|縣|市|區|区|郡).*[0-9０-９]/.test(s))||'';
}
/** Recover only text that is already present in legacy imported cards; never invent values. */
export function recoverEntry(item:Item):Item {
 if(!['flight','hotel','ticket'].includes(item.type))return item;
 const normalized=normalizeImportItem({...item,date:item.date||item.originalDate,notes:item.note});
 if(!normalized)return item;
 if(item.hotel){const address=item.hotel.address||normalized.fields.hotel?.address||'';return {...item,hotel:{...item.hotel,address,reference:item.hotel.reference||item.orderNumber||'',total:item.hotel.total||item.price||'',cancelBy:item.hotel.cancelBy||item.cancelBefore||''},missingFields:address?item.missingFields?.filter(s=>s!=='住宿地址'):item.missingFields};}
 if(item.flight){const f=normalized.fields.flight!;return {...item,flight:{...item.flight,airline:item.flight.airline||f.airline,flightNo:item.flight.flightNo||f.flightNo,from:item.flight.from||f.from,to:item.flight.to||f.to,reference:item.flight.reference||item.orderNumber||'',price:item.flight.price||item.price||''}};}
 if(item.ticket)return {...item,ticket:{...item.ticket,reference:item.ticket.reference||item.orderNumber||''}};
 return {...item,...(normalized.fields.flight?{flight:normalized.fields.flight}:{}),...(normalized.fields.hotel?{hotel:normalized.fields.hotel}:{}),...(normalized.fields.ticket?{ticket:normalized.fields.ticket}:{}),missingFields:normalized.fields.missingFields};
}
export function parseImport(raw:string,days:string[],existing:Record<string,string[]>|Item[]):ImportResult {
 let source=String(raw||'').trim();if(!source)return {error:'還沒有貼上內容。'};
 const fence=source.match(/```(?:json)?\s*([\s\S]*?)```/i);if(fence)source=fence[1];else{const a=source.indexOf('{'),b=source.lastIndexOf('}');if(a>=0&&b>a)source=source.slice(a,b+1);}
 let data:Obj;try{data=object(JSON.parse(source));}catch{return {error:'看不懂這段內容。請 AI 照提示詞的格式只回傳 JSON，再貼一次。'};}
 if(!Array.isArray(data.items))return {error:'內容裡找不到 items 清單，請確認是用這份提示詞產生的。'};
 const rows:ImportRow[]=[];let skipped=0;const seen:Record<string,string[]>={};const norm=(s:string)=>s.replace(/\s*入住$/,'').replace(/\s/g,'');
 for(const rawItem of data.items.slice(0,100)) {
  const result=normalizeImportItem(rawItem);if(!result){skipped++;continue;}
  const {fields,date:day,routes,place}=result;const title=fields.title!;const inTrip=days.includes(day);
  const candidates=Array.isArray(existing)?importMatches(fields,existing):[];
  const batchDuplicate=Array.isArray(existing)&&rows.some(row=>sameImportedEntry(fields,row.fields));
  const duplicate=Array.isArray(existing)?candidates.length>0||batchDuplicate:inTrip&&[...(existing[day]??[]),...(seen[day]??[])].some(t=>norm(t)===norm(title));
  (seen[day]??=[]).push(title);
  const flag=candidates.length?'找到已存在行程，預設忽略':batchDuplicate?'這份內容有重複項目，請只選一筆':duplicate?'這天已有同名卡片，預設不加入':inTrip?'':'日期不在旅程內，會放到未排程';
  rows.push({title,date:day,start:fields.start||'',end:fields.end||'',type:fields.type!,orderNumber:fields.orderNumber||'',place,target:inTrip?day:null,checked:!duplicate,flag,fields,routes,...(Array.isArray(existing)?{duplicates:candidates,overwriteId:candidates.length===1?candidates[0].id:undefined,batchDuplicate,source:rawItem}:{})});
 }
 return rows.length?{rows,skipped}:{error:'沒有可以加入的項目：每一筆都要有 date 和 title。'};
}
export function materializeImport(rows:ImportRow[],trip:Trip,id:()=>string):{items:Item[];routes:Route[]} {
 const items:Item[]=[];const routes:Route[]=[];
 for(const r of rows){
  const item:Item={...r.fields,id:id(),tripId:trip.id,title:r.title,date:r.target,originalDate:r.date,start:r.start,end:r.end,type:r.type};
  if(item.hotel){const h={...item.hotel};item.hotel=h;item.title=h.name+' 入住';if(validImportDate(h.checkoutDate)&&h.checkoutDate>h.checkinDate){h.checkoutId=id();items.push({...item,hotel:{...h}});items.push({id:h.checkoutId,tripId:trip.id,type:'hotel',title:h.name+' 退房',date:h.checkoutDate>=trip.start&&h.checkoutDate<=trip.end?h.checkoutDate:null,originalDate:h.checkoutDate,start:h.checkoutTime,end:h.checkoutTime,linkedStayId:item.id});}else items.push(item);}
  else items.push(item);
  for(const route of r.routes)routes.push({...route,id:id(),itemId:item.id});
 }
 return {items,routes};
}
