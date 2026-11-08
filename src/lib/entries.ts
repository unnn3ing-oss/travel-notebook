import type { FlightDetails, HotelDetails, Item, Route, TicketDetails, Trip } from '../types';
import { addDays, daysBetween, fmt, toMin } from './time';
import { legTimesError, minutesBetween, withDerivedDepartures } from './legs';

export type EntryKind = 'flight' | 'hotel' | 'ticket' | 'transit';
export const isEntryKind = (kind: string): kind is EntryKind => ['flight','hotel','ticket','transit'].includes(kind);
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const check = (ok: unknown, message: string) => { if (!ok) throw new Error(message); };
const inTrip = (date: string, trip: Trip) => check(validDate(date) && date >= trip.start && date <= trip.end, '日期要在這趟旅程期間內。');
const number = (n: number, min = 0, max = 1_000_000_000) => Number.isFinite(n) && n >= min && n <= max;

/** Convert a wall-clock date in an IANA zone into an instant, verifying DST gaps. */
export function zonedEpoch(date: string, time: string, zone: string): number {
  if (!validDate(date) || !validTime(time)) return NaN;
  try {
    const target = Date.parse(date+'T'+time+':00Z');
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone:zone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23' });
    const wall = (n: number) => { const parts = formatter.formatToParts(n); const p = (k:string) => parts.find(x=>x.type===k)!.value; return Date.parse(`${p('year')}-${p('month')}-${p('day')}T${p('hour')}:${p('minute')}:00Z`); };
    let instant = target;
    for (let k=0;k<4;k++) { const offset = target-wall(instant); if (!offset) return instant; instant+=offset; }
    return wall(instant)===target ? instant : NaN;
  } catch { return NaN; }
}
export const flightMinutes = (f: FlightDetails) => (zonedEpoch(f.arrivalDate,f.arrivalTime,f.arrivalZone)-zonedEpoch(f.departureDate,f.departureTime,f.departureZone))/60000;
export function earlier(date: string, time: string, minutes: number) {
  const t=toMin(time)-minutes;
  return { date:addDays(date,Math.floor(t/1440)), time:fmt(t) };
}
export function flightItem(base: Item, f: FlightDetails, trip: Trip): Item {
  check(f.flightNo.trim(), '請填航班號碼。');
  check(/^[A-Z0-9]{2,3}$/i.test(f.airline.trim()), '請填航空公司代碼，例如 CI。');
  check(/^[A-Z]{3}$/i.test(f.from.trim()) && /^[A-Z]{3}$/i.test(f.to.trim()), '機場代碼是 3 個英文字母，例如 TPE、KIX。');
  inTrip(f.departureDate,trip);
  check(validTime(f.departureTime) && validDate(f.arrivalDate) && validTime(f.arrivalTime), '請填完整的起飛與抵達日期、時間。');
  check(flightMinutes(f)>0 && flightMinutes(f)<=48*60, '請確認兩地時區與抵達時間，抵達必須晚於起飛。');
  check([f.bags,f.bagKg,f.carryKg,f.checkinMinutes].every(n=>number(n,0,300)), '請確認行李與報到時間。');
  const clean={...f,airline:f.airline.trim().toUpperCase(),flightNo:f.flightNo.trim().toUpperCase(),from:f.from.trim().toUpperCase(),to:f.to.trim().toUpperCase()};
  return {...base,type:'flight',title:`${clean.airline} ${clean.flightNo} ${clean.from} → ${clean.to}`,date:f.departureDate,start:f.departureTime,end:f.arrivalTime,from:clean.from,to:clean.to,orderNumber:f.reference,price:f.price,flight:clean};
}
export function hotelItems(base: Item, h: HotelDetails, trip: Trip, checkoutId: string): Item[] {
  check(h.name.trim(), '請填住宿名稱。');
  inTrip(h.checkinDate,trip); inTrip(h.checkoutDate,trip);
  check(daysBetween(h.checkinDate,h.checkoutDate)>0,'退房日要比入住日晚。');
  check(validTime(h.checkinTime)&&validTime(h.checkoutTime),'請填入住和退房時間。');
  check(!h.cancelBy||(validDate(h.cancelBy)&&h.cancelBy<=h.checkinDate),'免費取消期限不能晚於入住日。');
  check(Number.isInteger(h.guests)&&number(h.guests,1,99),'請確認入住人數。');
  const hotel={...h,name:h.name.trim(),checkoutId};
  const main: Item={...base,type:'hotel',title:hotel.name+' 入住',date:h.checkinDate,start:h.checkinTime,end:h.checkinTime,hotel,orderNumber:h.reference,price:h.total,note:h.note,cancelBefore:h.cancelBy||undefined,cancelRemind:h.remind,cancelLead:3};
  return [main,{id:checkoutId,tripId:trip.id,type:'hotel',title:hotel.name+' 退房',date:h.checkoutDate,start:h.checkoutTime,end:h.checkoutTime,linkedStayId:base.id}];
}
export function ticketItem(base: Item, t: TicketDetails, trip: Trip): Item {
  check(t.name.trim(),'請填活動或景點名稱。'); inTrip(t.date,trip);
  check(validTime(t.time),'請填入場時間。');
  check(t.kinds.length && t.kinds.every(k=>k.label.trim()&&number(k.price)&&Number.isInteger(k.quantity)&&number(k.quantity,0,99)), '請確認票種、單價和張數。');
  const count=t.kinds.reduce((n,k)=>n+k.quantity,0);
  check(count>0,'至少要有 1 張票。');
  check(['qr','counter','voucher'].includes(t.pickup), '請選取票方式。');
  check(t.pickup==='qr'||t.place.trim(),t.pickup==='voucher'?'請填兌換地點。':'請填取票地點。');
  check(number(t.early,0,180),'請確認提前抵達分鐘數。');
  return {...base,type:'ticket',title:t.name.trim(),date:t.date,start:t.time,end:t.time,ticket:{...t,name:t.name.trim()},orderNumber:t.reference,cost:t.kinds.reduce((n,k)=>n+k.price*k.quantity,0)};
}
export interface TransitDraft { from: string; to: string; date: string; arriveBy: string; routes: Route[] }
export function routeSummary(route: Route) {
  const rides=route.legs.filter(l=>l.mode!=='walk');
  return { minutes:route.legs.reduce((n,l)=>n+l.minutes,0), fare:route.legs.reduce((n,l)=>n+(l.fare??0),0), transfers:Math.max(0,rides.length-1) };
}
export function transitEntry(base: Item, draft: TransitDraft, trip: Trip): { item: Item; routes: Route[] } {
  check(draft.from.trim()&&draft.to.trim(),'請填從哪裡到哪裡。'); inTrip(draft.date,trip);
  check(validTime(draft.arriveBy),'請填最晚抵達時間。');
  check(draft.routes.length&&new Set(draft.routes.map(r=>r.id)).size===draft.routes.length,'請建立主要路線。');
  const routes=draft.routes.map((r,k)=>{
    check(r.legs.length, (k===0?'主要':'備用')+'路線至少要有一段。');
    check(r.name.trim(),'請填每條路線的名稱。');
    const legs=r.legs.map(l=>({...l,minutes:minutesBetween(l.dep,l.arr)??l.minutes}));
    check(legs.every(l=>l.label.trim()&&number(l.minutes,0,1440)&&number(l.fare??0)), '請確認路段說明、分鐘數與費用。');
    for(const l of legs){const e=legTimesError(l);check(!e,'「'+l.label.trim()+'」'+e);}
    const summary=routeSummary({...r,legs}); check(summary.minutes>0&&summary.minutes<1440,'每條路線總時間需介於 1 分鐘與 24 小時之間。');
    const firstRide=r.legs.findIndex(l=>l.mode!=='walk');
    return withDerivedDepartures({...r,legs,itemId:base.id,primary:k===0,minutes:summary.minutes,fare:summary.fare,mode:legs[firstRide<0?0:firstRide].mode,walk:firstRide<0?0:legs.slice(0,firstRide).reduce((n,l)=>n+l.minutes,0),place:legs[firstRide]?.place??''});
  });
  const mainRide=routes[0].legs.find(l=>l.mode!=='walk');
  check((mainRide?.dep&&toMin(mainRide.dep)>=routes[0].walk)||toMin(draft.arriveBy)>=routes[0].minutes,'路線需在前一天出發，請改用前一天的交通卡片設定。');
  const main=routes[0];const mainDep=main.legs.find(l=>l.mode!=='walk')?.dep;const timed=mainDep&&toMin(mainDep)-main.walk>=0?fmt(toMin(mainDep)-main.walk):undefined;
  return {item:{...base,type:'transit',title:draft.from.trim()+' → '+draft.to.trim(),booking:main.booking,from:draft.from.trim(),to:draft.to.trim(),date:draft.date,start:timed??fmt(toMin(draft.arriveBy)-main.minutes),end:draft.arriveBy},routes};
}
