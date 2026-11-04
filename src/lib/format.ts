/**
 * Dates are plain 'YYYY-MM-DD' strings and are always handled as UTC calendar dates so the
 * weekday and day number never shift with a viewer's time zone. "Today" is the date in the
 * church's own time zone.
 */
export const CHURCH_TIME_ZONE = 'Asia/Manila';

const DAY_MS = 86_400_000;

export function parseIso(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' for today in the church's time zone. */
export function todayIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: CHURCH_TIME_ZONE }).format(now);
}

export function addDays(iso: string, days: number): string {
  return toIso(new Date(parseIso(iso).getTime() + days * DAY_MS));
}

export function daysBetween(fromIso: string, toIsoDate: string): number {
  return Math.round((parseIso(toIsoDate).getTime() - parseIso(fromIso).getTime()) / DAY_MS);
}

const fmt = (iso: string, options: Intl.DateTimeFormatOptions) =>
  parseIso(iso).toLocaleDateString('en-US', { ...options, timeZone: 'UTC' });

/** "Sunday, November 15" */
export const formatLongDate = (iso: string) =>
  fmt(iso, { weekday: 'long', month: 'long', day: 'numeric' });

/** "November 15" */
export const formatMonthDay = (iso: string) => fmt(iso, { month: 'long', day: 'numeric' });

/** "Nov 15" */
export const formatShortDate = (iso: string) => fmt(iso, { month: 'short', day: 'numeric' });

/** "Nov 1, 2026" */
export const formatFullDate = (iso: string) =>
  fmt(iso, { month: 'short', day: 'numeric', year: 'numeric' });

/** "in 11 days", "tomorrow", "today" */
export function relativeDays(fromIso: string, toIsoDate: string): string {
  const n = daysBetween(fromIso, toIsoDate);
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  return `in ${n} days`;
}

// ---- Months, as 'YYYY-MM' ----

export const currentMonth = (today: string = todayIso()) => today.slice(0, 7);

export function monthTitle(month: string): string {
  return fmt(`${month}-01`, { month: 'long', year: 'numeric' });
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  return toIso(date).slice(0, 7);
}

export function monthRange(month: string): { from: string; to: string } {
  const from = `${month}-01`;
  const to = addDays(`${shiftMonth(month, 1)}-01`, -1);
  return { from, to };
}

export function isValidMonth(value: string | null | undefined): value is string {
  return !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** All Sundays in a month, as 'YYYY-MM-DD'. */
export function sundaysOfMonth(month: string): string[] {
  const { from, to } = monthRange(month);
  const result: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (parseIso(d).getUTCDay() === 0) result.push(d);
  }
  return result;
}

/** The next `count` Sundays on or after `from`. */
export function nextSundays(from: string, count: number): string[] {
  let d = from;
  while (parseIso(d).getUTCDay() !== 0) d = addDays(d, 1);
  return Array.from({ length: count }, (_, i) => addDays(d, i * 7));
}
