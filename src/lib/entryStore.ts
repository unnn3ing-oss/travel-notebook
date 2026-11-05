import { db, uid } from '../db';
import type { Item, Route } from '../types';
import { byTime } from './day';
import { toMin } from './time';

/** Manual order is retained; cards without one use their position by time. */
export function orderedDay(items:Item[],date:string|null):Item[] {
  const list=items.filter(i=>i.date===date).sort(byTime);
  const position=new Map(list.map((i,k)=>[i.id,k]));
  return list.sort((a,b)=>(a.order??position.get(a.id)!)-(b.order??position.get(b.id)!)||position.get(a.id)!-position.get(b.id)!);
}
/** Insert each new or retimed card before the first later time, retaining other relative order. */
export function insertByTime(existing:Item[],incoming:Item[]):Item[] {
  const ids=new Set(incoming.map(i=>i.id));
  const list=existing.filter(i=>!ids.has(i.id));
  for(const item of [...incoming].sort(byTime)) {
    const minutes=toMin(item.start);
    const at=Number.isFinite(minutes)?list.findIndex(i=>Number.isFinite(toMin(i.start))&&toMin(i.start)>minutes):-1;
    list.splice(at<0?list.length:at,0,item);
  }
  return list.map((i,order)=>({...i,order}));
}
export async function saveEntries(items:Item[],routes?:Route[],attachments:File[]=[]):Promise<void> {
  if(!items.length)return;
  await db.transaction('rw',db.items,db.routes,db.documents,async()=>{
    const before=await db.items.where({tripId:items[0].tripId}).toArray();
    const dates=new Set([...items.map(i=>i.date),...before.filter(i=>items.some(n=>n.id===i.id)).map(i=>i.date)]);
    const merged=items.map(item=>({...before.find(i=>i.id===item.id),...item}));
    const incomingIds=new Set(items.map(i=>i.id));
    for(const date of dates){
      const previous=orderedDay(before,date).filter(i=>!incomingIds.has(i.id));
      const next=insertByTime(previous,merged.filter(i=>i.date===date));
      await db.items.bulkPut(next);
    }
    if(routes){await db.routes.where({itemId:items[0].id}).delete();await db.routes.bulkPut(routes);}
    for(const file of attachments)await db.documents.add({id:uid(),tripId:items[0].tripId,itemId:items[0].id,name:file.name,file});
  });
}

/** Remove a linked stay as one unit so no orphan checkout or attachments remain. */
export async function removeEntry(id:string) {
  return db.transaction('rw',db.items,db.routes,db.documents,async()=>{
    const selected=await db.items.get(id);
    if(!selected)return {items:[],routes:[],documents:[]};
    const linked=selected.linkedStayId?await db.items.get(selected.linkedStayId):undefined;
    const parent=linked?.tripId===selected.tripId?linked:selected;
    const ids=[parent.id,...(parent.hotel?.checkoutId?[parent.hotel.checkoutId]:[])];
    const items=(await db.items.bulkGet(ids)).filter((i):i is Item=>!!i&&i.tripId===selected.tripId);
    const itemIds=items.map(i=>i.id);
    const routes=await db.routes.where('itemId').anyOf(itemIds).toArray();
    const documents=await db.documents.where({tripId:selected.tripId}).filter(d=>!!d.itemId&&itemIds.includes(d.itemId)).toArray();
    await db.items.bulkDelete(itemIds);
    await db.routes.bulkDelete(routes.map(r=>r.id));
    await db.documents.bulkDelete(documents.map(d=>d.id));
    return {items,routes,documents};
  });
}
