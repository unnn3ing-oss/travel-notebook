import { useRef, useState } from 'react';
import { db } from '../db';
import { Back } from './Trips';
import { href } from '../lib/route';
import { Icon } from '../components/ui';
import type { Trip } from '../types';

export function Settings({trip}:{trip:Trip}) {
 const input=useRef<HTMLInputElement>(null);const [note,setNote]=useState('');const [theme,setTheme]=useState(localStorage.getItem('travel-theme')||'system');
 async function backup(){try{const tables=['trips','items','routes','tasks','expenses','details','documents'];const data:Record<string,unknown>={format:'travel-notebook',version:2};for(const t of tables){const rows=await db.table(t).toArray();data[t]=t==='documents'?await Promise.all(rows.map(async d=>({...d,file:await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=reject;r.readAsDataURL(d.file);})}))):rows;}const url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='旅行手帳備份.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setNote('備份檔已產生，請妥善保存。');}catch{setNote('備份失敗，請重試。');}}
 async function restore(f:File|undefined){if(!f)return;try{const data=JSON.parse(await f.text());const tables=['trips','items','routes','tasks','expenses','details','documents'];if(data.format!=='travel-notebook'||data.version!==2||!tables.every(t=>Array.isArray(data[t])&&data[t].every((r:Record<string,unknown>)=>typeof r.id==='string')))throw Error();
 // Validate the fields consumed by the application before importing.
 if(!data.trips.every((t:Trip)=>typeof t.name==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(t.start)&&/^\d{4}-\d{2}-\d{2}$/.test(t.end)&&t.end>=t.start&&t.people>=1&&typeof t.currency==='string'))throw Error();
 for(const d of data.documents){if(typeof d.file!=='string'||!d.file.startsWith('data:'))throw Error();const response=await fetch(d.file);d.file=await response.blob();}
 if(!confirm('還原會合併備份中的資料，相同編號會覆蓋。確定繼續？'))return;
 await db.transaction('rw',tables.map(t=>db.table(t)),async()=>{for(const t of tables)await db.table(t).bulkPut(data[t]);});setNote('備份已還原。');}catch{setNote('無法還原：請選擇旅行手帳產生的有效備份檔。');}}
 function changeTheme(v:string){setTheme(v);localStorage.setItem('travel-theme',v);document.documentElement.dataset.theme=v;}
 return <main className="screen standalone"><Back to="essentials"/><h1>設定與備份</h1>
 <section className="stack"><h2>資料備份</h2><div className="note">資料存在這台裝置，建議出發前備份一次。</div><button className="btn primary" onClick={backup}>備份成檔案</button><p className="small muted">會存成一個 .json 檔，可以放到 iCloud 雲碟或傳給自己。檔案裡有旅程和證件資料，請妥善保管。</p><button className="btn" onClick={()=>input.current?.click()}>從備份檔還原</button><input ref={input} type="file" accept="application/json,.json" className="visually-hidden" onChange={e=>{restore(e.target.files?.[0]);e.target.value='';}}/>{note&&<p className="note" role="status">{note}</p>}</section>
 <section className="stack"><h2>外觀</h2><div className="chips">{[['system','跟隨系統'],['light','淺色'],['dark','深色']].map(([v,l])=><button key={v} className="chip" aria-pressed={theme===v} onClick={()=>changeTheme(v)}>{l}</button>)}</div></section>
 <section className="stack"><h2>其他</h2><a className="menu-link" href={href('')}>切換旅程<Icon name="chevron"/></a><div className="setting-row">這趟旅程的時區<span>{trip.timezone||'依裝置時間'}</span></div><button className="btn danger" onClick={async()=>{if(!confirm(`刪除「${trip.name}」及其所有資料？這個動作無法復原。`))return;await db.transaction('rw',db.tables,async()=>{const ids=await db.items.where({tripId:trip.id}).primaryKeys();await db.routes.where('itemId').anyOf(ids).delete();for(const t of ['items','tasks','expenses','documents'])await db.table(t).where({tripId:trip.id}).delete();await db.details.delete(trip.id);await db.trips.delete(trip.id);});location.hash=href('');}}>刪除「{trip.name}」</button></section>
 </main>;
}
