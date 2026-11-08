import { describe, it, expect } from 'vitest';
import type { Leg, Route } from '../types';
import { deriveDepartures, legOptions, legTimesError, minutesBetween, withDerivedDepartures } from './legs';

const route = (legs: Leg[], departures: Route['departures'] = []): Route => ({ id: 'r', itemId: 'i', name: '成田到新宿', mode: 'train', minutes: 0, walk: 0, place: '', legs, departures, fare: 0, primary: true });
const narita: Leg = { mode: 'train', label: '成田特快 往日暮里', minutes: 40, dep: '10:30', arr: '11:10', alts: [{ dep: '11:00', arr: '11:40', info: '下一班' }, { dep: '10:00', arr: '10:40' }] };
const yamanote: Leg = { mode: 'train', label: 'JR 山手線 往新宿', minutes: 15, dep: '11:20', arr: '11:35', alts: [{ dep: '11:30', arr: '11:45' }, { dep: '11:50', arr: '12:05' }] };

describe('legOptions', () => {
  it('lists main and backup departures sorted by departure', () => {
    expect(legOptions(narita).map((o) => o.dep)).toEqual(['10:00', '10:30', '11:00']);
  });
  it('ignores a leg with no times', () => {
    expect(legOptions({ mode: 'walk', label: '步行', minutes: 5 })).toEqual([]);
  });
});

describe('minutesBetween', () => {
  it('derives minutes only when both times are valid and ordered', () => {
    expect(minutesBetween('10:30', '11:10')).toBe(40);
    expect(minutesBetween('10:30', undefined)).toBeUndefined();
    expect(minutesBetween('11:10', '10:30')).toBeUndefined();
  });
});

describe('legTimesError', () => {
  it('accepts empty and valid times', () => {
    expect(legTimesError({ mode: 'walk', label: 'x', minutes: 3 })).toBe('');
    expect(legTimesError(narita)).toBe('');
  });
  it('requires both times and arrival after departure', () => {
    expect(legTimesError({ ...narita, arr: undefined })).toMatch(/同時填/);
    expect(legTimesError({ ...narita, arr: '10:30' })).toMatch(/晚於/);
  });
  it('checks backup departures with their number', () => {
    expect(legTimesError({ ...narita, alts: [{ dep: '11:00', arr: '10:50' }] })).toMatch(/^備案 1/);
    expect(legTimesError({ ...narita, alts: [{ dep: '', arr: '' }] })).toMatch(/^備案 1/);
  });
});

describe('deriveDepartures', () => {
  it('chains later legs to the earliest connection that is not before arrival', () => {
    const d = deriveDepartures(route([narita, yamanote]))!;
    expect(d).toEqual([
      { dep: '10:00', arr: '11:35', info: '成田特快 往日暮里' }, // 10:40 到，搭 11:20 山手線
      { dep: '10:30', arr: '11:35', info: '成田特快 往日暮里' }, // 11:10 到，搭 11:20 山手線
      { dep: '11:00', arr: '12:05', info: '成田特快 往日暮里，下一班' }, // 11:40 到，11:30 已過，改搭 11:50
    ]);
  });
  it('drops a departure that cannot connect to a later timed leg', () => {
    const last: Leg = { ...yamanote, alts: [] }; // 只剩 11:20
    const d = deriveDepartures(route([narita, last]))!;
    expect(d.map((x) => x.dep)).toEqual(['10:00', '10:30']);
  });
  it('adds minutes for later legs without times', () => {
    const d = deriveDepartures(route([narita, { mode: 'walk', label: '步行到新宿站', minutes: 8 }]))!;
    expect(d[1]).toMatchObject({ dep: '10:30', arr: '11:18' });
  });
  it('returns null when the first ride has no times so manual departures stay', () => {
    const r = route([{ mode: 'train', label: 'A', minutes: 10 }, yamanote], [{ dep: '09:00', arr: '09:20', info: '手動' }]);
    expect(deriveDepartures(r)).toBeNull();
    expect(withDerivedDepartures(r).departures).toEqual([{ dep: '09:00', arr: '09:20', info: '手動' }]);
  });
  it('skips a leading walk and a walk-only route', () => {
    expect(deriveDepartures(route([{ mode: 'walk', label: '走', minutes: 5 }, narita]))![0].dep).toBe('10:00');
    expect(deriveDepartures(route([{ mode: 'walk', label: '走', minutes: 5 }]))).toBeNull();
  });
});
