import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { Trip } from '../types';
import { cityKey, mapsLink, NEARBY_TTL, parseCity, readInfo, refreshInfo, RETRY_AFTER, saveInfo, searchCities, stale, suggestCity, transportSource, WEATHER_TTL, weatherLabel, weatherWindow } from '../lib/travelInfo';
import type { City, NearbyPlace, TravelInfoData } from '../lib/travelInfo';

interface Settings { automatic: boolean; city?: City }
function readSettings(id: string): Settings {
  try { const value = JSON.parse(localStorage.getItem('travel-info:v1:settings:' + id) || '{}'); return { automatic: value?.automatic !== false, city: parseCity(value?.city) }; } catch { return { automatic: true }; }
}
const updated = (at?: number) => at ? new Intl.DateTimeFormat('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(at) : '尚未取得資料';
const temp = (n: number | null) => n === null ? '—' : `${Math.round(n)}°`;

/** Public city-level context stays separate from the user's itinerary and private documents. */
export function TravelInfo({ trip }: { trip: Trip }) {
  const items = useLiveQuery(() => db.items.where({ tripId: trip.id }).toArray(), [trip.id]);
  const [settings, setSettings] = useState(() => readSettings(trip.id));
  const [changing, setChanging] = useState(false), [query, setQuery] = useState(''), [matches, setMatches] = useState<City[]>([]);
  const [searching, setSearching] = useState(false), [searchError, setSearchError] = useState(''), [storageError, setStorageError] = useState('');
  const search = useRef<AbortController | null>(null);
  useEffect(() => () => search.current?.abort(), []);
  const city = settings.city || (items ? suggestCity(trip, items) : undefined);
  function save(next: Settings) {
    setSettings(next);
    try { localStorage.setItem('travel-info:v1:settings:' + trip.id, JSON.stringify(next)); setStorageError(''); } catch { setStorageError('設定暫時無法保存在裝置，這次仍可使用。'); }
  }
  async function find(e: React.FormEvent) {
    e.preventDefault(); search.current?.abort();
    if (query.trim().length < 2) return;
    const controller = new AbortController(); search.current = controller; setSearching(true); setMatches([]); setSearchError('');
    try { const cities = await searchCities(query, controller.signal); if (!controller.signal.aborted) { setMatches(cities); if (!cities.length) setSearchError('找不到城市，請試英文或鄰近城市名稱。'); } }
    catch { if (!controller.signal.aborted) setSearchError('城市搜尋失敗，請確認網路後重試。'); }
    finally { if (!controller.signal.aborted) setSearching(false); }
  }
  return <section className="travel-info" aria-label="旅途資訊">
    <div className="ti-heading"><div><h2>旅途資訊</h2><p>{city ? `${city.name}・${city.country}` : '選擇目的地城市'}</p></div><button className="ti-text-button" onClick={() => { setChanging(!changing); search.current?.abort(); setSearching(false); }}>更換城市</button></div>
    {(!city || changing) && <form className="ti-city-search" onSubmit={find}>
      <label htmlFor={'ti-city-' + trip.id}>搜尋城市（不使用裝置定位）</label>
      <div><input id={'ti-city-' + trip.id} value={query} maxLength={100} onChange={e => { search.current?.abort(); setSearching(false); setQuery(e.target.value); setMatches([]); setSearchError(''); }} placeholder="例如：京都、Tokyo" autoComplete="off" /><button disabled={searching || query.trim().length < 2}>{searching ? '搜尋中…' : '搜尋'}</button></div>
      {searchError && <p role="status">{searchError}</p>}
      {!!matches.length && <ul>{matches.map(c => <li key={cityKey(c)}><button type="button" onClick={() => { save({ ...settings, city: c }); setChanging(false); setMatches([]); }}>{c.name}・{c.country}<small>{c.timezone}</small></button></li>)}</ul>}
    </form>}
    <label className="ti-auto"><input type="checkbox" checked={settings.automatic} onChange={e => save({ ...settings, automatic: e.target.checked })} />聯網時自動更新</label>
    {storageError && <p className="ti-message" role="status">{storageError}</p>}
    {city ? <CityInfo key={trip.id + cityKey(city)} trip={trip} city={city} automatic={settings.automatic} /> : <p className="ti-message">輸入城市後，可查看天氣、周邊車站與景點。只查詢城市名稱與中心座標，不會傳送訂位資料、筆記或附件。</p>}
  </section>;
}

function CityInfo({ trip, city, automatic }: { trip: Trip; city: City; automatic: boolean }) {
  const [tab, setTab] = useState<'weather' | 'stations' | 'sights'>('weather');
  const [expanded, setExpanded] = useState(false);
  const [data, setData] = useState<TravelInfoData>(() => readInfo(city));
  const latest = useRef(data);
  const [online, setOnline] = useState(navigator.onLine), [busy, setBusy] = useState(false), [storageError, setStorageError] = useState(false);
  const manual = useRef<() => void>(() => {});
  useEffect(() => {
    let active = true, loading = false, lastAttempt = 0, connected = navigator.onLine;
    const controller = new AbortController();
    async function run(force = false) {
      if (!active || loading || !navigator.onLine || document.visibilityState === 'hidden' || (!force && !automatic)) return;
      if (!force && (Date.now() - lastAttempt < RETRY_AFTER || (!stale(latest.current.weather?.at, WEATHER_TTL) && !stale(latest.current.nearby?.at, NEARBY_TTL)))) return;
      loading = true; lastAttempt = Date.now(); setBusy(true);
      try {
        const next = await refreshInfo(city, latest.current, { force, signal: controller.signal });
        if (active) { latest.current = next; setData(next); setStorageError(!saveInfo(city, next)); }
      } catch { /* Navigation / switching settings aborts obsolete work. */ }
      finally { loading = false; if (active) setBusy(false); }
    }
    const connection = () => { const reconnected = !connected && navigator.onLine; connected = navigator.onLine; setOnline(connected); if (reconnected && !loading) { lastAttempt = 0; void run(); } };
    const foreground = () => { if (document.visibilityState !== 'hidden') void run(); };
    manual.current = () => { void run(true); };
    setBusy(false); void run();
    const timer = window.setInterval(foreground, 60_000);
    window.addEventListener('online', connection); window.addEventListener('offline', connection); window.addEventListener('focus', foreground); document.addEventListener('visibilitychange', foreground);
    return () => { active = false; controller.abort(); clearInterval(timer); window.removeEventListener('online', connection); window.removeEventListener('offline', connection); window.removeEventListener('focus', foreground); document.removeEventListener('visibilitychange', foreground); };
  }, [city, automatic]);
  const snapshot = tab === 'weather' ? data.weather : data.nearby;
  const expired = !!snapshot && stale(snapshot.at, tab === 'weather' ? WEATHER_TTL : NEARBY_TTL);
  const error = tab === 'weather' ? data.weatherError : data.nearbyError;
  const days = weatherWindow(data.weather?.data || [], trip);
  const official = transportSource(city);
  const places = tab === 'stations' ? data.nearby?.data.stations : data.nearby?.data.sights;
  return <>
    <div className="ti-status"><span role="status">{!online ? snapshot ? '離線・顯示上次資料' : '離線・尚無快取' : busy ? '更新中…' : error ? `${error}${snapshot ? '・保留上次資料' : '・請稍後重試'}` : data.weatherError || data.nearbyError ? '部分資料更新失敗' : expired ? '資料已過期・待更新' : snapshot ? automatic ? '聯網自動更新' : '自動更新已關閉' : '尚無資料'}</span><button className="ti-text-button" disabled={!online || busy} onClick={() => manual.current()}>立即更新</button></div>
    <div className="ti-tabs" role="tablist" aria-label="旅途資訊類型">{([['weather', '天氣'], ['stations', '交通'], ['sights', '景點']] as const).map(([key, label]) => <button type="button" key={key} id={'ti-tab-' + key} role="tab" aria-selected={tab === key} aria-controls={'ti-panel-' + key} onClick={() => { setTab(key); setExpanded(false); }}>{label}</button>)}</div>
    <div role="tabpanel" id={'ti-panel-' + tab} aria-labelledby={'ti-tab-' + tab}>
      <p className="ti-meta">{snapshot ? `取得於 ${updated(snapshot.at)}${expired ? '・已過期' : ''}` : '尚未取得資料'}{!online && '・離線快取'}</p>
      {tab === 'weather' ? <>
        {!!days.days.length && <p className="ti-caption">{days.travel ? '旅行日期內可取得的預報' : '旅程日期不在目前預報範圍，以下為近期天氣'}・{city.timezone}</p>}
        {days.days.length ? <ul className="ti-weather">{days.days.map(d => <li key={d.date}><time dateTime={d.date}>{d.date.slice(5).replace('-', '/')}</time><span>{weatherLabel(d.code)}</span><b className="num">{temp(d.low)}–{temp(d.high)}</b><span aria-label="降雨機率">{d.rain === null ? '未提供' : `${Math.round(d.rain)}% 雨`}</span></li>)}</ul> : <p className="ti-message">{busy ? '正在取得天氣預報。' : '尚無天氣預報，聯網後可更新。'}</p>}
        <p className="ti-source">來源：<a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>・預報可能變動</p>
      </> : <>
        <p className="ti-caption">城市中心周邊約 5 公里・依直線距離排序{tab === 'stations' ? '，非即時班次或延誤資訊。' : '，非住宿附近或營業狀態。'}</p>
        {places?.length ? <ul className="ti-places">{(expanded ? places : places.slice(0, 3)).map(p => <PlaceRow key={p.id} place={p} />)}</ul> : <p className="ti-message">{busy ? '正在取得周邊資料。' : data.nearby ? '此範圍暫無符合條件的資料，可更換鄰近城市查詢。' : '尚無周邊資料，聯網後可更新。'}</p>}
        {places && places.length > 3 && <button className="ti-text-button" onClick={() => setExpanded(!expanded)}>{expanded ? '收起' : `顯示其餘 ${places.length - 3} 個`}</button>}
        {tab === 'stations' && official && <a className="ti-official" href={official.url} target="_blank" rel="noreferrer">{official.label} ↗<small>另開官方網站查詢；尚未自動取得營運狀態</small></a>}
        <p className="ti-source">來源：Wikipedia・摘要經刪節 <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA</a>，全文與修訂紀錄見各項來源。</p>
      </>}
    </div>
    {storageError && <p className="ti-message" role="status">本次資料可查看，但裝置空間不足或未允許儲存，離線快取未更新。</p>}
    <p className="ti-privacy">只查詢城市與中心座標。App 開啟並回到前景時更新；不會更動你的行程。</p>
  </>;
}
function PlaceRow({ place }: { place: NearbyPlace }) {
  return <li><div className="ti-place-title"><b>{place.title}</b><span className="num">{place.distance < 1000 ? `${place.distance} m` : `${(place.distance / 1000).toFixed(1)} km`}</span></div>{place.summary && <p>{place.summary.slice(0, 100)}{place.summary.length > 100 ? '…' : ''}</p>}<div className="ti-place-links"><a href={place.url} target="_blank" rel="noreferrer">百科來源 ↗</a><a href={mapsLink(place)} target="_blank" rel="noreferrer">在地圖開啟 ↗</a></div></li>;
}
