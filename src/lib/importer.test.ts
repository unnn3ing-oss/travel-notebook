import { describe, expect, it } from 'vitest';
import { parseImport } from './importer';

const days = ['2026-11-20', '2026-11-21'];
describe('parseImport', () => {
  it('reads a fenced JSON block, maps train to transit, flags duplicates and out-of-range dates', () => {
    const raw = 'AI 說：\n```json\n' + JSON.stringify({ items: [
      { date: '2026-11-21', start: '15:00', type: 'ticket', title: '嵐山 小火車', orderNo: 'A1' },
      { date: '2026-11-20', start: '10:16', type: 'train', title: 'Haruka' },
      { date: '2026-12-01', type: 'hotel', title: '延住' },
      { date: 'tomorrow', title: '沒日期' },
    ] }) + '\n```';
    const r = parseImport(raw, days, { '2026-11-21': ['嵐山小火車'] });
    if ('error' in r) throw new Error(r.error);
    expect(r.skipped).toBe(1);
    expect(r.rows[0]).toMatchObject({ checked: false, flag: '這天已有同名卡片，預設不加入', orderNumber: 'A1' });
    expect(r.rows[1]).toMatchObject({ type: 'transit', target: '2026-11-20', checked: true });
    expect(r.rows[2]).toMatchObject({ target: null, flag: '日期不在旅程內，會放到未排程' });
  });
  it('explains bad input', () => {
    expect(parseImport('', days, {})).toEqual({ error: '還沒有貼上內容。' });
    expect(parseImport('hello', days, {})).toEqual({ error: '看不懂這段內容。請 AI 照提示詞的格式只回傳 JSON，再貼一次。' });
    expect(parseImport('{"a":1}', days, {})).toEqual({ error: '內容裡找不到 items 清單，請確認是用這份提示詞產生的。' });
  });
});

import { importPrompt, materializeImport, recoverEntry } from './importer';
import type { Item, Trip } from '../types';
const trip:Trip={id:'trip',name:'日本旅程',start:'2026-11-20',end:'2026-11-24',people:2,currency:'JPY'};
function parsed(items:unknown[]){const result=parseImport(JSON.stringify({version:2,items}),['2026-11-20','2026-11-21','2026-11-22','2026-11-23','2026-11-24'],{});if('error'in result)throw Error(result.error);return result;}
describe('current form fields and legacy compatibility',()=>{
 it('maps a combined flight number independently from its booking reference and preserves all notes and costs',()=>{
  const r=parsed([{type:'flight',title:'去程',date:trip.start,notes:'這是完整筆記，需攜帶證件。',price:'TWD 12,000',flight:{flightNumber:'CI 0100',from:'TPE',to:'NRT',departureDate:trip.start,departureTime:'06:50',departureZone:'Asia/Taipei',arrivalDate:trip.start,arrivalTime:'10:55',arrivalZone:'Asia/Tokyo',reference:'DEMO-R8',seat:['12A','12B'],cabin:'economy',bags:1,bagKg:23,carryKg:7,rules:'不可退票'},booking:'confirmed'}]).rows[0];
  expect(r.fields.flight).toMatchObject({airline:'CI',flightNo:'0100',reference:'DEMO-R8',seat:'12A、12B',bagKg:23,rules:'不可退票'});
  expect(r.fields).toMatchObject({note:'這是完整筆記，需攜帶證件。',price:'TWD 12,000',orderNumber:'DEMO-R8'});
 });
 it('preserves a full hotel address, stay dates, room, payment, price, cancellation and notes',()=>{
  const address='山梨県南都留郡富士河口湖町小立802番地、受付棟の右側、到着したらホテルのフロントへ連絡してください。';
  const result=parsed([{type:'hotel',booking:'confirmed',notes:'預約資料請留存。',hotel:{name:'河口湖住宿',checkinDate:trip.start,checkoutDate:'2026-11-22',checkinTime:'15:00',checkoutTime:'11:00',address,phone:'+81-123',room:'雙人房（禁菸）',reference:'DEMO-STAY',guests:2,breakfast:false,total:'JPY 54,000',payment:'later',cancelBy:'2026-11-17',note:'晚到請致電。'}}]);
  expect(result.rows[0].fields.hotel).toMatchObject({address,room:'雙人房（禁菸）',payment:'later',breakfast:false,total:'JPY 54,000',reference:'DEMO-STAY'});
  let id=0;const bundle=materializeImport(result.rows,trip,()=>String(++id));
  expect(bundle.items).toHaveLength(2);expect(bundle.items[0].hotel?.address).toBe(address);expect(bundle.items[1]).toMatchObject({date:'2026-11-22',linkedStayId:bundle.items[0].id,start:'11:00'});
  expect(bundle.items[0].note).toBe('預約資料請留存。\n晚到請致電。');
 });
 it('keeps old flat flight fields and recovers a legacy hotel address from existing notes',()=>{
  const row=parsed([{type:'flight',title:'回程',date:trip.start,start:'10:00',flightNumber:'IT217',from:'NRT',to:'TPE',pnr:'PNR-ABC',notes:'原始備註',price:'TWD 5,000'}]).rows[0];
  expect(row.fields.flight).toMatchObject({airline:'IT',flightNo:'217',reference:'PNR-ABC'});
  const old:Item={id:'old',tripId:'trip',type:'hotel',title:'河口湖住宿',date:trip.start,start:'15:00',end:'',note:'山梨縣南都留郡富士河口湖町小立802'};
  expect(recoverEntry(old).hotel?.address).toBe(old.note);expect(old.hotel).toBeUndefined();
  const existing={...old,hotel:{...recoverEntry(old).hotel!,address:''}};
  expect(recoverEntry(existing).hotel?.address).toBe(old.note);
 });
 it('does not turn unknown seats, luggage or breakfast into invented order data',()=>{
  const rows=parsed([{type:'flight',title:'去程',date:trip.start,start:'08:00'},{type:'hotel',title:'住宿',date:trip.start}]).rows;
  expect(rows[0].fields.missingFields).toContain('航班號碼');expect(rows[0].fields.missingFields).toContain('託運件數');expect(rows[0].fields.flight?.seat).toBe('');expect(rows[0].fields.booking).toBeUndefined();
  expect(rows[1].fields.missingFields).toContain('早餐');let n=0;expect(materializeImport([rows[1]],trip,()=>String(++n)).items).toHaveLength(1);
 });
 it('stores multi-leg routes and ticket quantities from the new schema',()=>{
  const rows=parsed([{type:'transit',title:'車站到飯店',date:trip.start,start:'12:00',routes:[{name:'地鐵',primary:true,legs:[{mode:'walk',label:'到站',minutes:5},{mode:'subway',label:'藍線',minutes:20,fare:240,place:'2 號月台'}]}]}, {type:'ticket',ticket:{name:'展覽',date:trip.start,time:'14:00',venue:'入口',early:15,kinds:[{label:'成人',price:500,quantity:2}],pickup:'counter',place:'大廳',reference:'TIX-A'}}]).rows;
  let n=0;const bundle=materializeImport(rows,trip,()=>String(++n));
  expect(bundle.routes[0]).toMatchObject({itemId:bundle.items[0].id,minutes:25,fare:240,walk:5,place:'2 號月台'});expect(bundle.items[1].ticket).toMatchObject({pickup:'counter',place:'大廳'});expect(bundle.items[1].cost).toBe(1000);
 });
 it('ignores malformed items, invalid calendar dates and invalid times safely',()=>{
  const result=parseImport(JSON.stringify({items:[null,5,{title:'bad',date:'2026-02-30'},{title:'valid',date:trip.start,start:'99:90',end:'9:05',type:'__proto__',booking:'__proto__'}]}),[trip.start],{});
  if('error'in result)throw Error(result.error);expect(result.skipped).toBe(3);expect(result.rows[0]).toMatchObject({start:'',end:'09:05',type:'other'});expect(result.rows[0].fields.booking).toBeUndefined();
 });
 it('asks the AI for the exact current field names rather than the old title-only schema',()=>{
  const prompt=importPrompt(trip);for(const field of ['flightNo','airline','address','checkoutDate','room','kinds','routes','notes','不要猜'])expect(prompt).toContain(field);
  for(const instruction of ['已獲授權','PDF 附件','不要只讀信件本文','起飛日期及旅客逐一核對','flight.seat','無法讀取 PDF 附件','缺少的欄位填 null','附件檔名','fromTerminal／toTerminal','大寫 T'])expect(prompt).toContain(instruction);
  for(const instruction of ['最多 3 個短項','hotel.note','review','不顯示 review','已取消訂單不輸出 items','實際付款收據取代舊待扣款計畫','訂單確認不等於已付款','跨日航班保留真實 arrivalDate','無資料不等於 0／false'])expect(prompt).toContain(instruction);
  expect(prompt).toContain('先停止產生最終 JSON');expect(prompt).toContain('直接上傳原始 PDF 到同一個 AI 對話');expect(prompt).toContain('已讀附件未載明座位');
 });
});
describe('concise notes with independent review records',()=>{
 it('keeps review out of imported notes while preserving an uncollected scheduled payment as unknown',()=>{
  const note='• 預定出發前一天自動扣款，完成狀態待確認。\n• 晚到請先聯絡櫃台。';
  const result=parseImport(JSON.stringify({version:2,items:[{type:'hotel',title:'示範旅宿',booking:'confirmed',notes:null,hotel:{name:'示範旅宿',checkinDate:trip.start,checkoutDate:'2026-11-21',total:'JPY 8,000',payment:null,note}}],review:[{itemTitle:'示範旅宿',kind:'source',detail:'核對程序不應變成旅途筆記',source:'demo-confirmation.pdf'}]}),[trip.start,'2026-11-21'],{});
  if('error'in result)throw Error(result.error);
  expect(result.rows[0].fields.hotel).toMatchObject({payment:'',total:'JPY 8,000',note});
  let n=0;const bundle=materializeImport(result.rows,trip,()=>String(++n));
  expect(bundle.items).toHaveLength(2);expect(bundle.items[0].note).toBe(note);expect(bundle.items[0].booking).toBe('confirmed');
  expect(JSON.stringify(bundle)).not.toContain('核對程序');expect(JSON.stringify(bundle)).not.toContain('demo-confirmation.pdf');
 });
 it('preserves a next-day arrival beyond the itinerary end and distinguishes missing baggage from known carry weight',()=>{
  const row=parsed([{type:'flight',title:'示範回程',flight:{airline:'CI',flightNo:'0199',from:'NRT',to:'TPE',departureDate:trip.end,departureTime:'23:10',departureZone:'Asia/Tokyo',arrivalDate:'2026-11-25',arrivalTime:'01:30',arrivalZone:'Asia/Taipei',seat:null,bags:null,carryKg:8},notes:null}]).rows[0];
  const item=materializeImport([row],trip,()=> 'overnight').items[0];
  expect(item.date).toBe(trip.end);expect(item.flight).toMatchObject({flightNo:'0199',arrivalDate:'2026-11-25',seat:'',carryKg:8});
  expect(item.missingFields).toContain('託運件數');expect(item.missingFields).not.toContain('手提重量');expect(item.note).toBeUndefined();
 });
 it('keeps a rental and its accessory instructions in one reservation without duplicating the total',()=>{
  const note='• 取車時攜帶預約要求的文件。\n• 隔日 16:00 在 B 門市還車，取出 ETC 卡另寄回。';
  const row=parsed([{type:'car',title:'示範租車',date:trip.start,start:'14:00',end:null,from:'A 門市',to:'B 門市（示範地址）',place:'A 門市（示範地址）',price:'JPY 12,500',orderNumber:'DEMO-CAR',notes:note}]).rows[0];
  const bundle=materializeImport([row],trip,()=> 'rental');
  expect(bundle.items).toHaveLength(1);expect(bundle.items[0]).toMatchObject({type:'car',from:'A 門市',to:'B 門市（示範地址）',address:'A 門市（示範地址）',price:'JPY 12,500',end:'',note});
 });
});
it('accepts currency-formatted ticket prices without silently turning them into free tickets',()=>{
 const row=parsed([{type:'ticket',date:trip.start,ticket:{name:'展覽',date:trip.start,time:'10:00',kinds:[{label:'成人',price:'JPY 9,800',quantity:2}],pickup:'qr'}}]).rows[0];expect(row.fields.cost).toBe(19600);
 const unknown=parsed([{type:'ticket',date:trip.start,ticket:{name:'展覽',date:trip.start,kinds:[{label:'成人',price:null,quantity:2}]}}]).rows[0];expect(unknown.fields.cost).toBeUndefined();expect(unknown.fields.missingFields).toContain('成人單價');
});
it('separates alphanumeric and three-letter carrier prefixes without dropping leading flight zeros',()=>{
 for(const [full,airline,flightNo]of [['7C1234','7C','1234'],['JAL0123','JAL','0123'],['CI0156','CI','0156']])expect(parsed([{type:'flight',title:'去程',date:trip.start,flightNumber:full}]).rows[0].fields.flight).toMatchObject({airline,flightNo});
});
