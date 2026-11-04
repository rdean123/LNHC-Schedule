import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { toPdfTable } from '../../src/lib/pdf.ts';
import { buildRoster, isServing, myPositions } from '../../src/lib/roster.ts';
import type { RosterService } from '../../src/lib/roster.ts';

const columns = [
  { positionId: 'p-song', label: 'Song Leader' },
  { positionId: 'p-back', label: 'Back Up' },
  { positionId: 'p-acoustic', label: 'Acoustic' },
];

const service: RosterService = {
  id: 's1',
  service_date: '2026-11-08',
  status: 'published',
  assignments: [
    {
      id: 'a1',
      position_id: 'p-song',
      volunteer_id: 'v-denver',
      volunteers: { display_name: 'Denver' },
    },
    {
      id: 'a2',
      position_id: 'p-back',
      volunteer_id: 'v-mara',
      volunteers: { display_name: 'Mara' },
    },
    { id: 'a3', position_id: 'p-back', volunteer_id: 'v-abe', volunteers: { display_name: 'Abe' } },
  ],
};

describe('roster', () => {
  test('one row per Sunday with every position in the venue’s order', () => {
    const rows = buildRoster(columns, [service]);
    assert.equal(rows.length, 1);
    assert.deepEqual(
      rows[0].cells.map((c) => c.label),
      ['Song Leader', 'Back Up', 'Acoustic'],
    );
  });

  test('several people share a position and are listed by name', () => {
    const [row] = buildRoster(columns, [service]);
    assert.deepEqual(
      row.cells[1].people.map((p) => p.name),
      ['Abe', 'Mara'],
    );
  });

  test('an optional position can stay empty', () => {
    const [row] = buildRoster(columns, [service]);
    assert.equal(row.cells[2].people.length, 0);
  });

  test('with a list of Sundays, Sundays without a schedule still get a row', () => {
    const rows = buildRoster(columns, [service], ['2026-11-01', '2026-11-08']);
    assert.equal(rows[0].serviceId, null);
    assert.equal(rows[0].status, null);
    assert.equal(rows[1].serviceId, 's1');
  });

  test('knows when a volunteer serves and in what position', () => {
    const [row] = buildRoster(columns, [service]);
    assert.equal(isServing(row, 'v-mara'), true);
    assert.equal(isServing(row, 'v-nobody'), false);
    assert.equal(isServing(row, null), false);
    assert.deepEqual(myPositions(row, 'v-mara'), ['Back Up']);
  });
});

describe('PDF table', () => {
  test('matches the printed roster: day number, then names joined with a slash, empty cells blank', () => {
    const rows = buildRoster(columns, [service]);
    const table = toPdfTable(
      columns.map((c) => c.label),
      rows,
    );
    assert.deepEqual(table.head, ['Date', 'Song Leader', 'Back Up', 'Acoustic']);
    assert.deepEqual(table.body, [['8', 'Denver', 'Abe/Mara', '']]);
  });
});
