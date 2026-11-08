import { describe,it,expect } from 'vitest';
import type { FlightDetails, HotelDetails, Item, Route, TicketDetails, Trip } from '../types';
import { flightItem,flightMinutes,hotelItems,ticketItem,transitEntry,zonedEpoch } from './entries';
import { insertByTime } from './entryStore';
import { buildReminders,DEFAULT_RULES } from './reminders';
const trip:Trip={id:'trip',name:'京都',start:'2026-11-20',end:'2026-11-24',people:2,currency:'JPY',timezone:'Asia/Tokyo'};
const base:Item={id:'new',tripId:'trip',type:'other',title:'',date:trip.start,start:'',end:'',booking:'confirmed'};
const flight:FlightDetails={airline:'ci',flightNo:'156',from:'tpe',fromTerminal:'T2',departureDate:trip.start,departureTime:'06:00',departureZone:'Asia/Taipei',to:'kix',toTerminal:'T1',arrivalDate:trip.start,arrivalTime:'09:30',arrivalZone:'Asia/Tokyo',reference:'ABC123',seat:'34A',cabin:'economy',bags:1,bagKg:23,carryKg:7,checkinMinutes:60,remind:true,price:'NT$10000',rules:''};
const hotel:HotelDetails={name:'京都飯店',checkinDate:trip.start,checkoutDate:'2026-11-23',checkinTime:'15:00',checkoutTime:'11:00',address:'京都市',phone:'123',reference:'HOTEL',room:'雙人房',guests:2,breakfast:true,total:'¥54000',payment:'later',cancelBy:'2026-11-17',remind:true,note:''};
const ticket:TicketDetails={name:'環球影城',venue:'入口',date:'2026-11-22',time:'09:00',early:30,kinds:[{label:'成人',price:9800,quantity:2},{label:'兒童',price:6300,quantity:0}],pickup:'qr',place:'',reference:'TICKET'};
function route(id:string,legs:Route['legs']):Route{return {id,itemId:'new',name:id,legs,mode:'train',minutes:0,walk:0,place:'',departures:[],fare:0,primary:false};}
describe('dedicated entry data',()=>{
 it('converts flight local times across zones and preserves ticket details',()=>{
  expect(flightMinutes(flight)).toBe(150);
  const i=flightItem(base,flight,trip);expect(i.title).toBe('CI 156 TPE → KIX');expect(i.flight?.seat).toBe('34A');expect(i.orderNumber).toBe('ABC123');
  expect(Number.isNaN(zonedEpoch('2026-03-08','02:30','America/New_York'))).toBe(true);
 });
 it('supports overnight arrivals and rejects a nonpositive flight',()=>{
  expect(flightMinutes({...flight,departureTime:'23:00',arrivalDate:'2026-11-21',arrivalTime:'03:00'})).toBe(180);
  expect(()=>flightItem(base,{...flight,arrivalTime:'06:30'},trip)).toThrow('抵達必須晚於起飛');
 });
 it('creates linked checkin and checkout cards using actual stay dates',()=>{
  const [checkin,checkout]=hotelItems(base,hotel,trip,'checkout');
  expect(checkin.date).toBe(trip.start);expect(checkout.date).toBe('2026-11-23');expect(checkout.linkedStayId).toBe(base.id);expect(checkin.hotel?.checkoutId).toBe(checkout.id);expect(checkout.booking).toBeUndefined();
  expect(()=>hotelItems(base,{...hotel,checkoutDate:hotel.checkinDate},trip,'checkout')).toThrow('退房日');
  expect(()=>hotelItems(base,{...hotel,cancelBy:'2026-11-21'},trip,'checkout')).toThrow('免費取消期限');
 });
 it('totals ticket kinds and requires a pickup location when appropriate',()=>{
  expect(ticketItem(base,ticket,trip).cost).toBe(19600);
  expect(()=>ticketItem(base,{...ticket,pickup:'voucher'},trip)).toThrow('兌換地點');
  expect(()=>ticketItem(base,{...ticket,kinds:[{label:'成人',price:9800,quantity:0}]},trip)).toThrow('至少');
 });
 it('derives main and backup route time, fare, platform and walking lead from all legs',()=>{
  const a=route('main',[{mode:'walk',label:'到車站',minutes:5,fare:0},{mode:'train',label:'JR',minutes:16,fare:240,place:'32 號月台'},{mode:'walk',label:'出站',minutes:3,fare:0}]);
  const b=route('backup',[{mode:'subway',label:'地鐵',minutes:10,fare:200},{mode:'tram',label:'路面電車',minutes:20,fare:250}]);
  const result=transitEntry(base,{from:'京都',to:'嵐山',date:trip.start,arriveBy:'14:50',routes:[a,b]},trip);
  expect(result.item.start).toBe('14:26');expect(result.routes.map(r=>r.primary)).toEqual([true,false]);expect(result.routes[0]).toMatchObject({minutes:24,fare:240,walk:5,place:'32 號月台'});expect(result.routes[1]).toMatchObject({minutes:30,fare:450});
  const changed=transitEntry(base,{from:'京都',to:'嵐山',date:trip.start,arriveBy:'14:50',routes:[b,a]},trip);expect(changed.item.start).toBe('14:20');expect(changed.routes[0].id).toBe('backup');
 });
 it('builds a timed multi-leg route with backup departures for the first leg',()=>{
  const narita={mode:'train' as const,label:'京成 Skyliner 往日暮里',minutes:0,fare:2580,place:'成田機場第 1 航廈站',dep:'10:30',arr:'11:10',alts:[{dep:'11:00',arr:'11:40',info:'錯過就搭下一班'}]};
  const yamanote={mode:'train' as const,label:'JR 山手線 往新宿',minutes:0,fare:200,place:'日暮里站 3 號月台',dep:'11:20',arr:'11:35',alts:[{dep:'11:50',arr:'12:05'}]};
  const r=transitEntry(base,{from:'成田機場',to:'新宿',date:trip.start,arriveBy:'13:00',routes:[route('main',[{mode:'walk',label:'到月台',minutes:5},narita,yamanote])]},trip);
  expect(r.routes[0].legs.map(l=>l.minutes)).toEqual([5,40,15]);
  expect(r.routes[0]).toMatchObject({minutes:60,fare:2780,walk:5,place:'成田機場第 1 航廈站'});
  expect(r.routes[0].departures.map(d=>[d.dep,d.arr])).toEqual([['10:30','11:35'],['11:00','12:05']]);
  expect(r.item.start).toBe('10:25');expect(r.item.end).toBe('13:00');
  expect(()=>transitEntry(base,{from:'a',to:'b',date:trip.start,arriveBy:'13:00',routes:[route('main',[{...narita,arr:'10:00'}])]},trip)).toThrow('晚於');
  expect(()=>transitEntry(base,{from:'a',to:'b',date:trip.start,arriveBy:'13:00',routes:[route('main',[{...narita,alts:[{dep:'11:00',arr:''}]}])]},trip)).toThrow('備案 1');
 });
 it('keeps legacy untimed routes unchanged',()=>{
  const r=transitEntry(base,{from:'京都',to:'嵐山',date:trip.start,arriveBy:'14:50',routes:[route('main',[{mode:'train',label:'JR',minutes:16}])]},trip);
  expect(r.routes[0].departures).toEqual([]);expect(r.item.start).toBe('14:34');
 });
 it('inserts incoming cards by time without disturbing the relative manual order of existing cards',()=>{
  const i=(id:string,start:string,order?:number):Item=>({...base,id,start,order});
  const previous=[i('morning','09:00',0),i('evening','18:00',1)];
  expect(insertByTime(previous,[i('lunch','12:00')]).map(i=>[i.id,i.order])).toEqual([['morning',0],['lunch',1],['evening',2]]);
  expect(insertByTime(previous,[i('evening','08:00')]).map(i=>i.id)).toEqual(['evening','morning']);
 });
});
describe('entry reminders',()=>{
 it('schedules the airport reminder three hours before takeoff and handles the previous day',()=>{
  const i=flightItem(base,{...flight,departureTime:'01:00'},trip);
  const list=buildReminders([i],[],DEFAULT_RULES,'2026-11-19','Asia/Tokyo');
  expect(list.find(r=>r.id==='f-new')).toMatchObject({date:'2026-11-19',time:'23:00'});
  expect(buildReminders([{...i,flight:{...i.flight!,remind:false}}],[],DEFAULT_RULES,'2026-11-19').some(r=>r.id==='f-new')).toBe(false);
 });
 it('uses the hotel cancellation lead and omits disabled cancellation reminders',()=>{
  const i=hotelItems(base,hotel,trip,'checkout')[0];
  expect(buildReminders([i],[],DEFAULT_RULES,'2026-11-01').find(r=>r.id==='c-new')).toMatchObject({date:'2026-11-14'});
  expect(buildReminders([{...i,cancelRemind:false}],[],DEFAULT_RULES,'2026-11-01').some(r=>r.kind==='cancel')).toBe(false);
 });
 it('uses the ticket arrival lead with midnight rollover',()=>{
  const i=ticketItem(base,{...ticket,time:'00:10'},trip);
  expect(buildReminders([i],[],DEFAULT_RULES,'2026-11-20').find(r=>r.id==='i-new')).toMatchObject({date:'2026-11-21',time:'23:40'});
 });
});
