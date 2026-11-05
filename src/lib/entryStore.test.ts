import 'fake-indexeddb/auto';
import { afterEach, expect, it } from 'vitest';
import { db } from '../db';
import { hotelItems } from './entries';
import { orderedDay, saveEntries } from './entryStore';
import type { HotelDetails, Item, Trip } from '../types';
const trip:Trip={id:'trip',name:'京都',start:'2026-11-20',end:'2026-11-24',people:2,currency:'JPY'};
const hotel:HotelDetails={name:'京都飯店',checkinDate:trip.start,checkoutDate:'2026-11-23',checkinTime:'15:00',checkoutTime:'11:00',address:'京都市',phone:'123',reference:'HOTEL',room:'雙人房',guests:2,breakfast:true,total:'¥54000',payment:'later',cancelBy:'2026-11-17',remind:true,note:''};
const base:Item={id:'stay',tripId:trip.id,type:'hotel',title:'',date:trip.start,start:'',end:'',booking:'confirmed'};
afterEach(async()=>{await db.delete();});
it('persists paired cards, reindexes their days, and updates the same pair without duplicates',async()=>{
 await db.open();
 await db.items.bulkAdd([{...base,id:'morning',type:'place',start:'09:00',title:'上午',order:0},{...base,id:'evening',type:'place',start:'18:00',title:'晚上',order:1}]);
 await saveEntries(hotelItems(base,hotel,trip,'checkout'));
 expect(orderedDay(await db.items.toArray(),trip.start).map(i=>i.id)).toEqual(['morning','stay','evening']);
 await db.items.update('checkout',{note:'保留使用者筆記'});
 const stored=(await db.items.get('stay'))!;
 await saveEntries(hotelItems(stored,{...hotel,checkinTime:'08:00',checkoutDate:'2026-11-24'},trip,'checkout'));
 expect(await db.items.count()).toBe(4);
 expect(orderedDay(await db.items.toArray(),trip.start).map(i=>i.id)).toEqual(['stay','morning','evening']);
 expect(await db.items.get('checkout')).toMatchObject({date:'2026-11-24',linkedStayId:'stay',note:'保留使用者筆記'});
});
it('rolls back all cards when a route write fails',async()=>{
 await db.open();
 await expect(saveEntries([base],[{itemId:base.id} as never])).rejects.toBeDefined();
 expect(await db.items.count()).toBe(0);expect(await db.routes.count()).toBe(0);
});
it('removes both linked stay cards and their documents without deleting other travel cards',async()=>{
 await db.open();
 await saveEntries(hotelItems(base,hotel,trip,'checkout'));
 await db.items.add({...base,id:'keep',type:'place'});
 await db.documents.add({id:'confirmation',tripId:trip.id,itemId:'stay',name:'confirm.pdf',file:new Blob(['confirmation'])});
 const {removeEntry}=await import('./entryStore');
 const removed=await removeEntry('checkout');
 expect(removed.items).toHaveLength(2);
 expect(await db.items.toArray()).toMatchObject([{id:'keep'}]);
 expect(await db.documents.count()).toBe(0);
});
