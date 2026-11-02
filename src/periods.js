import { toISO, todayISO } from './format.js';

export const PERIODS = [
  { key: 'week', label: '7 days' },
  { key: 'month', label: 'This month' },
  { key: '3m', label: '3 months' },
  { key: 'custom', label: 'Custom' },
];

export function rangeForPeriod(period, customStart, customEnd) {
  const today = new Date();
  if (period === 'today') {
    const iso = todayISO();
    return { start: iso, end: iso };
  }
  if (period === 'week') {
    // Rolling 7 days: today and the 6 before it.
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    return { start: toISO(start), end: todayISO() };
  }
  if (period === 'month') {
    return { start: toISO(new Date(today.getFullYear(), today.getMonth(), 1)), end: todayISO() };
  }
  if (period === '3m') {
    return { start: toISO(new Date(today.getFullYear(), today.getMonth() - 2, 1)), end: todayISO() };
  }
  if (period === 'custom') {
    let start = customStart || todayISO();
    let end = customEnd || todayISO();
    if (start > end) [start, end] = [end, start];
    return { start, end };
  }
  return { start: todayISO(), end: todayISO() };
}

export function filterByRange(entries, start, end) {
  return entries.filter((e) => e.date >= start && e.date <= end);
}

export function daysInRange(start, end) {
  return Math.round((new Date(end + 'T00:00:00') - new Date(start + 'T00:00:00')) / 86400000) + 1;
}

// The preceding range of the same shape, for "12% lower than last month".
// "This month" is compared day-for-day (1st..today vs 1st..same day last
// month) so a mid-month check is fair.
export function previousRangeFor(periodKey, start, end) {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  if (periodKey === 'month') {
    const prevMonthStart = new Date(s.getFullYear(), s.getMonth() - 1, 1);
    const daysInPrevMonth = new Date(s.getFullYear(), s.getMonth(), 0).getDate();
    const prevMonthEnd = new Date(prevMonthStart.getFullYear(), prevMonthStart.getMonth(), Math.min(e.getDate(), daysInPrevMonth));
    return { start: toISO(prevMonthStart), end: toISO(prevMonthEnd), label: 'the same days last month' };
  }
  if (periodKey === '3m') {
    const ps = new Date(s.getFullYear(), s.getMonth() - 3, 1);
    const pe = new Date(s.getFullYear(), s.getMonth(), 0);
    return { start: toISO(ps), end: toISO(pe), label: 'the 3 months before' };
  }
  const length = daysInRange(start, end);
  const prevEnd = new Date(s);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - (length - 1));
  return { start: toISO(prevStart), end: toISO(prevEnd), label: periodKey === 'week' ? 'the 7 days before' : 'the previous period' };
}
