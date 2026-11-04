import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  addDays,
  daysBetween,
  formatLongDate,
  formatShortDate,
  isValidMonth,
  monthRange,
  monthTitle,
  nextSundays,
  relativeDays,
  shiftMonth,
  sundaysOfMonth,
  todayIso,
} from '../../src/lib/format.ts';

describe('dates', () => {
  test('format as the church reads them, regardless of time zone', () => {
    assert.equal(formatLongDate('2026-11-15'), 'Sunday, November 15');
    assert.equal(formatShortDate('2026-11-08'), 'Nov 8');
    assert.equal(monthTitle('2026-11'), 'November 2026');
  });

  test('today follows the church’s time zone, not the viewer’s', () => {
    // 5pm UTC on Nov 4 is already 1am on Nov 5 in Manila.
    assert.equal(todayIso(new Date('2026-11-04T17:00:00Z')), '2026-11-05');
    assert.equal(todayIso(new Date('2026-11-04T10:00:00Z')), '2026-11-04');
  });

  test('add days and count between them across month ends', () => {
    assert.equal(addDays('2026-11-29', 7), '2026-12-06');
    assert.equal(addDays('2026-03-01', -1), '2026-02-28');
    assert.equal(daysBetween('2026-11-04', '2026-11-15'), 11);
  });

  test('relative wording', () => {
    assert.equal(relativeDays('2026-11-04', '2026-11-04'), 'today');
    assert.equal(relativeDays('2026-11-04', '2026-11-05'), 'tomorrow');
    assert.equal(relativeDays('2026-11-04', '2026-11-15'), 'in 11 days');
  });
});

describe('months', () => {
  test('shift across a year boundary', () => {
    assert.equal(shiftMonth('2026-12', 1), '2027-01');
    assert.equal(shiftMonth('2027-01', -1), '2026-12');
  });

  test('range covers the whole month', () => {
    assert.deepEqual(monthRange('2026-02'), { from: '2026-02-01', to: '2026-02-28' });
    assert.deepEqual(monthRange('2028-02'), { from: '2028-02-01', to: '2028-02-29' });
  });

  test('Sundays of a month match the church’s printed schedules', () => {
    assert.deepEqual(sundaysOfMonth('2026-11'), [
      '2026-11-01',
      '2026-11-08',
      '2026-11-15',
      '2026-11-22',
      '2026-11-29',
    ]);
    assert.deepEqual(sundaysOfMonth('2026-12'), [
      '2026-12-06',
      '2026-12-13',
      '2026-12-20',
      '2026-12-27',
    ]);
    assert.deepEqual(sundaysOfMonth('2027-01'), [
      '2027-01-03',
      '2027-01-10',
      '2027-01-17',
      '2027-01-24',
      '2027-01-31',
    ]);
  });

  test('the next Sundays include today when it is a Sunday', () => {
    assert.deepEqual(nextSundays('2026-11-04', 3), ['2026-11-08', '2026-11-15', '2026-11-22']);
    assert.deepEqual(nextSundays('2026-11-08', 2), ['2026-11-08', '2026-11-15']);
  });

  test('month values from the address are validated', () => {
    assert.equal(isValidMonth('2026-11'), true);
    assert.equal(isValidMonth('2026-13'), false);
    assert.equal(isValidMonth('nonsense'), false);
    assert.equal(isValidMonth(null), false);
  });
});
