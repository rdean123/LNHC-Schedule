/**
 * Dates are plain 'YYYY-MM-DD' strings. They are parsed as UTC so the weekday never shifts
 * with the viewer's time zone.
 */
export function isSunday(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && new Date(`${date}T00:00:00Z`).getUTCDay() === 0;
}

/** All Sundays in a month, as 'YYYY-MM-DD'. `month` is 1-12. */
export function sundaysInMonth(year: number, month: number): string[] {
  const result: string[] = [];
  const cursor = new Date(Date.UTC(year, month - 1, 1));
  while (cursor.getUTCMonth() === month - 1) {
    if (cursor.getUTCDay() === 0) result.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}
