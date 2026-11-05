import { describe, it, expect } from 'vitest';
import { dueInfo } from './checklist';

describe('dueInfo', () => {
  it('counts from the trip start date', () => {
    expect(dueInfo({ start: '2026-11-20', daysBefore: 12, today: '2026-11-05' })).toEqual({ text: '要在 11/08 前完成（還剩 3 天）', urgent: true, overdue: false });
  });
  it('is not urgent with more than 3 days left', () => {
    expect(dueInfo({ start: '2026-11-20', daysBefore: 5, today: '2026-11-05' }).urgent).toBe(false);
  });
  it('due today', () => {
    expect(dueInfo({ start: '2026-11-20', daysBefore: 15, today: '2026-11-05' }).text).toBe('今天要完成（11/05）');
  });
  it('overdue', () => {
    expect(dueInfo({ start: '2026-11-20', daysBefore: 16, today: '2026-11-05' })).toEqual({ text: '已超過期限 11/04', urgent: true, overdue: true });
  });
  it('departure day', () => {
    expect(dueInfo({ start: '2026-11-20', daysBefore: 0, today: '2026-11-05' }).text).toBe('出發當天（11/20）');
  });
});
