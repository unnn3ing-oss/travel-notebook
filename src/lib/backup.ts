import { db } from '../db';

export const BACKUP_TABLES = ['trips', 'items', 'routes', 'tasks', 'expenses', 'details', 'documents'] as const;
export type BackupTable = typeof BACKUP_TABLES[number];
type Row = Record<string, unknown>;
export interface BackupSummary { trips: number; items: number; documents: number }
export interface PreparedBackup { tables: Record<BackupTable, Row[]>; summary: BackupSummary; createdAt?: string }
export const MAX_BACKUP_BYTES = 50 * 1024 * 1024;
export class BackupError extends Error {}
const object = (v:unknown):Row => v&&typeof v==='object'&&!Array.isArray(v)?v as Row:{};
const text = (v:unknown):v is string => typeof v==='string';
const date = (v:unknown) => text(v)&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const time = (v:unknown) => text(v)&&(v===''||/^([01]\d|2[0-3]):[0-5]\d$/.test(v));
const finite = (v:unknown):v is number => typeof v==='number'&&Number.isFinite(v)&&v>=0;
const fail = () => { throw new BackupError('備份格式不完整或損壞，原資料尚未變更。'); };
const TYPES=['place','restaurant','transit','hotel','flight','ticket','car','other'];

export function backupName(now = new Date()) {
  const pad=(v:number)=>String(v).padStart(2,'0');
  return `旅行手帳備份-${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json`;
}
async function dataUrl(blob:Blob) {
  const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';
  for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
  return `data:${blob.type};base64,${btoa(binary)}`;
}
function fileBlob(value:unknown):Blob {
  if(!text(value)||value.length>MAX_BACKUP_BYTES) return fail();
  const match=/^data:([^,]*);base64,([A-Za-z0-9+/]*={0,2})$/.exec(value);
  if(!match||match[2].length%4!==0||match[1].length>200)return fail();
  try{return new Blob([Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0))],{type:match[1]});}catch{return fail();}
}
export async function createBackup() {
  // Blob conversion must happen after the read transaction, so it cannot expire halfway through.
  const rows=await db.transaction('r',BACKUP_TABLES.map(t=>db.table(t)),async()=>{
    const result={} as Record<BackupTable,Row[]>;
    for(const t of BACKUP_TABLES)result[t]=await db.table(t).toArray();return result;
  });
  const attachments=rows.documents.reduce((total,d)=>{if(!(d.file instanceof Blob))return fail();return total+d.file.size;},0);
  if(attachments*4/3>MAX_BACKUP_BYTES)throw new BackupError('備份含附件超過 50 MB，請先精簡附件再試。');
  const documents=await Promise.all(rows.documents.map(async d=>({...d,file:await dataUrl(d.file as Blob)})));
  const data={format:'travel-notebook',version:2,createdAt:new Date().toISOString(),...rows,documents};
  const blob=new Blob([JSON.stringify(data)],{type:'application/json'});
  if(blob.size>MAX_BACKUP_BYTES)throw new BackupError('備份超過 50 MB，請先精簡附件再試。');
  return {blob,name:backupName(),summary:{trips:rows.trips.length,items:rows.items.length,documents:rows.documents.length}};
}
export function prepareBackup(raw:string):PreparedBackup {
  if(new Blob([raw]).size>MAX_BACKUP_BYTES)throw new BackupError('備份超過 50 MB，無法在此裝置還原。');
  let root:Row;try{root=object(JSON.parse(raw));}catch{return fail();}
  if(root.format!=='travel-notebook'||root.version!==2)return fail();
  const tables={} as Record<BackupTable,Row[]>;
  for(const t of BACKUP_TABLES){
    if(!Array.isArray(root[t])||root[t].length>100000)return fail();
    const rows=root[t].map(object),ids=new Set<string>();
    for(const row of rows){if(!text(row.id)||!row.id||row.id.length>200||ids.has(row.id))return fail();ids.add(row.id);}
    tables[t]=rows;
  }
  if(!tables.trips.every(t=>text(t.name)&&date(t.start)&&date(t.end)&&String(t.end)>=String(t.start)&&finite(t.people)&&Number.isInteger(t.people)&&t.people>=1&&text(t.currency)))return fail();
  const trips=new Set(tables.trips.map(t=>t.id));
  for(const name of ['items','tasks','expenses','documents'] as const)if(!tables[name].every(r=>text(r.tripId)&&trips.has(r.tripId)))return fail();
  if(!tables.items.every(i=>text(i.title)&&TYPES.includes(String(i.type))&&(i.date===null||date(i.date))&&time(i.start)&&time(i.end)))return fail();
  if(!tables.routes.every(r=>text(r.itemId)&&text(r.name)&&finite(r.minutes)&&finite(r.walk)&&text(r.place)&&typeof r.primary==='boolean'&&(r.fare===null||finite(r.fare))))return fail();
  if(!tables.tasks.every(t=>text(t.title)&&text(t.group)&&finite(t.daysBefore)&&typeof t.done==='boolean'))return fail();
  if(!tables.expenses.every(e=>text(e.title)&&date(e.date)&&finite(e.amount)))return fail();
  if(!tables.details.every(d=>text(d.address)&&finite(d.rate)&&Array.isArray(d.contacts)&&d.contacts.every(text)))return fail();
  const optionalStrings=(r:Row,keys:string[])=>keys.every(k=>r[k]===undefined||text(r[k]));
  const optionalNumbers=(r:Row,keys:string[])=>keys.every(k=>r[k]===undefined||finite(r[k]));
  const optionalBooleans=(r:Row,keys:string[])=>keys.every(k=>r[k]===undefined||typeof r[k]==='boolean');
  for(const i of tables.items){
    if(!optionalStrings(i,['note','orderNumber','price','from','to','address','hours','url','originalDate','linkedStayId'])||!optionalNumbers(i,['cost','order','stay','cancelLead'])||!optionalBooleans(i,['imported','cancelRemind']))return fail();
    if(i.booking!==undefined&&!['none','ordered','confirmed'].includes(String(i.booking)))return fail();
    for(const k of ['flight','hotel','ticket'])if(i[k]!==undefined){const detail=object(i[k]);if(!Object.keys(detail).length)return fail();if(!optionalBooleans(detail,['remind','breakfast']))return fail();
      const strings=k==='flight'?['airline','flightNo','from','fromTerminal','departureDate','departureTime','departureZone','to','toTerminal','arrivalDate','arrivalTime','arrivalZone','reference','seat','cabin','price','rules']:k==='hotel'?['name','checkinDate','checkoutDate','checkinTime','checkoutTime','address','phone','reference','room','total','payment','cancelBy','note','checkoutId']:['name','venue','date','time','pickup','place','reference'];
      const numbers=k==='flight'?['bags','bagKg','carryKg','checkinMinutes']:k==='hotel'?['guests']:['early'];
      if(!optionalStrings(detail,strings)||!optionalNumbers(detail,numbers))return fail();
      if(detail.kinds!==undefined&&(!Array.isArray(detail.kinds)||!detail.kinds.every(v=>{const kind=object(v);return text(kind.label)&&finite(kind.price)&&finite(kind.quantity);})))return fail();}
    for(const k of ['tags','alts','watch','missingFields'])if(i[k]!==undefined&&!Array.isArray(i[k]))return fail();
    for(const k of ['tags','missingFields'])if(Array.isArray(i[k])&&!i[k].every(text))return fail();
    if(Array.isArray(i.alts)&&!i.alts.every(v=>{const a=object(v);return text(a.name)&&['none','ordered','confirmed'].includes(String(a.status))&&optionalStrings(a,['note','cancelBefore']);}))return fail();
    if(Array.isArray(i.watch)&&!i.watch.every(v=>{const w=object(v);return text(w.text)&&typeof w.done==='boolean';}))return fail();
  }
  for(const r of tables.routes){
    if(!['walk','train','subway','tram','bus','car','ferry','rental','plane'].includes(String(r.mode)))return fail();
    if(r.legs!==undefined&&(!Array.isArray(r.legs)||!r.legs.every(v=>{const l=object(v);return text(l.label)&&finite(l.minutes)&&optionalNumbers(l,['fare'])&&optionalStrings(l,['place']);})))return fail();
    if(r.departures!==undefined&&(!Array.isArray(r.departures)||!r.departures.every(v=>{const d=object(v);return time(d.dep)&&time(d.arr)&&text(d.info);})))return fail();
  }
  tables.documents=tables.documents.map(d=>{if(!text(d.name)||d.itemId!==undefined&&!text(d.itemId))return fail();return {...d,file:fileBlob(d.file)};});
  return {tables,createdAt:text(root.createdAt)&&Number.isFinite(Date.parse(root.createdAt))?root.createdAt:undefined,summary:{trips:tables.trips.length,items:tables.items.length,documents:tables.documents.length}};
}
export async function restoreBackup(backup:PreparedBackup) {
  await db.transaction('rw',BACKUP_TABLES.map(t=>db.table(t)),async()=>{
    for(const t of BACKUP_TABLES){await db.table(t).clear();if(backup.tables[t].length)await db.table(t).bulkPut(backup.tables[t]);}
  });
}
