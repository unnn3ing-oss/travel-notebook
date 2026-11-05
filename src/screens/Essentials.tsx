import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid } from '../db';
import { Icon, Sheet } from '../components/ui';
import { href } from '../lib/route';
import { md, weekday } from '../lib/time';
import type { Trip, TripDetails } from '../types';
import type { Clock } from '../lib/clock';

export function Essentials({ trip, clock }: { trip: Trip; clock: Clock }) {
  const expenses = useLiveQuery(() => db.expenses.where({tripId:trip.id, date:clock.date}).toArray(),[trip.id,clock.date]) ?? [];
  const documents = useLiveQuery(() => db.documents.where({tripId:trip.id}).toArray(),[trip.id]) ?? [];
  const details = useLiveQuery(() => db.details.get(trip.id),[trip.id]);
  const [name,setName] = useState(''); const [amount,setAmount] = useState(''); const [card,setCard] = useState(false); const [err,setErr] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const value: TripDetails = details ?? {id:trip.id,address:'',rate:trip.currency === 'TWD' ? 1 : 0,contacts:['','','']};
  const save = (p: Partial<TripDetails>) => db.details.put({...value,...p});
  const total = expenses.reduce((n,e) => n + e.amount,0);
  const japanese = trip.timezone === 'Asia/Tokyo' || (!trip.timezone && trip.currency === 'JPY');
  const fmt = (n:number,c=trip.currency) => new Intl.NumberFormat('zh-TW',{style:'currency',currency:c,maximumFractionDigits:2}).format(n);
  async function upload(files:FileList | null) {if (!files) return;try {for (const f of Array.from(files)) await db.documents.add({id:uid(),tripId:trip.id,name:f.name,file:f});} catch {setErr('檔案未能儲存，請確認裝置空間。');}}
  async function view(id:string) {const d=await db.documents.get(id);if (!d) return;const url=URL.createObjectURL(d.file);const a=document.createElement('a');a.href=url;a.download=d.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  return <main className="screen essentials"><header><h1>旅途必備</h1><p className="muted small">全部存在手機裡，沒有網路也看得到。</p></header>
    <section className="stack"><h2>緊急電話{japanese ? '（日本）' : '（自行填寫當地電話）'}</h2>
      {japanese && <div className="grid2"><a className="emergency" href="tel:110"><small>警察</small><strong className="num">110</strong></a><a className="emergency" href="tel:119"><small>救護車、消防</small><strong className="num">119</strong></a></div>}
      {['代表處急難救助','旅平險 24 小時救援','信用卡掛失'].map((l,k) => <label className="contact-row" key={l}><span>{l}</span><input aria-label={l} type="tel" placeholder="填入電話" value={value.contacts[k]} onChange={e=>save({contacts:value.contacts.map((v,i)=> i===k ? e.target.value : v)})}/>{value.contacts[k] && <a href={'tel:'+value.contacts[k]} aria-label={'撥打'+l}>撥打</a>}</label>)}
    </section>
    <section className="stack"><h2>給司機看的地址</h2><div className="card"><label className="field">住宿名稱與當地地址<textarea placeholder="填入當地語言的住宿名稱與地址" value={value.address} onChange={e=>save({address:e.target.value})}/></label><button className="btn primary" disabled={!value.address.trim()} onClick={()=>setCard(true)}>放大給司機看</button></div></section>
    <section className="stack"><div className="between"><h2>證件與票券</h2><button className="btn link" onClick={()=>file.current?.click()}>＋ 加入</button></div><input ref={file} type="file" multiple accept="image/*,application/pdf" className="visually-hidden" onChange={e=>{upload(e.target.files);e.target.value='';}}/>
      <ul className="list">{documents.map(d=><li key={d.id}><button className="document-open" onClick={()=>view(d.id)}>{d.name}<small>已存在手機 · 下載查看</small></button><button className="btn small" aria-label={'刪除 '+d.name} onClick={()=>{if(confirm('刪除此檔案？'))db.documents.delete(d.id);}}>刪除</button></li>)}</ul>{!documents.length && <p className="small muted">還沒存證件或票券。加入後即可離線查看。</p>}
    </section>
    <section className="stack"><div className="between"><h2>今天的花費</h2><small className="muted">{md(clock.date)} {weekday(clock.date)}</small></div><strong className="expense-total num">{fmt(total)}</strong>{value.rate>0 && <p className="small muted num">約 {fmt(total*value.rate,'TWD')}，每人 {fmt(total*value.rate/trip.people,'TWD')}</p>}
      <label className="rate-row small muted">匯率：1 {trip.currency} = <input aria-label="新台幣匯率" type="number" min="0" step="0.001" value={value.rate || ''} onChange={e=>save({rate:Number(e.target.value)})}/> 新台幣</label><p className="small muted">自己設定，不會連網更新。</p>
      <ul className="list">{expenses.map(e=><li key={e.id} className="between"><span>{e.title}</span><b className="num">{fmt(e.amount)}</b></li>)}</ul>
      <form className="expense-form" onSubmit={async e=>{e.preventDefault();if (!name.trim() || !amount || Number(amount)<0)return;try {await db.expenses.add({id:uid(),tripId:trip.id,date:clock.date,title:name.trim(),amount:Number(amount)});setName('');setAmount('');}catch{setErr('花費未能儲存。');}}}><input aria-label="花費項目" required placeholder="項目，例如：咖啡" value={name} onChange={e=>setName(e.target.value)}/><input aria-label="金額" required type="number" min="0" step="0.01" placeholder={trip.currency} value={amount} onChange={e=>setAmount(e.target.value)}/><button className="btn primary" aria-label="記一筆"><Icon name="plus"/></button></form>
    </section>
    {err && <p className="error" role="alert">{err}</p>}
    <a className="menu-link" href={href('prep')}>出發前準備清單<Icon name="chevron"/></a><a className="menu-link" href={href('settings')}>設定與備份<Icon name="chevron"/></a>
    {card && <Sheet title="給司機看" onClose={()=>setCard(false)}><p className="driver-address">{value.address}</p><button className="btn primary" onClick={()=>setCard(false)}>關閉</button></Sheet>}
  </main>;
}
