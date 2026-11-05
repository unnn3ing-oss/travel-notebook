import { describe, it, expect } from 'vitest';
import { splitDay, overlaps } from './day';
import { seedKyoto } from '../seed';

const day = seedKyoto().items.filter((i) => i.date === '2026-11-21');

describe('splitDay', () => {
  it('finds the current and next card', () => {
    const s = splitDay(day, '09:00');
    expect(s.current?.title).toBe('清水寺');
    expect(s.next?.title).toBe('清水寺 → 二年坂');
    expect(s.later.map((i) => i.id)).toEqual(['b3', 'b4', 'b5', 'b6']);
  });
  it('between cards there is no current', () => {
    const s = splitDay(day, '12:42');
    expect(s.current).toBeNull();
    expect(s.next?.title).toBe('午餐　祇園割烹');
    expect(splitDay(day, '12:45').current).toBeNull();
  });
  it('after the last card nothing is next', () => {
    const s = splitDay(day, '22:00');
    expect(s.current).toBeNull();
    expect(s.next).toBeNull();
    expect(s.done).toHaveLength(6);
  });
});

describe('overlaps', () => {
  it('flags a card that starts before the previous ends', () => {
    const items = [
      { ...day[0], id: 'x', start: '10:00', end: '11:00' },
      { ...day[1], id: 'y', start: '10:45', end: '11:30' },
    ];
    expect([...overlaps(items)]).toEqual(['y']);
  });
  it('sample day has no overlaps', () => {
    expect(overlaps(day).size).toBe(0);
  });
});
