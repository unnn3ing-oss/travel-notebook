import { describe, it, expect } from 'vitest';
import { judgeDepartures, leaveNote } from './transit';

const deps = [
  { dep: '13:42', arr: '13:58', info: '普通車，32 號月台' },
  { dep: '13:52', arr: '14:08', info: '普通車，32 號月台' },
  { dep: '14:07', arr: '14:23', info: '快速，32 號月台' },
  { dep: '14:38', arr: '14:54', info: '普通車，33 號月台' },
];

describe('judgeDepartures', () => {
  const j = judgeDepartures({ now: '13:44', walk: 5, arriveBy: '14:50', departures: deps });

  it('marks a departed vehicle as gone', () => {
    expect(j[0]).toMatchObject({ kind: 'gone', status: '已開走', leave: '13:37' });
  });
  it('under 10 minutes of slack asks you to time it', () => {
    expect(j[1]).toMatchObject({ kind: 'hurry', status: '剩下 3 分鐘，要抓準時間出發了！', leave: '13:47' });
  });
  it('10+ minutes of slack lets you get ready', () => {
    expect(j[2]).toMatchObject({ kind: 'ok', status: '還有 18 分鐘可以準備出發了！' });
  });
  it('arrival after the deadline may be too late', () => {
    expect(j[3]).toMatchObject({ kind: 'late', status: '14:54 才到，可能會太晚' });
  });
  it('exactly 10 minutes counts as enough time', () => {
    const [x] = judgeDepartures({ now: '13:00', walk: 0, arriveBy: '', departures: [{ dep: '13:10', arr: '13:30', info: '' }] });
    expect(x.status).toBe('還有 10 分鐘可以準備出發了！');
  });
  it('zero slack means leave now', () => {
    const [x] = judgeDepartures({ now: '13:05', walk: 5, arriveBy: '', departures: [{ dep: '13:10', arr: '13:30', info: '' }] });
    expect(x).toMatchObject({ kind: 'hurry', status: '現在出發' });
  });
  it('vehicle not yet gone but walking takes too long', () => {
    const [x] = judgeDepartures({ now: '13:08', walk: 5, arriveBy: '', departures: [{ dep: '13:10', arr: '13:30', info: '' }] });
    expect(x).toMatchObject({ kind: 'miss', status: '走過去來不及' });
  });
});

describe('leaveNote', () => {
  it('describes walking to the boarding place', () => {
    expect(leaveNote({ place: '32 號月台', walk: 5, leave: '13:47', dep: '13:52' })).toBe('前往 32 號月台需要 5 分鐘，最好在 13:47 就出發。');
  });
  it('handles pick-up places with no walk', () => {
    expect(leaveNote({ place: '八條口上車處', walk: 0, leave: '13:45', dep: '13:45' })).toBe('最好在 13:45 前到八條口上車處。');
  });
  it('handles routes without a place', () => {
    expect(leaveNote({ place: '', walk: 0, leave: '14:00', dep: '14:00' })).toBe('這條路線沒有填步行時間，請在 14:00 前到站。');
  });
});
