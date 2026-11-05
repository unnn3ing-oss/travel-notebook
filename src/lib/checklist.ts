import { addDays, daysBetween, md } from './time';

/** Deadline copy for a prep task due `daysBefore` days before the trip starts. */
export function dueInfo(o: { start: string; daysBefore: number; today: string }) {
  const due = addDays(o.start, -o.daysBefore);
  const left = daysBetween(o.today, due);
  if (o.daysBefore === 0) return { text: '出發當天（' + md(due) + '）', urgent: left <= 3, overdue: left < 0 };
  if (left < 0) return { text: '已超過期限 ' + md(due), urgent: true, overdue: true };
  if (left === 0) return { text: '今天要完成（' + md(due) + '）', urgent: true, overdue: false };
  return { text: '要在 ' + md(due) + ' 前完成（還剩 ' + left + ' 天）', urgent: left <= 3, overdue: false };
}
