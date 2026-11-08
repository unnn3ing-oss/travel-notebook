import 'fake-indexeddb/auto';
import {afterEach,expect,it,vi} from 'vitest';
import {db} from '../db';
import {BACKUP_TABLES,createBackup,prepareBackup,restoreBackup} from './backup';
async function seed(){
 await db.open();await db.trips.add({id:'trip',name:'備份示範',start:'2026-11-20',end:'2026-11-24',people:2,currency:'JPY',timezone:'Asia/Tokyo'});
 await db.items.add({id:'item',tripId:'trip',type:'place',title:'示範景點',date:'2026-11-20',start:'09:00',end:'10:00',note:'保留筆記 🌸',order:0});
 await db.routes.add({id:'route',itemId:'item',name:'示範路線',mode:'train',minutes:20,walk:0,place:'月台',fare:200,primary:true,legs:[{mode:'train',label:'路段',minutes:20,fare:200}],departures:[],ticket:{ref:'DEMO-ROUTE'}});
 await db.tasks.add({id:'task',tripId:'trip',group:'documents',title:'準備資料',daysBefore:3,done:false});
 await db.expenses.add({id:'expense',tripId:'trip',date:'2026-11-20',title:'示範花費',amount:500});
 await db.details.add({id:'trip',address:'示範地址',rate:0.2,contacts:['DEMO-PHONE','','']});
 await db.documents.add({id:'doc',tripId:'trip',itemId:'item',name:'demo.pdf',file:new Blob([new Uint8Array([0,255,7,10,42])],{type:'application/pdf'})});
}
afterEach(async()=>{vi.restoreAllMocks();vi.unstubAllGlobals();await db.delete();});
it('roundtrips all seven tables and exact binary attachment bytes through the existing JSON v2 format',async()=>{
 await seed();const backup=await createBackup(),raw=JSON.parse(await backup.blob.text());expect(raw).toMatchObject({format:'travel-notebook',version:2,documents:[{file:'data:application/pdf;base64,AP8HCio='}]});
 const prepared=prepareBackup(JSON.stringify(raw));expect(prepared.summary).toEqual({trips:1,items:1,documents:1});
 await db.items.update('item',{note:'不應留在還原後'});await restoreBackup(prepared);
 expect((await db.items.get('item'))?.note).toBe('保留筆記 🌸');expect((await db.routes.get('route'))?.ticket?.ref).toBe('DEMO-ROUTE');
 for(const t of BACKUP_TABLES)expect(await db.table(t).count()).toBe(1);
 const doc=(await db.documents.get('doc'))!;expect(doc.file.type).toBe('application/pdf');expect([...new Uint8Array(await doc.file.arrayBuffer())]).toEqual([0,255,7,10,42]);
});
it('keeps compatibility with old v2 files without createdAt and does not persist tokens or local cache',async()=>{
 await seed();vi.stubGlobal('localStorage',{getItem:()=> 'not-part-of-backup'});const data=JSON.parse(await(await createBackup()).blob.text());delete data.createdAt;
 expect(prepareBackup(JSON.stringify(data)).createdAt).toBeUndefined();expect(Object.keys(data).sort()).toEqual([...BACKUP_TABLES,'format','version'].sort());expect(JSON.stringify(data)).not.toContain('not-part-of-backup');
});
it('rejects invalid format, duplicate IDs, dates and nested objects before writing',async()=>{
 await seed();const data=JSON.parse(await(await createBackup()).blob.text());
 for(const mutate of [(d:typeof data)=>{d.format='wrong';},(d:typeof data)=>{d.items.push(d.items[0]);},(d:typeof data)=>{d.trips[0].start='2026-02-30';},(d:typeof data)=>{d.items[0].note={unsafe:'object'};},(d:typeof data)=>{d.items[0].hotel={name:{unsafe:'object'}};}]){const changed=structuredClone(data);mutate(changed);expect(()=>prepareBackup(JSON.stringify(changed))).toThrow();}
 expect(await db.items.count()).toBe(1);expect((await db.items.get('item'))?.note).toBe('保留筆記 🌸');
});
it('rejects remote or corrupt attachment URLs without fetching them',async()=>{
 await seed();const data=JSON.parse(await(await createBackup()).blob.text()),fetcher=vi.spyOn(globalThis,'fetch');
 for(const file of ['https://example.com/file.pdf','data:application/pdf;base64,not valid','data:application/pdf;base64,a']){data.documents[0].file=file;expect(()=>prepareBackup(JSON.stringify(data))).toThrow();}
 expect(fetcher).not.toHaveBeenCalled();expect(await db.documents.count()).toBe(1);
});
it('rolls back cleared tables and partial restore when any table write fails',async()=>{
 await seed();const prepared=prepareBackup(await(await createBackup()).blob.text());prepared.tables.trips[0].name='不應留下';
 delete prepared.tables.items[0].id; // Force an IndexedDB key error after trips were already written.
 await expect(restoreBackup(prepared)).rejects.toThrow();expect((await db.trips.get('trip'))?.name).toBe('備份示範');expect(await db.items.count()).toBe(1);expect(await db.documents.count()).toBe(1);
});
it('keeps timed route legs with backup departures and rejects malformed leg times',async()=>{
 await seed();const legs=[{mode:'train',label:'成田特快',minutes:40,dep:'10:30',arr:'11:10',alts:[{dep:'11:00',arr:'11:40',info:'下一班'}]}];
 await db.routes.update('route',{legs:legs as never,departures:[{dep:'10:30',arr:'11:10',info:'成田特快'}]});
 const raw=JSON.parse(await(await createBackup()).blob.text());await db.routes.update('route',{legs:[]});await restoreBackup(prepareBackup(JSON.stringify(raw)));
 expect((await db.routes.get('route'))?.legs).toEqual(legs);
 const bad=structuredClone(raw);bad.routes[0].legs[0].alts[0].arr='10:00';expect(()=>prepareBackup(JSON.stringify(bad))).toThrow();
});
