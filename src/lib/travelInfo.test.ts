import { afterEach, describe, expect, it, vi } from 'vitest';
import { cacheKey, cityKey, distanceMeters, mapsLink, parseCity, parseNearby, parseWeather, readInfo, refreshInfo, saveInfo, searchCities, stale, suggestCity, transportSource, WEATHER_TTL, weatherLabel, weatherWindow } from './travelInfo';
import type { City, TravelInfoData } from './travelInfo';
import type { Item, Trip } from '../types';
const now = Date.parse('2026-11-07T02:00:00Z');
const tokyo: City = { name: '東京', country: '日本', countryCode: 'JP', latitude: 35.6895, longitude: 139.69171, timezone: 'Asia/Tokyo' };
const seoul: City = { name: '首爾', country: '韓國', countryCode: 'KR', latitude: 37.5665, longitude: 126.978, timezone: 'Asia/Seoul' };
const trip: Trip = { id: 'demo', name: '東京旅行', start: '2026-11-09', end: '2026-11-12', people: 2, currency: 'JPY' };
const weather = { daily: { time: ['2026-11-07', '2026-11-09'], weather_code: [0, 61], temperature_2m_min: [0, null], temperature_2m_max: [12, 15], precipitation_probability_max: [0, 90] } };
const page = (pageid: number, title: string, lat = tokyo.latitude, lon = tokyo.longitude) => ({ pageid, title, extract: '示範摘要。', coordinates: [{ lat, lon }], fullurl: 'https://zh.wikipedia.org/wiki/' + encodeURIComponent(title), categories: [] });
const nearby = { query: { pages: { a: page(1, '示範站'), b: page(2, '示範公園', 35.69), c: page(3, '示範公司'), d: page(4, '很遠的公園', 37.5), e: { ...page(5, '惡意公園'), fullurl: 'javascript:alert(1)' }, f: page(6, '示範站') } } };
afterEach(() => vi.useRealTimers());

describe('public city context and provider data', () => {
  it('uses explicit known city names or earliest arrival without uploading trip text', () => {
    expect(suggestCity(trip, [])?.name).toBe('東京');
    const flights: Item[] = [{ id: 'b', tripId: trip.id, type: 'flight', title: '回程', date: '2026-11-12', start: '10:00', end: '', to: 'TPE' }, { id: 'a', tripId: trip.id, type: 'flight', title: '去程', date: trip.start, start: '06:00', end: '', to: 'KIX' }];
    expect(suggestCity({ ...trip, name: '私人旅程名稱' }, flights)?.name).toBe('大阪');
    expect(suggestCity({ ...trip, name: '私人旅程名稱' }, [])).toBeUndefined();
    expect(suggestCity(trip, [{ ...flights[0], tripId: 'other' }])?.name).toBe('東京');
    expect(parseCity({ ...tokyo, latitude: 200 })).toBeUndefined();
    expect(parseCity({ ...tokyo, timezone: 'invalid' })).toBeUndefined();
    expect(parseCity({ ...tokyo, latitude: null })).toBeUndefined();
  });
  it('keeps zero temperatures/rain and unknowns distinct and never manufactures travel dates', () => {
    const days = parseWeather(weather);
    expect(days[0]).toMatchObject({ code: 0, low: 0, rain: 0 });
    expect(days[1]).toMatchObject({ low: null, rain: 90 });
    expect(weatherLabel(0)).toBe('晴'); expect(weatherLabel(null)).toBe('未提供');
    expect(weatherWindow(days, trip)).toEqual({ travel: true, days: [days[1]] });
    expect(weatherWindow(days, { start: '2027-01-01', end: '2027-01-04' }).travel).toBe(false);
    expect(parseWeather({ daily: { time: ['2026-02-30', '2026-11-07'], temperature_2m_max: [14, '20'], precipitation_probability_max: [10, 130] } })).toEqual([{ date: '2026-11-07', code: null, low: null, high: null, rain: null }]);
    expect(() => parseWeather({ error: 'bad' })).toThrow();
  });
  it('classifies nearby stations and sights, deduplicates and drops unsafe or out-of-range pages', () => {
    const result = parseNearby(nearby, tokyo);
    expect(result.stations.map(p => p.title)).toEqual(['示範站']);
    expect(result.sights.map(p => p.title)).toEqual(['示範公園']);
    expect(distanceMeters(tokyo, tokyo)).toBe(0);
    expect(mapsLink(result.stations[0])).toContain('35.6895,139.69171');
    expect(parseNearby({ batchcomplete: '' }, tokyo)).toEqual({ stations: [], sights: [] });
    expect(() => parseNearby({ error: 'rate limit' }, tokyo)).toThrow();
    expect(transportSource(tokyo)?.label).toContain('JR 東日本');
    expect(transportSource({ ...tokyo, name: '大阪' })?.label).toContain('JR 西日本');
    expect(transportSource(seoul)?.url).toMatch(/^https:/);
  });
  it('returns city candidates for explicit choice and sends only the query to geocoding', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [{ ...tokyo, countryCode: undefined, country_code: 'JP' }, { ...tokyo, country_code: 'JP', latitude: null }] })));
    expect(await searchCities('東京', undefined, fetcher)).toEqual([tokyo]);
    const url = new URL(fetcher.mock.calls[0][0]);
    expect(url.searchParams.get('name')).toBe('東京');
    expect(url.href).not.toContain('私人');
    expect(fetcher.mock.calls[0][1]).toMatchObject({ credentials: 'omit', referrerPolicy: 'no-referrer' });
  });
});

describe('refresh, partial failure and offline cache', () => {
  const cached: TravelInfoData = { weather: { at: now - WEATHER_TTL, data: parseWeather(weather) }, nearby: { at: now - 1000, data: parseNearby(nearby, tokyo) } };
  it('only refreshes stale providers and does not reset the untouched provider timestamp', async () => {
    vi.setSystemTime(now);
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(weather)));
    const result = await refreshInfo(tokyo, cached, { now, fetcher });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(new URL(fetcher.mock.calls[0][0]).hostname).toBe('api.open-meteo.com');
    expect(result.weather?.at).toBe(now); expect(result.nearby).toEqual(cached.nearby);
    expect(stale(now, WEATHER_TTL, now)).toBe(false); expect(stale(now + 1, WEATHER_TTL, now)).toBe(true);
  });
  it('keeps old weather and its timestamp when weather fails but nearby succeeds', async () => {
    vi.setSystemTime(now);
    const fetcher = vi.fn(async (url: string | URL | Request) => String(url).includes('open-meteo') ? new Response('rate limit', { status: 429 }) : new Response(JSON.stringify(nearby)));
    const result = await refreshInfo(tokyo, cached, { now, force: true, fetcher });
    expect(result.weather).toEqual(cached.weather); expect(result.weatherError).toBeTruthy();
    expect(result.nearby?.at).toBe(now); expect(result.nearbyError).toBeUndefined();
    const allFail = await refreshInfo(tokyo, cached, { now, force: true, fetcher: vi.fn().mockRejectedValue(new TypeError('offline')) });
    expect(allFail.weather).toEqual(cached.weather); expect(allFail.nearby).toEqual(cached.nearby);
    expect(allFail.weatherError).toBeTruthy(); expect(allFail.nearbyError).toBeTruthy();
  });
  it('does not return obsolete data after cancellation', async () => {
    const controller = new AbortController(); controller.abort();
    await expect(refreshInfo(tokyo, cached, { force: true, signal: controller.signal, fetcher: vi.fn().mockRejectedValue(new DOMException('abort', 'AbortError')) })).rejects.toThrow();
  });
  it('persists only successful snapshots, separates cities and tolerates corrupted or unavailable storage', () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => { values.set(key, value); } };
    expect(saveInfo(tokyo, { ...cached, weatherError: '失敗' }, storage)).toBe(true);
    expect(readInfo(tokyo, storage, now)).toEqual(cached);
    expect(storage.getItem(cacheKey(tokyo))).not.toContain('失敗');
    expect(readInfo(seoul, storage, now)).toEqual({});
    values.set(cacheKey(tokyo), '{broken'); expect(readInfo(tokyo, storage, now)).toEqual({});
    values.set(cacheKey(tokyo), JSON.stringify({ version: 1, city: cityKey(tokyo), weather: { at: now + 100, data: cached.weather!.data } }));
    expect(readInfo(tokyo, storage, now)).toEqual({});
    expect(saveInfo(tokyo, cached, { setItem() { throw new Error('quota'); } })).toBe(false);
    expect(readInfo(tokyo, { getItem() { throw new Error('blocked'); } }, now)).toEqual({});
  });
});
