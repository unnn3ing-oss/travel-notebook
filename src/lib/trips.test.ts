import { describe, it, expect } from 'vitest';
import { upcomingTrips } from './trips';
import type { Trip } from '../types';
const trip = (id:string,start:string,end:string):Trip => ({id,name:id,start,end,people:2,currency:'JPY'});
describe('welcome trip entries', () => {
  it('excludes completed travel, includes ongoing and future travel in departure order without mutating stored order', () => {
    const stored=[trip('later','2026-12-01','2026-12-05'),trip('past','2026-10-01','2026-10-05'),trip('next','2026-11-20','2026-11-24'),trip('ongoing','2026-11-01','2026-11-05')];
    expect(upcomingTrips(stored,'2026-11-05').map(t=>t.id)).toEqual(['ongoing','next','later']);
    expect(stored[0].id).toBe('later');
  });
  it('has no highlighted entry when there are no active or future trips', () => {
    expect(upcomingTrips([], '2026-11-05')).toEqual([]);
    expect(upcomingTrips([trip('past','2026-10-01','2026-10-05')],'2026-11-05')).toEqual([]);
  });
});
