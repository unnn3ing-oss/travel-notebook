import { describe, expect, it } from 'vitest';
import { seedKyoto } from '../seed';
import { buildReminders, DEFAULT_RULES, isOn } from './reminders';

const s = seedKyoto();
describe('buildReminders', () => {
  const list = buildReminders(s.items, s.routes, DEFAULT_RULES, '2026-11-21');
  it('walking transit leaves at the card start', () => {
    const r = list.find((x) => x.id === 't-b2')!;
    expect(r.time).toBe('09:50');
    expect(r.text).toBe('出發去二年坂');
  });
  it('train transit subtracts the walk to the platform', () => {
    const r = list.find((x) => x.id === 't-b5')!;
    expect(r.time).toBe('13:37');
    expect(r.why).toBe('交通：前往32 號月台需要 5 分鐘，搭 13:42 那班');
  });
  it('item reminder uses the lead time and flags unbooked', () => {
    const r = list.find((x) => x.id === 'i-b6')!;
    expect(r.time).toBe('14:30');
    expect(r.warn).toBe(true);
    expect(r.why).toBe('門票：還沒訂，有 2 個備案');
  });
  it('drops past days and respects the transit switch', () => {
    expect(list.every((r) => r.date >= '2026-11-21')).toBe(true);
    expect(isOn(list.find((x) => x.id === 't-b2')!, { ...DEFAULT_RULES, transitOn: false })).toBe(false);
  });
});
