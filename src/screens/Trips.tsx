import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid } from '../db';
import { Icon } from '../components/ui';
import { href } from '../lib/route';
import { daysBetween, md } from '../lib/time';
import type { Trip } from '../types';

export function Back({ to = '' }: { to?: string }) { return <a href={href(to)} className="round-btn" aria-label="返回"><Icon name="back" /></a>; }
const places: [RegExp, string, string][] = [[/京都|大阪|東京|北海道|沖繩|日本|福岡|名古屋/, 'Asia/Tokyo', 'JPY'], [/首爾|釜山|濟州|韓國/, 'Asia/Seoul', 'KRW'], [/曼谷|清邁|普吉|泰國/, 'Asia/Bangkok', 'THB'], [/巴黎|法國/, 'Europe/Paris', 'EUR'], [/台北|台中|台南|高雄|花蓮|台灣/, 'Asia/Taipei', 'TWD']];
export function NewTrip({ select }: { select: (trip: Trip) => void }) {
  const [dest, setDest] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [people, setPeople] = useState(2);
  const [tz, setTz] = useState('Asia/Tokyo');
  const [currency, setCurrency] = useState('JPY');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const validDates = !!start && !!end && end >= start;
  const days = validDates ? daysBetween(start, end) + 1 : 0;
  const name = dest.trim() + ' ' + days + ' 日';
  const valid = !!dest.trim() && validDates;
  async function create(e: React.FormEvent) {
    e.preventDefault(); if (!valid || saving) return;
    setSaving(true); setError('');
    try { const trip: Trip = { id: uid(), name, start, end, people, currency, timezone: tz }; await db.trips.add(trip); select(trip); location.hash = href('plan'); }
    catch { setError('旅程未能儲存，請再試一次。'); setSaving(false); }
  }
  return <form className="new-trip" onSubmit={create}>
    <main className="screen standalone"><Back /><h1>開始新旅程</h1>
      <label className="field strong">要去哪裡<input autoComplete="off" value={dest} placeholder="例如：京都、首爾、曼谷" onChange={e => { const v = e.target.value; setDest(v); const p = places.find(([re]) => re.test(v)); if (p) { setTz(p[1]); setCurrency(p[2]); } }} /></label>
      <div className="grid2"><label className="field strong">出發日<input type="date" required value={start} onChange={e => setStart(e.target.value)} /></label><label className="field strong">回程日<input type="date" required min={start} value={end} onChange={e => setEnd(e.target.value)} /></label></div>
      <p className={'date-note small ' + (start && end && !validDates ? 'error' : 'muted')} role="status">{start && end && !validDates ? '回程日比出發日早，請再確認' : validDates ? `共 ${days} 天 ${days - 1} 晚` : '選好日期後會算出天數'}</p>
      <div className="between"><b className="small">幾個人</b><div className="stepper" role="group" aria-label="旅遊人數"><button type="button" aria-label="減少一人" disabled={people <= 1} onClick={() => setPeople(people - 1)}>−</button><b className="num" aria-live="polite">{people}</b><button type="button" aria-label="增加一人" disabled={people >= 20} onClick={() => setPeople(people + 1)}>+</button></div></div>
      <section className="local-settings stack"><h2>當地設定</h2><p className="small muted">依目的地自動帶入。時間判斷和花費換算都會用這兩項。</p>
        <label className="setting-row">時區<select value={tz} onChange={e => setTz(e.target.value)}>{[['Asia/Tokyo','日本（UTC+9）'],['Asia/Seoul','韓國（UTC+9）'],['Asia/Bangkok','泰國（UTC+7）'],['Asia/Taipei','台灣（UTC+8）'],['Europe/Paris','法國（夏令 UTC+2）']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label className="setting-row">當地貨幣<select value={currency} onChange={e => setCurrency(e.target.value)}>{[['JPY','日圓 JPY'],['KRW','韓元 KRW'],['THB','泰銖 THB'],['TWD','新台幣 TWD'],['EUR','歐元 EUR']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      </section>
    </main>
    <footer className="create-footer">{error && <p className="error" role="alert">{error}</p>}<button className="btn primary" disabled={!valid || saving}>{saving ? '建立中…' : valid ? `建立「${name}」` : '填好目的地和日期就能建立'}</button><p className="small muted">資料只存在這台裝置，不需要帳號。</p></footer>
  </form>;
}
export function PastTrips({ trips, today, select }: { trips: Trip[]; today: string; select: (trip: Trip) => void }) {
  const past = trips.filter(t => t.end < today).sort((a,b) => b.start.localeCompare(a.start));
  const items = useLiveQuery(() => db.items.toArray(), []);
  return <main className="screen standalone"><Back /><header><h1>回顧過去旅行</h1><p className="muted num">{past.length} 趟旅行，共 {past.reduce((n,t) => n + daysBetween(t.start,t.end) + 1,0)} 天</p></header>
    {past.map((t,k) => <a className={'past-ticket ' + (k === 0 ? 'featured' : '')} key={t.id} href={href('overview')} onClick={() => select(t)}><p className="num small">{t.start.replaceAll('-','/')} – {md(t.end)}，{t.people} 人</p><h2>{t.name}</h2><div className="past-stats"><span>去過的地點<strong className="num">{items?.filter(i => i.tripId === t.id && i.type === 'place' && i.date).length ?? 0}</strong></span><span>筆記<strong className="num">{items?.filter(i => i.tripId === t.id && i.note).length ?? 0}</strong></span><Icon name="chevron" /></div></a>)}
    {!past.length && <section className="card empty-state"><Icon name="home" size={36} /><h2>旅行的回憶，會留在這裡</h2><p className="small muted">旅程結束後，就能回來看走過的地方與筆記。</p></section>}
    <a className="btn primary" href={href('new')}>開始新旅程</a>
  </main>;
}
