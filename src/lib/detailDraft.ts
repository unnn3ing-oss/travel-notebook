import type { Item, Route, Trip } from '../types';
import { addDays, daysBetween, fmt, toMin } from './time';
import { flightMinutes, routeSummary } from './entries';
import { legTimesError, minutesBetween, withDerivedDepartures } from './legs';

export function draftValue(item:Item,path:string):unknown {
  return path.split('.').reduce<unknown>((value,key)=>value&&typeof value==='object'?(value as Record<string,unknown>)[key]:undefined,item);
}
/** Immutable updates let Cancel discard every field without touching IndexedDB. */
export function updateDetailDraft(item:Item,path:string,value:unknown,missingLabel?:string,unknown=false):Item {
  const copy=structuredClone(item);
  const keys=path.split('.');let parent=copy as unknown as Record<string,unknown>;
  for(const key of keys.slice(0,-1))parent=parent[key] as Record<string,unknown>;
  parent[keys[keys.length-1]]=value;
  if(missingLabel){const known=!unknown&&value!==''&&value!==undefined&&value!==null;copy.missingFields=known?(copy.missingFields??[]).filter(label=>label!==missingLabel):[...new Set([...(copy.missingFields??[]),missingLabel])];}
  if(path==='hotel.name'&&copy.hotel)copy.title=copy.hotel.name+' 入住';
  if(path==='ticket.name'&&copy.ticket)copy.title=copy.ticket.name;
  if(path==='flight.departureDate'&&copy.flight&&item.flight?.departureDate&&item.flight.arrivalDate&&typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)){
    copy.flight.arrivalDate=addDays(item.flight.arrivalDate,daysBetween(item.flight.departureDate,value));
  }
  return copy;
}
const validDate=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
function checkDate(value:string,trip?:Trip){if(value&&(!validDate(value)||(trip&&(value<trip.start||value>trip.end))))throw Error(trip?'日期要在旅程期間內。':'請確認日期。');}
function checkTime(value:string){if(value&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))throw Error('請確認時間。');}
function checkNumber(value:number){if(!Number.isFinite(value)||value<0)throw Error('分鐘數、費用與數量不可為負數。');}

/** Build the same card data the reader shows, preserving incomplete imported facts. */
export function detailEntries(original:Item,draft:Item,trip:Trip,checkout:Item|undefined,routes:Route[]):Item[] {
  if(!draft.title.trim())throw Error('請填行程名稱。');
  checkDate(draft.date??'',trip);checkTime(draft.start);checkTime(draft.end);
  const item:Item={...draft,id:original.id,tripId:original.tripId,type:original.type,title:draft.title.trim()};
  if(item.flight){
    const f=item.flight;
    if(f.airline&&!/^[A-Z0-9]{2,3}$/i.test(f.airline))throw Error('航空公司請填代碼，例如 CI。');
    if(f.from&&!/^[A-Z]{3}$/i.test(f.from)||f.to&&!/^[A-Z]{3}$/i.test(f.to))throw Error('機場代碼請填三個英文字母。');
    checkDate(f.departureDate,original.flight?.departureDate===f.departureDate?undefined:trip);checkDate(f.arrivalDate);checkTime(f.departureTime);checkTime(f.arrivalTime);
    const duration=flightMinutes(f);if(Number.isFinite(duration)&&duration<=0)throw Error('抵達時間必須晚於起飛時間，請確認兩地時區。');
    for(const n of [f.bags,f.bagKg,f.carryKg,f.checkinMinutes])checkNumber(n);
    item.date=item.date===null?null:f.departureDate||item.date;item.start=f.departureTime;item.end=f.arrivalTime;item.orderNumber=f.reference||undefined;item.price=f.price||undefined;item.from=f.from;item.to=f.to;
    if(original.flight){const old=original.flight;
      if(item.title===original.title&&(old.flightNo!==f.flightNo||old.airline!==f.airline||old.from!==f.from||old.to!==f.to))item.title=[f.airline,f.flightNo,f.from&&f.to?f.from+' → '+f.to:''].filter(Boolean).join(' ')||item.title;
    }
  }
  if(item.hotel){
    const h=item.hotel;if(!h.name.trim())throw Error('請填住宿名稱。');checkDate(h.checkinDate,original.hotel?.checkinDate===h.checkinDate?undefined:trip);checkDate(h.checkoutDate,original.hotel?.checkoutDate===h.checkoutDate?undefined:trip);checkTime(h.checkinTime);checkTime(h.checkoutTime);
    if(h.checkinDate&&h.checkoutDate&&h.checkoutDate<=h.checkinDate)throw Error('退房日要比入住日晚。');
    checkNumber(h.guests);if(h.guests<1&&!item.missingFields?.includes('入住人數'))throw Error('入住人數至少要有 1 人。');if(!Number.isInteger(h.guests))throw Error('入住人數請填整數。');
    checkDate(h.cancelBy);if(h.cancelBy&&h.checkinDate&&h.cancelBy>h.checkinDate)throw Error('免費取消期限不能晚於入住日。');
    item.title=h.name.trim()+' 入住';item.date=item.date===null?null:h.checkinDate||item.date;item.start=h.checkinTime;item.end=h.checkinTime;item.note=h.note;item.price=h.total||undefined;item.orderNumber=h.reference||undefined;item.cancelBefore=h.cancelBy||undefined;item.cancelRemind=h.remind;item.cancelLead=original.cancelLead??3;
    const pair=h.checkoutId&&h.checkoutDate?{...checkout,id:h.checkoutId,tripId:trip.id,type:'hotel' as const,title:h.name.trim()+' 退房',date:checkout?.date===null?null:h.checkoutDate,start:h.checkoutTime,end:h.checkoutTime,linkedStayId:item.id}:null;
    return pair?[item,pair]:[item];
  }
  if(item.ticket){
    const t=item.ticket;if(!t.name.trim())throw Error('請填活動或景點名稱。');checkDate(t.date,original.ticket?.date===t.date?undefined:trip);checkTime(t.time);checkNumber(t.early);
    for(const k of t.kinds){checkNumber(k.price);checkNumber(k.quantity);if(!Number.isInteger(k.quantity))throw Error('票券張數請填整數。');}
    item.title=t.name.trim();item.date=item.date===null?null:t.date||item.date;item.start=t.time;item.end=t.time;item.orderNumber=t.reference||undefined;
    const missing=item.missingFields??[];item.cost=t.kinds.length&&!t.kinds.some(k=>missing.includes(k.label+'張數')||(k.quantity>0&&missing.includes(k.label+'單價')))?t.kinds.reduce((sum,k)=>sum+k.quantity*k.price,0):undefined;
  }
  if(item.type==='transit'&&routes.length){
    if(routes.filter(r=>r.primary).length!==1)throw Error('請選擇一條主要路線。');
    for(const r of routes){checkNumber(r.minutes);checkNumber(r.walk);if(r.fare!==null)checkNumber(r.fare);for(const l of r.legs){checkNumber(l.minutes);checkNumber(l.fare??0);const e=legTimesError(l);if(e)throw Error('「'+l.label+'」'+e);}for(const d of r.departures){checkTime(d.dep);checkTime(d.arr);}}
  }
  if(!item.flight&&item.start&&item.end&&item.end<item.start)throw Error('結束時間不能早於開始時間。');
  checkDate(item.cancelBefore??'');
  if(item.cancelBefore&&item.date&&item.cancelBefore>item.date)throw Error('取消期限不能晚於行程日期。');
  return [item];
}
export function updateRouteDraft(route:Route,patch:Partial<Route>):Route {
  let r={...route,...patch};if(!patch.legs)return r;
  // 發車與抵達都填時，分鐘數跟著時間走；舊資料沒有時間就維持原分鐘。
  r={...r,legs:r.legs.map((l,k)=>{const m=minutesBetween(l.dep,l.arr);const o=route.legs[k];return m!==undefined&&(!o||o.dep!==l.dep||o.arr!==l.arr)?{...l,minutes:m}:l;})};
  const changedLength=route.legs.length!==r.legs.length;
  const timing=changedLength||r.legs.some((l,k)=>l.minutes!==route.legs[k]?.minutes||l.mode!==route.legs[k]?.mode);
  const fares=changedLength||r.legs.some((l,k)=>l.fare!==route.legs[k]?.fare);
  const places=changedLength||r.legs.some((l,k)=>l.place!==route.legs[k]?.place||l.mode!==route.legs[k]?.mode);
  const summary=routeSummary(r);const ride=r.legs.findIndex(l=>l.mode!=='walk');
  return withDerivedDepartures({...r,minutes:timing?summary.minutes:r.minutes,fare:fares?summary.fare:r.fare,mode:timing?r.legs[Math.max(0,ride)]?.mode??r.mode:r.mode,walk:timing?(ride>0?r.legs.slice(0,ride).reduce((n,l)=>n+l.minutes,0):0):r.walk,place:places?r.legs[ride]?.place??r.place:r.place});
}
export function transitStartForRoutes(item:Item,previous:Route[],routes:Route[]):Item {
  const main=routes.find(r=>r.primary);const old=previous.find(r=>r.primary);
  if(main&&old&&main.minutes!==old.minutes&&item.end&&!main.departures.length){const start=toMin(item.end)-main.minutes;if(start<0)throw Error('這條路線需前一天出發，請確認行程時間。');return {...item,start:fmt(start)};}
  return item;
}
