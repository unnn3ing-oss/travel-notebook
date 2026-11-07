import type { Item, Trip } from '../types';
import { tripDestination } from './destinations';

export interface City { name: string; country: string; countryCode: string; latitude: number; longitude: number; timezone: string }
export interface WeatherDay { date: string; code: number | null; low: number | null; high: number | null; rain: number | null }
export interface NearbyPlace { id: number; title: string; summary: string; latitude: number; longitude: number; distance: number; url: string }
export interface Nearby { stations: NearbyPlace[]; sights: NearbyPlace[] }
export interface Snapshot<T> { at: number; data: T }
export interface TravelInfoData { weather?: Snapshot<WeatherDay[]>; nearby?: Snapshot<Nearby>; weatherError?: string; nearbyError?: string }
export const WEATHER_TTL = 30 * 60_000;
export const NEARBY_TTL = 24 * 60 * 60_000;
export const RETRY_AFTER = 5 * 60_000;
const obj = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const str = (v: unknown, max = 300) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const numeric = (v: unknown, min: number, max: number): number | null => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null;
const date = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
export const cityKey = (c: City) => `${c.countryCode}:${c.latitude.toFixed(4)},${c.longitude.toFixed(4)}:${c.timezone}`;
export const stale = (at: number | undefined, ttl: number, now = Date.now()) => !at || !Number.isFinite(at) || at > now || now - at >= ttl;

const city = (name: string, country: string, countryCode: string, latitude: number, longitude: number, timezone: string): City => ({ name, country, countryCode, latitude, longitude, timezone });
const CITIES = [
  { aliases: /東京|东京|tokyo/i, airports: 'NRT HND', value: city('東京', '日本', 'JP', 35.6895, 139.69171, 'Asia/Tokyo') },
  { aliases: /大阪|osaka/i, airports: 'KIX ITM UKB', value: city('大阪', '日本', 'JP', 34.6937, 135.5023, 'Asia/Tokyo') },
  { aliases: /京都|kyoto/i, airports: '', value: city('京都', '日本', 'JP', 35.0211, 135.75385, 'Asia/Tokyo') },
  { aliases: /河口湖|kawaguchiko/i, airports: '', value: city('富士河口湖', '日本', 'JP', 35.4973, 138.7552, 'Asia/Tokyo') },
  { aliases: /福岡|福冈|fukuoka/i, airports: 'FUK', value: city('福岡', '日本', 'JP', 33.5902, 130.4017, 'Asia/Tokyo') },
  { aliases: /札幌|sapporo/i, airports: 'CTS', value: city('札幌', '日本', 'JP', 43.0618, 141.3545, 'Asia/Tokyo') },
  { aliases: /沖繩|冲绳|那霸|okinawa/i, airports: 'OKA', value: city('那霸', '日本', 'JP', 26.2125, 127.6811, 'Asia/Tokyo') },
  { aliases: /首爾|首尔|seoul/i, airports: 'ICN GMP', value: city('首爾', '韓國', 'KR', 37.5665, 126.978, 'Asia/Seoul') },
  { aliases: /釜山|busan/i, airports: 'PUS', value: city('釜山', '韓國', 'KR', 35.1796, 129.0756, 'Asia/Seoul') },
  { aliases: /台北|臺北|taipei/i, airports: 'TPE TSA', value: city('台北', '台灣', 'TW', 25.033, 121.5654, 'Asia/Taipei') },
  { aliases: /高雄|kaohsiung/i, airports: 'KHH', value: city('高雄', '台灣', 'TW', 22.6273, 120.3014, 'Asia/Taipei') },
  { aliases: /新加坡|singapore/i, airports: 'SIN XSP', value: city('新加坡', '新加坡', 'SG', 1.2897, 103.8501, 'Asia/Singapore') },
  { aliases: /香港|hong\s*kong/i, airports: 'HKG', value: city('香港', '香港', 'HK', 22.3193, 114.1694, 'Asia/Hong_Kong') },
  { aliases: /吉隆坡|kuala\s*lumpur/i, airports: 'KUL SZB', value: city('吉隆坡', '馬來西亞', 'MY', 3.139, 101.6869, 'Asia/Kuala_Lumpur') },
  { aliases: /檳城|槟城|penang/i, airports: 'PEN', value: city('喬治市', '馬來西亞', 'MY', 5.4141, 100.3288, 'Asia/Kuala_Lumpur') },
];
/** Only known public city names or airport codes leave the device automatically. */
export function suggestCity(trip: Trip, items: Item[]): City | undefined {
  const named = CITIES.filter(c => c.aliases.test(trip.name));
  if (named.length === 1) return named[0].value;
  const airport = tripDestination(items, trip.id)?.airport;
  return airport ? CITIES.find(c => c.airports.split(' ').includes(airport))?.value : undefined;
}
export function parseCity(value: unknown): City | undefined {
  const o = obj(value), latitude = numeric(o.latitude, -90, 90), longitude = numeric(o.longitude, -180, 180);
  const name = str(o.name, 100), country = str(o.country, 100), countryCode = str(o.countryCode || o.country_code, 2), timezone = str(o.timezone, 100);
  try { if (!timezone) return; new Intl.DateTimeFormat('en', { timeZone: timezone }); } catch { return; }
  if (!name || !/^[A-Z]{2}$/.test(countryCode) || latitude === null || longitude === null) return;
  return { name, country, countryCode, latitude, longitude, timezone };
}
export async function fetchJson(url: string, signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<unknown> {
  const response = await fetcher(url, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000), credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
export async function searchCities(query: string, signal?: AbortSignal, fetcher?: typeof fetch): Promise<City[]> {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.search = new URLSearchParams({ name: query.trim().slice(0, 100), count: '8', language: 'zh', format: 'json' }).toString();
  const data = obj(await fetchJson(url.href, signal, fetcher));
  if (!Array.isArray(data.results)) return [];
  return data.results.map(parseCity).filter((c): c is City => !!c);
}
export function parseWeather(value: unknown): WeatherDay[] {
  const daily = obj(obj(value).daily);
  if (!Array.isArray(daily.time)) throw new Error('預報資料格式不完整');
  const get = (key: string, i: number) => Array.isArray(daily[key]) ? (daily[key] as unknown[])[i] : null;
  const days = daily.time.slice(0, 16).flatMap((d, i) => date(d) ? [{ date: d, code: numeric(get('weather_code', i), 0, 99), low: numeric(get('temperature_2m_min', i), -100, 70), high: numeric(get('temperature_2m_max', i), -100, 70), rain: numeric(get('precipitation_probability_max', i), 0, 100) }] : []);
  if (!days.length) throw new Error('尚無可用預報');
  return days;
}
export const weatherLabel = (code: number | null) => code === 0 ? '晴' : code !== null && code <= 3 ? '多雲' : code === 45 || code === 48 ? '霧' : code !== null && code >= 51 && code <= 67 ? '雨' : code !== null && code >= 71 && code <= 77 ? '雪' : code !== null && code >= 80 && code <= 82 ? '陣雨' : code === 85 || code === 86 ? '陣雪' : code !== null && code >= 95 ? '雷雨' : '未提供';
export function weatherWindow(days: WeatherDay[], trip: Pick<Trip, 'start' | 'end'>) {
  const travel = days.filter(d => d.date >= trip.start && d.date <= trip.end);
  return { days: (travel.length ? travel : days).slice(0, 7), travel: travel.length > 0 };
}
export function distanceMeters(a: Pick<City, 'latitude' | 'longitude'>, b: Pick<City, 'latitude' | 'longitude'>) {
  const rad = Math.PI / 180, lat = (b.latitude - a.latitude) * rad, lon = (b.longitude - a.longitude) * rad;
  const h = Math.sin(lat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(lon / 2) ** 2;
  return Math.round(6_371_000 * 2 * Math.atan2(Math.sqrt(Math.min(1, h)), Math.sqrt(Math.max(0, 1 - h))));
}
export function wikiUrl(value: unknown): string | undefined {
  try { const url = new URL(str(value, 2000)); return url.protocol === 'https:' && url.hostname === 'zh.wikipedia.org' && url.pathname.startsWith('/wiki/') && !url.username && !url.password ? url.href : undefined; } catch { return; }
}
export function parseNearby(value: unknown, center: City): Nearby {
  const root = obj(value);
  if (!root.query || !obj(root.query).pages) {
    // A valid geosearch with no matches has batchcomplete and no query.
    if (Object.hasOwn(root, 'batchcomplete') && !root.error && !root.query) return { stations: [], sights: [] };
    throw new Error('周邊資料格式不完整');
  }
  const pages = obj(obj(root.query).pages), stations: NearbyPlace[] = [], sights: NearbyPlace[] = [], seen = new Set<string>();
  for (const raw of Object.values(pages).slice(0, 50)) {
    const p = obj(raw), coordinate = obj(Array.isArray(p.coordinates) ? p.coordinates[0] : null), latitude = numeric(coordinate.lat, -90, 90), longitude = numeric(coordinate.lon, -180, 180);
    const title = str(p.title, 150), id = numeric(p.pageid, 1, Number.MAX_SAFE_INTEGER), url = wikiUrl(p.fullurl);
    if (!title || id === null || latitude === null || longitude === null || !url || seen.has(title)) continue;
    const distance = distanceMeters(center, { latitude, longitude });
    if (distance > 5500) continue;
    const categories = (Array.isArray(p.categories) ? p.categories : []).map(c => str(obj(c).title)).join(' ');
    const station = /(?:車站|车站|站)(?:\s*[（(].*[）)])?$|機場|机场|碼頭|码头/.test(title) || /鐵路車站|铁路车站|地鐵車站|地铁车站/.test(categories);
    const sight = /博物|美術|美术|神社|神宮|神宫|寺|城堡|公園|公园|劇場|剧场|觀景|观景|名勝|名胜|觀光|观光|旅遊|旅游|古蹟|古迹|紀念|纪念|宮殿|宫殿|動物園|动物园|水族館|水族馆/.test(title + ' ' + categories);
    if (!station && !sight) continue;
    seen.add(title);
    const place = { id, title, latitude, longitude, distance, url, summary: str(p.extract, 1500).replace(/[（(](?:日語|日语|英語|英语|韓語|韩语|朝鮮語|朝鲜语|羅馬化|罗马化|發音|发音)[^）)]*[）)]/g, '').replace(/\s+/g, ' ').slice(0, 240) };
    (station ? stations : sights).push(place);
  }
  const sort = (a: NearbyPlace, b: NearbyPlace) => a.distance - b.distance || a.title.localeCompare(b.title);
  return { stations: stations.sort(sort).slice(0, 6), sights: sights.sort(sort).slice(0, 6) };
}
export const mapsLink = (place: NearbyPlace) => `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`;
export function transportSource(c: City): { label: string; url: string } | undefined {
  if (c.countryCode === 'JP') return /大阪|京都/.test(c.name) ? { label: 'JR 西日本營運資訊', url: 'https://global.trafficinfo.westjr.co.jp/en/' } : /東京/.test(c.name) ? { label: 'JR 東日本營運資訊', url: 'https://traininfo.jreast.co.jp/train_info/e/kanto.aspx' } : { label: '日本官方交通指南', url: 'https://www.japan.travel/en/plan/getting-around/' };
  const sources: Record<string, { label: string; url: string }> = {
    KR: { label: '韓國官方交通指南', url: 'https://english.visitkorea.or.kr/' }, TW: { label: '臺鐵官方查詢', url: 'https://tip.railway.gov.tw/tra-tip-web/tip' },
    SG: { label: 'MyTransport 官方資訊', url: 'https://www.mytransport.sg/content/mytransport/home.html' }, HK: { label: '香港運輸署交通消息', url: 'https://www.td.gov.hk/en/special_news/trafficnews.html' },
    MY: { label: 'Rapid KL 官方資訊', url: 'https://myrapid.com.my/' },
  };
  return sources[c.countryCode];
}

export function cacheKey(c: City) { return 'travel-info:v1:cache:' + cityKey(c); }
export function readInfo(c: City, storage?: Pick<Storage, 'getItem'>, now = Date.now()): TravelInfoData {
  try {
    const root = obj(JSON.parse((storage || localStorage).getItem(cacheKey(c)) || 'null'));
    if (root.version !== 1 || root.city !== cityKey(c)) return {};
    const result: TravelInfoData = {};
    const w = obj(root.weather), n = obj(root.nearby);
    const validTime = (v: unknown) => numeric(v, 1, now);
    if (validTime(w.at) && Array.isArray(w.data)) {
      const valid = w.data.length <= 16 && w.data.every(raw => { const d = obj(raw); return date(d.date) && ['code', 'low', 'high', 'rain'].every(k => d[k] === null || numeric(d[k], k === 'low' || k === 'high' ? -100 : 0, k === 'rain' ? 100 : k === 'code' ? 99 : 70) !== null); });
      if (valid && w.data.length) result.weather = w as unknown as Snapshot<WeatherDay[]>;
    }
    if (validTime(n.at)) {
      const data = obj(n.data);
      const validPlaces = (values: unknown) => Array.isArray(values) && values.length <= 6 && values.every(raw => { const p = obj(raw); return !!str(p.title, 150) && numeric(p.id, 1, Number.MAX_SAFE_INTEGER) !== null && numeric(p.latitude, -90, 90) !== null && numeric(p.longitude, -180, 180) !== null && numeric(p.distance, 0, 5500) !== null && !!wikiUrl(p.url) && typeof p.summary === 'string'; });
      if (validPlaces(data.stations) && validPlaces(data.sights)) result.nearby = n as unknown as Snapshot<Nearby>;
    }
    return result;
  } catch { return {}; }
}
export function saveInfo(c: City, data: TravelInfoData, storage?: Pick<Storage, 'setItem'>) {
  try { (storage || localStorage).setItem(cacheKey(c), JSON.stringify({ version: 1, city: cityKey(c), weather: data.weather, nearby: data.nearby })); return true; } catch { return false; }
}
/** Each provider keeps its last successful data; a partial failure never makes old data fresh. */
export async function refreshInfo(c: City, cached: TravelInfoData, options: { force?: boolean; signal?: AbortSignal; now?: number; fetcher?: typeof fetch } = {}): Promise<TravelInfoData> {
  const { force = false, signal, fetcher, now = Date.now() } = options;
  const result: TravelInfoData = { ...cached, weatherError: undefined, nearbyError: undefined };
  const weather = new URL('https://api.open-meteo.com/v1/forecast');
  weather.search = new URLSearchParams({ latitude: String(c.latitude), longitude: String(c.longitude), daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max', timezone: c.timezone, forecast_days: '16' }).toString();
  const nearby = new URL('https://zh.wikipedia.org/w/api.php');
  nearby.search = new URLSearchParams({ action: 'query', generator: 'geosearch', ggscoord: `${c.latitude}|${c.longitude}`, ggsradius: '5000', ggslimit: '50', prop: 'extracts|coordinates|info|categories', exintro: '1', explaintext: '1', exsentences: '2', exlimit: '20', inprop: 'url', cllimit: '10', clshow: '!hidden', format: 'json', origin: '*' }).toString();
  await Promise.all([
    (async () => { if (force || stale(cached.weather?.at, WEATHER_TTL, now)) try { const data = parseWeather(await fetchJson(weather.href, signal, fetcher)); result.weather = { at: Date.now(), data }; } catch { result.weatherError = '天氣更新失敗'; } })(),
    (async () => { if (force || stale(cached.nearby?.at, NEARBY_TTL, now)) try { const data = parseNearby(await fetchJson(nearby.href, signal, fetcher), c); result.nearby = { at: Date.now(), data }; } catch { result.nearbyError = '交通／景點更新失敗'; } })(),
  ]);
  if (signal?.aborted) throw signal.reason || new DOMException('Aborted', 'AbortError');
  return result;
}
