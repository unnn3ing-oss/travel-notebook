import { describe,expect,it } from 'vitest';
import type { Item, Route, Trip } from '../types';
import { normalizeImportItem } from './importer';
import { detailEntries, transitStartForRoutes, updateDetailDraft, updateRouteDraft } from './detailDraft';
const trip:Trip={id:'trip',name:'日本旅程',start:'2026-11-09',end:'2026-11-14',people:2,currency:'JPY'};
function card(raw:Record<string,unknown>):Item{return {id:'main',tripId:trip.id,type:'other',title:'',date:trip.start,start:'',end:'',...normalizeImportItem(raw)!.fields};}
const flight=card({type:'flight',title:'去程 CI 156',date:trip.start,price:'TWD 12800',notes:'原始筆記',flight:{airline:'CI',flightNo:'156',from:'TPE',to:'KIX',departureDate:trip.start,departureTime:'06:50',departureZone:'Asia/Taipei',arrivalDate:trip.start,arrivalTime:'10:55',arrivalZone:'Asia/Tokyo',reference:'REF-DEMO',seat:'34A',bags:1,bagKg:23,carryKg:7,checkinMinutes:60}});
const hotel=card({type:'hotel',title:'河口湖旅宿',hotel:{name:'河口湖旅宿',checkinDate:trip.start,checkoutDate:'2026-11-10',checkinTime:'15:00',checkoutTime:'11:00',address:'示範地址',room:'雙人房',guests:2,breakfast:true,total:'JPY 54000',payment:'later',reference:'HOTEL-DEMO'}});
hotel.hotel!.checkoutId='checkout';
describe('same-layout detail editing',()=>{
 it('keeps edits in an independent draft so cancel can leave the original unchanged',()=>{
  const draft=updateDetailDraft(hotel,'hotel.address','新的地址','住宿地址');
  expect(draft.hotel?.address).toBe('新的地址');expect(hotel.hotel?.address).toBe('示範地址');expect(draft.hotel).not.toBe(hotel.hotel);
 });
 it('saves visible flight fields and notes without losing the flight number, reference or price',()=>{
  let draft=updateDetailDraft(flight,'flight.seat','18A');draft=updateDetailDraft(draft,'note','新的筆記');
  const [saved]=detailEntries(flight,draft,trip,undefined,[]);
  expect(saved.flight).toMatchObject({flightNo:'156',reference:'REF-DEMO',seat:'18A'});expect(saved.note).toBe('新的筆記');expect(saved.price).toBe('TWD 12800');
 });
 it('preserves the arrival-day offset when changing a departure date',()=>{
  const overnight={...flight,flight:{...flight.flight!,departureTime:'23:00',arrivalDate:'2026-11-10',arrivalTime:'03:00'}};
  expect(updateDetailDraft(overnight,'flight.departureDate','2026-11-11').flight).toMatchObject({departureDate:'2026-11-11',arrivalDate:'2026-11-12'});
 });
 it('saves stay fields and both linked card dates from the same visible stay card',()=>{
  let draft=updateDetailDraft(hotel,'hotel.checkoutDate','2026-11-12','退房日');draft=updateDetailDraft(draft,'hotel.room','三人房');draft=updateDetailDraft(draft,'hotel.breakfast',false,'早餐');
  const checkout:Item={id:'checkout',tripId:trip.id,type:'hotel',title:'退房',date:'2026-11-10',start:'11:00',end:'11:00',linkedStayId:'main',note:'原有退房備註'};
  const saved=detailEntries(hotel,draft,trip,checkout,[]);
  expect(saved).toHaveLength(2);expect(saved[0].hotel).toMatchObject({room:'三人房',breakfast:false,address:'示範地址',reference:'HOTEL-DEMO'});expect(saved[1]).toMatchObject({id:'checkout',date:'2026-11-12',note:'原有退房備註'});
  expect(()=>detailEntries(hotel,updateDetailDraft(hotel,'hotel.checkoutDate',trip.start),trip,checkout,[])).toThrow('退房日');
 });
 it('keeps unknown numeric facts unknown when a field is cleared, and recognises an explicit zero',()=>{
  const cleared=updateDetailDraft(flight,'flight.bags',0,'託運件數',true);expect(cleared.missingFields).toContain('託運件數');
  expect(updateDetailDraft(cleared,'flight.bags',0,'託運件數').missingFields).not.toContain('託運件數');
 });
 it('recomputes minutes and departures when a leg time is edited, and keeps manual departures otherwise',()=>{
  const manual:Route={id:'r',itemId:'main',name:'N',mode:'train',minutes:40,walk:0,place:'',fare:null,primary:true,departures:[{dep:'09:00',arr:'09:40',info:'手動'}],legs:[{mode:'train',label:'成田特快',minutes:40},{mode:'train',label:'山手線',minutes:15}]};
  expect(updateRouteDraft(manual,{legs:manual.legs.map((l,k)=>k===1?{...l,label:'山手線 內回り'}:l)}).departures).toEqual(manual.departures);
  const timed=updateRouteDraft(manual,{legs:manual.legs.map((l,k)=>k===0?{...l,dep:'10:30',arr:'11:10',alts:[{dep:'11:00',arr:'11:40'}]}:l)});
  expect(timed.legs[0].minutes).toBe(40);expect(timed.departures.map(d=>[d.dep,d.arr])).toEqual([['10:30','11:25'],['11:00','11:55']]);
  const moved=updateRouteDraft(timed,{legs:timed.legs.map((l,k)=>k===0?{...l,arr:'11:20'}:l)});expect(moved.legs[0].minutes).toBe(50);expect(moved.minutes).toBe(65);
 });
 it('does not change existing route totals when only editing a label',()=>{
  const route:Route={id:'r',itemId:'main',name:'JR',mode:'train',minutes:25,walk:5,place:'32 號月台',fare:240,primary:true,departures:[],legs:[{mode:'walk',label:'步行',minutes:5},{mode:'train',label:'JR',minutes:16},{mode:'walk',label:'出站',minutes:3}]};
  expect(updateRouteDraft(route,{legs:route.legs.map((l,k)=>k===1?{...l,label:'JR 快速'}:l)})).toMatchObject({minutes:25,fare:240,walk:5});
  const changed=updateRouteDraft(route,{legs:route.legs.map((l,k)=>k===1?{...l,minutes:26}:l)});expect(changed.minutes).toBe(34);
  expect(transitStartForRoutes({...flight,type:'transit',end:'14:50'},[route],[changed]).start).toBe('14:16');
 });
});
it('rejects an explicit zero guest count while preserving an unknown imported guest count',()=>{
 expect(()=>detailEntries(hotel,updateDetailDraft(hotel,'hotel.guests',0,'入住人數'),trip,undefined,[])).toThrow('至少要有 1 人');
 expect(()=>detailEntries(hotel,updateDetailDraft(hotel,'hotel.guests',0,'入住人數',true),trip,undefined,[])).not.toThrow();
});
