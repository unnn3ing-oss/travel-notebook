import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid } from '../db';
import { href } from '../lib/route';
import { md, weekday } from '../lib/time';
import { css, I, TabPage } from '../design';
import type { Trip, TripDetails } from '../types';
import type { Clock } from '../lib/clock';

const ROW = 'display: flex; justify-content: space-between; align-items: center; gap: 12px; min-height: 52px; border-bottom: 1px solid #DCE1E8; font-size: 15px';
const SMALL_IN = 'height: 40px; box-sizing: border-box; border: 1px solid #DCE1E8; border-radius: 10px; padding: 0 10px; font: inherit; font-size: 15px; color: #1E2A44; background: #FFFFFF';
const LINK = 'min-height: 52px; box-sizing: border-box; padding: 0 16px; border-radius: 14px; background: #FFFFFF; text-decoration: none; display: flex; align-items: center; justify-content: space-between; font-size: 15px; font-weight: 700';
const CUR: Record<string, string> = { JPY: '日圓', KRW: '韓元', THB: '泰銖', TWD: '新台幣', EUR: '歐元' };

/** 設計稿「旅途必備」(Essentials) */
export function Essentials({ trip, clock }: { trip: Trip; clock: Clock }) {
  const expenses = useLiveQuery(() => db.expenses.where({ tripId: trip.id, date: clock.date }).toArray(), [trip.id, clock.date]) ?? [];
  const documents = useLiveQuery(() => db.documents.where({ tripId: trip.id }).toArray(), [trip.id]) ?? [];
  const details = useLiveQuery(() => db.details.get(trip.id), [trip.id]);
  const hotels = useLiveQuery(() => db.items.where({ tripId: trip.id }).filter((i) => i.type === 'hotel' && !!i.date && i.date <= clock.date && !/退房/.test(i.title)).toArray(), [trip.id, clock.date]) ?? [];
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [card, setCard] = useState(false);
  const [edit, setEdit] = useState<'' | 'sos' | 'addr'>('');
  const [err, setErr] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const label = useRef<string>('');
  const value: TripDetails = details ?? { id: trip.id, address: '', rate: trip.currency === 'TWD' ? 1 : 0, contacts: ['', '', ''] };
  const save = (p: Partial<TripDetails>) => db.details.put({ ...value, ...p });
  const japan = trip.timezone === 'Asia/Tokyo' || (!trip.timezone && trip.currency === 'JPY');
  const total = expenses.reduce((n, e) => n + e.amount, 0);
  const sym = ({ JPY: '¥', KRW: '₩', THB: '฿', TWD: 'NT$', EUR: '€' } as Record<string, string>)[trip.currency] ?? '';
  const money = (n: number, s = sym) => s + Math.round(n).toLocaleString('en-US');
  const tonight = hotels.sort((a, b) => b.date!.localeCompare(a.date!))[0];
  const suggested = ['護照資料頁', '電子機票', ...(japan ? ['Visit Japan Web 入境 QR Code'] : []), '旅平險保單'];
  const extra = documents.filter((d) => !suggested.includes(d.name) && !d.itemId);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    try {
      for (const f of Array.from(files)) await db.documents.add({ id: uid(), tripId: trip.id, name: label.current || f.name, file: f });
    } catch { setErr('檔案沒存成功，請確認手機空間。'); }
    label.current = '';
  }
  async function view(id: string) {
    const d = await db.documents.get(id);
    if (!d) return;
    const url = URL.createObjectURL(d.file);
    window.open(url, '_blank') ?? Object.assign(document.createElement('a'), { href: url, download: d.name }).click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
  const pickFile = (l: string) => { label.current = l; file.current?.click(); };
  const contacts: [string, number, string][] = [[japan ? '駐日代表處急難救助' : '駐外館處急難救助', 0, '急難救助電話'], ['旅平險 24 小時救援', 1, '救援電話'], ['信用卡掛失', 2, '發卡銀行電話']];

  return (
    <TabPage gap={24}>
      <header>
        <h1 style={css('margin: 0; font-size: 28px; font-weight: 700')}>旅途必備</h1>
        <p style={css('margin: 4px 0 0; font-size: 14px; color: #5B6578')}>全部存在手機裡，沒有網路也看得到。</p>
      </header>

      <section aria-labelledby="sos-h" style={css('display: flex; flex-direction: column; gap: 8px')}>
        <div style={css('display: flex; justify-content: space-between; align-items: center')}>
          <h2 id="sos-h" style={css('margin: 0; font-size: 16px; font-weight: 700')}>緊急電話{japan ? '（日本）' : ''}</h2>
          <button onClick={() => setEdit(edit === 'sos' ? '' : 'sos')} style={css('height: 40px; padding: 0 4px; border: 0; background: transparent; color: #1E2A44; font: inherit; font-size: 14px; font-weight: 500')}>{edit === 'sos' ? '完成' : '編輯'}</button>
        </div>
        {japan && (
          <div style={css('display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px')}>
            <a href="tel:110" style={css('min-height: 72px; box-sizing: border-box; padding: 12px 14px; border-radius: 14px; background: #b83a32; color: #fff; text-decoration: none; display: flex; flex-direction: column; justify-content: center')}><span style={css('font-size: 13px')}>警察</span><span className="num" style={css('font-size: 26px; font-weight: 700')}>110</span></a>
            <a href="tel:119" style={css('min-height: 72px; box-sizing: border-box; padding: 12px 14px; border-radius: 14px; background: #b83a32; color: #fff; text-decoration: none; display: flex; flex-direction: column; justify-content: center')}><span style={css('font-size: 13px')}>救護車、消防</span><span className="num" style={css('font-size: 26px; font-weight: 700')}>119</span></a>
          </div>
        )}
        <ul style={css('list-style: none; margin: 0; padding: 0')}>
          {contacts.map(([l, k, ph]) => (
            <li key={l} style={css(ROW)}>
              <span style={css('display: flex; flex-direction: column')}><span>{l}</span>
                {k === 1 && (edit === 'sos'
                  ? <input aria-label="保單號碼" value={value.policy ?? ''} onChange={(e) => save({ policy: e.target.value })} placeholder="保單號碼" className="num" style={css(SMALL_IN + '; height: 32px; font-size: 12px; margin-top: 4px; width: 140px')} />
                  : value.policy && <span className="num" style={css('font-size: 12px; color: #5B6578')}>保單 {value.policy}</span>)}
              </span>
              {edit === 'sos'
                ? <input aria-label={l} type="tel" value={value.contacts[k] ?? ''} onChange={(e) => save({ contacts: value.contacts.map((v, i) => (i === k ? e.target.value : v)) })} placeholder={ph} className="num" style={css(SMALL_IN + '; width: 150px; text-align: right')} />
                : value.contacts[k]
                  ? <a href={'tel:' + value.contacts[k].replace(/[^\d+]/g, '')} className="num" style={css('font-weight: 700; text-decoration: none')}>{value.contacts[k]}</a>
                  : <button onClick={() => setEdit('sos')} style={css('height: 36px; padding: 0 12px; border-radius: 10px; border: 1px dashed #B8C0CC; background: transparent; color: #5B6578; font: inherit; font-size: 13px')}>填電話</button>}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="addr-h" style={css('display: flex; flex-direction: column; gap: 8px')}>
        <div style={css('display: flex; justify-content: space-between; align-items: center')}>
          <h2 id="addr-h" style={css('margin: 0; font-size: 16px; font-weight: 700')}>給司機看的地址</h2>
          {value.address && <button onClick={() => setEdit(edit === 'addr' ? '' : 'addr')} style={css('height: 40px; padding: 0 4px; border: 0; background: transparent; color: #1E2A44; font: inherit; font-size: 14px; font-weight: 500')}>{edit === 'addr' ? '完成' : '編輯'}</button>}
        </div>
        <div style={css('background: #FFFFFF; border-radius: 16px; padding: 16px; display: flex; flex-direction: column; gap: 10px')}>
          {tonight && <p style={css('margin: 0; font-size: 13px; color: #5B6578')}>今晚住宿：{tonight.title.replace(/入住$/, '')}</p>}
          {!value.address || edit === 'addr' ? <>
            <input aria-label="住宿名稱（當地語言）" value={value.hotelName ?? ''} onChange={(e) => save({ hotelName: e.target.value })} placeholder={japan ? '住宿名稱（日文），例如：ホテル京都' : '住宿名稱（當地語言）'} style={css(SMALL_IN + '; height: 44px')} />
            <textarea aria-label="住宿地址（當地語言）" rows={2} value={value.address} onChange={(e) => save({ address: e.target.value })} placeholder={japan ? '地址（日文），從訂房確認信複製' : '地址（當地語言）'} style={css('font: inherit; font-size: 16px; line-height: 1.5; color: #1E2A44; border: 1px solid #DCE1E8; border-radius: 10px; padding: 10px; resize: none; background: #FFFFFF')} />
            <input aria-label="住宿電話" type="tel" value={value.hotelPhone ?? ''} onChange={(e) => save({ hotelPhone: e.target.value })} placeholder="住宿電話" className="num" style={css(SMALL_IN + '; height: 44px')} />
          </> : (
            <p lang={japan ? 'ja' : undefined} style={css('margin: 0; font-size: 20px; font-weight: 700; line-height: 1.5; white-space: pre-line')}>{value.hotelName ? value.hotelName + '\n' : ''}{value.address}</p>
          )}
          <button disabled={!value.address.trim()} onClick={() => setCard(true)} style={{ ...css('height: 48px; border-radius: 12px; border: 0; background: #1E2A44; color: #FFFFFF; font: inherit; font-size: 15px; font-weight: 700'), opacity: value.address.trim() ? 1 : 0.45 }}>放大給司機看</button>
        </div>
      </section>

      <section aria-labelledby="doc-h" style={css('display: flex; flex-direction: column; gap: 4px')}>
        <div style={css('display: flex; justify-content: space-between; align-items: center')}>
          <h2 id="doc-h" style={css('margin: 0; font-size: 16px; font-weight: 700')}>證件與票券</h2>
          <button onClick={() => pickFile('')} style={css('height: 40px; padding: 0 4px; border: 0; background: transparent; color: #1E2A44; font: inherit; font-size: 14px; font-weight: 500')}>＋ 加入</button>
        </div>
        <input ref={file} type="file" multiple accept="image/*,application/pdf" className="visually-hidden" onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
        <ul style={css('list-style: none; margin: 0; padding: 0')}>
          {suggested.map((l) => {
            const d = documents.find((x) => x.name === l);
            return (
              <li key={l} style={css(ROW)}>
                {d ? <button onClick={() => view(d.id)} style={css('flex: 1; min-height: 52px; border: 0; background: transparent; color: #1E2A44; font: inherit; font-size: 15px; text-align: left; padding: 0')}>{l}</button> : <span>{l}</span>}
                {d ? <span style={css('font-size: 13px; color: #1F7A5C; font-weight: 700')}>已存在手機</span>
                  : <button onClick={() => pickFile(l)} style={css('height: 36px; flex-shrink: 0; padding: 0 12px; border-radius: 10px; border: 1px solid #E8B4AF; background: #FFFFFF; color: #B83A32; font: inherit; font-size: 13px; font-weight: 700')}>還沒存・加入</button>}
              </li>
            );
          })}
          {extra.map((d) => (
            <li key={d.id} style={css(ROW)}>
              <button onClick={() => view(d.id)} style={css('flex: 1; min-width: 0; min-height: 52px; border: 0; background: transparent; color: #1E2A44; font: inherit; font-size: 15px; text-align: left; padding: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap')}>{d.name}</button>
              <button aria-label={'刪除 ' + d.name} onClick={() => { if (confirm('刪除「' + d.name + '」？')) db.documents.delete(d.id); }} style={css('height: 36px; padding: 0 10px; border: 0; background: transparent; color: #5B6578; font: inherit; font-size: 13px')}>刪除</button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="money-h" style={css('display: flex; flex-direction: column; gap: 10px')}>
        <div style={css('display: flex; justify-content: space-between; align-items: baseline')}>
          <h2 id="money-h" style={css('margin: 0; font-size: 16px; font-weight: 700')}>今天的花費</h2>
          <span style={css('font-size: 13px; color: #5B6578')}>{md(clock.date)} {weekday(clock.date)}</span>
        </div>
        <div style={css('display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap')}>
          <span className="num" style={css('font-size: 36px; font-weight: 700')}>{money(total)}</span>
          {trip.currency !== 'TWD' && value.rate > 0 && <span className="num" style={css('font-size: 15px; color: #5B6578')}>約 {money(total * value.rate, 'NT$')}，每人 {money(total / trip.people)}</span>}
          {(trip.currency === 'TWD' || !value.rate) && trip.people > 1 && <span className="num" style={css('font-size: 15px; color: #5B6578')}>每人 {money(total / trip.people)}</span>}
        </div>
        {trip.currency !== 'TWD' && (
          <label style={css('display: flex; align-items: center; gap: 8px; font-size: 13px; color: #5B6578; flex-wrap: wrap')}>匯率：1 {CUR[trip.currency] ?? trip.currency} =
            <input type="number" step="0.001" min="0" value={value.rate || ''} onChange={(e) => save({ rate: Math.max(0, Number(e.target.value) || 0) })} className="num" style={css('width: 80px; height: 36px; box-sizing: border-box; border: 1px solid #DCE1E8; border-radius: 8px; padding: 0 8px; font-size: 16px; color: #1E2A44; background: #FFFFFF')} />新台幣（自己設定，不會連網更新）
          </label>
        )}
        <ul style={css('list-style: none; margin: 0; padding: 0')}>
          {expenses.map((e) => (
            <li key={e.id} style={css('display: flex; justify-content: space-between; align-items: center; gap: 8px; min-height: 48px; border-bottom: 1px solid #DCE1E8; font-size: 15px')}>
              <span style={css('flex: 1')}>{e.title}</span><span className="num" style={css('font-weight: 700')}>{money(e.amount)}</span>
              <button aria-label={'刪除 ' + e.title} onClick={() => db.expenses.delete(e.id)} style={css('width: 32px; height: 32px; border: 0; background: transparent; color: #8A94A6; display: flex; align-items: center; justify-content: center')}>{I.close}</button>
            </li>
          ))}
        </ul>
        <form onSubmit={async (e) => { e.preventDefault(); const amt = Number(amount); if (!(amt > 0)) return; try { await db.expenses.add({ id: uid(), tripId: trip.id, date: clock.date, title: name.trim().slice(0, 30) || '未命名', amount: amt }); setName(''); setAmount(''); } catch { setErr('花費沒存成功。'); } }} style={css('display: flex; gap: 8px')}>
          <label style={css('flex: 1; min-width: 0')}><span className="visually-hidden">花費項目</span><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="項目，例如：咖啡" style={css('width: 100%; height: 48px; box-sizing: border-box; border: 1px solid #DCE1E8; border-radius: 12px; padding: 0 12px; font: inherit; font-size: 16px; color: #1E2A44; background: #FFFFFF')} /></label>
          <label style={css('width: 104px; flex-shrink: 0')}><span className="visually-hidden">金額</span><input type="number" inputMode="decimal" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={sym || trip.currency} className="num" style={css('width: 100%; height: 48px; box-sizing: border-box; border: 1px solid #DCE1E8; border-radius: 12px; padding: 0 12px; font-size: 16px; color: #1E2A44; background: #FFFFFF')} /></label>
          <button aria-label="記一筆" style={css('width: 48px; height: 48px; flex-shrink: 0; border-radius: 12px; border: 0; background: #1E2A44; color: #FFFFFF; display: flex; align-items: center; justify-content: center')}>{I.plus}</button>
        </form>
      </section>
      {err && <p role="alert" style={css('margin: 0; padding: 10px 12px; border-radius: 10px; background: #F9E1DF; color: #B83A32; font-size: 13px')}>{err}</p>}

      <a href={href('prep')} style={css(LINK)}>出發前準備清單{I.chev}</a>
      <a href={href('settings')} style={css(LINK)}>設定與備份{I.chev}</a>

      {card && (
        <section role="dialog" aria-modal="true" aria-label="給司機看的地址" style={css('position: fixed; inset: 0; z-index: 60; background: #fff; color: #1e2a44; padding: 64px 28px max(32px, env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 24px; overflow-y: auto')}>
          <p lang={japan ? 'ja' : undefined} style={css('margin: 0; font-size: 22px; font-weight: 700')}>{japan ? 'ここへ行ってください' : 'Please take me here'}</p>
          {value.hotelName && <p lang={japan ? 'ja' : undefined} style={css('margin: 0; font-size: 40px; font-weight: 700; line-height: 1.4')}>{value.hotelName}</p>}
          <p lang={japan ? 'ja' : undefined} style={css('margin: 0; font-size: 30px; font-weight: 500; line-height: 1.5; white-space: pre-line')}>{value.address}</p>
          {value.hotelPhone && <p className="num" style={css('margin: 0; font-size: 24px')}>TEL {value.hotelPhone}</p>}
          <button onClick={() => setCard(false)} style={css('margin-top: auto; height: 56px; flex-shrink: 0; border-radius: 14px; border: 1px solid #dce1e8; background: #fff; color: #1e2a44; font: inherit; font-size: 16px; font-weight: 700')}>關閉</button>
        </section>
      )}
    </TabPage>
  );
}
