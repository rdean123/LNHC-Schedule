/**
 * PREVIEW MODE ONLY (npm run demo). An in-memory stand-in for the Supabase backend,
 * seeded with the church's real November and December rosters, so the screens can be viewed
 * and tested without a hosted project. Nothing is saved; a reload resets everything.
 *
 * The rules here imitate the database's (see SCHEDULING_RULES.md) so the screens show the same
 * messages. The real rules live in supabase/migrations; this file is not used in production.
 */

import type {
  AnnouncementRow,
  AppRole,
  AssignmentRow,
  AvailabilityRow,
  PositionRow,
  ServiceRow,
  VenuePositionRow,
  VenueRow,
  VolunteerRow,
} from '../types/database';

export type Contact = { full_name: string | null; email: string | null; phone: string | null };
export type HistoryRow = {
  changed_at: string;
  action: 'added' | 'removed' | 'changed';
  actor_name: string;
  volunteer_name: string;
  position_name: string;
  service_id: string;
};
export type LogRow = { id: number; when: string; actor: string; summary: string };
let logCounter = 1;

const NOW = new Date().toISOString();
let counter = 1;
export const uid = (prefix: string) => `${prefix}-${counter++}`;

export const ADMIN_USER_ID = 'user-admin';
export const RDEN_USER_ID = 'user-rden';

// ---- Reference data ---------------------------------------------------------------------------

const venueNames = ['LNHC', 'Tangway', 'Garcia/Rosario'];
const positionNames = [
  'Song Leader',
  'Back Up',
  'Lead Guitarist',
  'Acoustic',
  'Bass Guitarist',
  'Keyboard',
  'Drummer',
  'Sound Tech',
  'Easy Worship',
  'Musician',
  'Multimedia',
  'Singer',
];

export const venues: VenueRow[] = venueNames.map((name, i) => ({
  id: `venue-${i + 1}`,
  name,
  address: i === 0 ? 'Altamirano St., Mataas na Lupa, Lipa City' : null,
  sort_order: i + 1,
  is_active: true,
  created_at: NOW,
  updated_at: NOW,
}));

export const positions: PositionRow[] = positionNames.map((name, i) => ({
  id: `pos-${i + 1}`,
  ministry_id: 'ministry-1',
  name,
  sort_order: i + 1,
  is_active: true,
  created_at: NOW,
  updated_at: NOW,
}));

export const posId = (name: string) => positions.find((p) => p.name === name)!.id;
export const venueId = (name: string) => venues.find((v) => v.name === name)!.id;

const layout: Record<string, [string, string | null][]> = {
  LNHC: positionNames.slice(0, 9).map((n) => [n, null]),
  Tangway: [
    ['Song Leader', null],
    ['Musician', null],
    ['Multimedia', null],
    ['Sound Tech', null],
  ],
  'Garcia/Rosario': [
    ['Singer', null],
    ['Musician', 'Musicians'],
  ],
};

export const venuePositionsData: VenuePositionRow[] = Object.entries(layout).flatMap(
  ([venue, cols]) =>
    cols.map(([name, label], i) => ({
      venue_id: venueId(venue),
      position_id: posId(name),
      label,
      sort_order: i + 1,
    })),
);

// ---- The church's real rosters (from the schedule images) -------------------------------------

type Row = [string, ...string[][]];
const LNHC_COLS = positionNames.slice(0, 9);
const lnhcRows: Row[] = [
  [
    '2026-11-01',
    ['Sica'],
    ['Cyril', 'Moises'],
    ['Rden'],
    ['Denver'],
    ['Ferl'],
    ['David'],
    ['Ves', 'Miggy'],
    ['Airon'],
    ['Shay'],
  ],
  [
    '2026-11-08',
    ['Denver'],
    ['Mara', 'Abe'],
    ['Natan'],
    [],
    ['Ferl'],
    ['Sica'],
    ['Jireh', 'Miggy'],
    ['Airon'],
    ['Oba'],
  ],
  [
    '2026-11-15',
    ['Cyril'],
    ['Mara', 'Moises'],
    ['Rden'],
    ['Denver'],
    ['Ferl'],
    ['David'],
    ['Jireh', 'Miggy'],
    ['Kris'],
    ['Oba'],
  ],
  [
    '2026-11-22',
    ['Noemi'],
    ['Abe', 'Natan'],
    ['Rden'],
    [],
    ['Denver'],
    ['Sica'],
    ['Jireh', 'Miggy'],
    ['Kris'],
    ['Jam'],
  ],
  [
    '2026-11-29',
    ['Mara'],
    ['Natan', 'Sica'],
    ['Rden'],
    ['Ferl'],
    ['Jonas'],
    ['David'],
    ['Jireh', 'Miggy'],
    ['Airon'],
    ['Shay'],
  ],
  [
    '2026-12-06',
    ['Ever'],
    ['Denver', 'Cyril'],
    ['Rden'],
    ['Natan'],
    ['Ferl'],
    ['Sica'],
    ['Jireh', 'Miggy'],
    ['Kris'],
    ['Jam'],
  ],
  [
    '2026-12-13',
    ['Cyril'],
    ['Noemi', 'Sica'],
    ['Rden'],
    [],
    ['Ferl'],
    ['David'],
    ['Jireh', 'Gab'],
    ['Airon'],
    ['Shay', 'Krisia'],
  ],
  [
    '2026-12-20',
    ['Denver'],
    ['Abe', 'Ever'],
    ['Rden'],
    [],
    ['Natan'],
    ['Sica'],
    ['Ves', 'Miggy'],
    ['Kris'],
    ['Jam'],
  ],
  [
    '2026-12-27',
    ['Sica'],
    ['Cyril', 'Natan'],
    ['Jonas'],
    ['Denver'],
    ['Ferl'],
    ['David'],
    ['Ves', 'Gab'],
    ['Airon'],
    ['Shay', 'Krisia'],
  ],
];
const TANGWAY_COLS = ['Song Leader', 'Musician', 'Multimedia', 'Sound Tech'];
const tangwayRows: Row[] = [
  ['2026-09-13', ['Krysia'], ['Jireh'], ['Malou'], ['Airon']],
  ['2026-09-20', ['Joshua'], ['Sica'], ['Shay'], ['Airon']],
  ['2026-09-27', ['Kobe'], ['David'], ['Malou'], ['Airon']],
  ['2026-10-11', ['Krysia'], ['Jireh'], ['Malou'], ['Airon']],
  ['2026-10-18', ['Kobe'], ['Joshua'], ['Malou'], ['David']],
];
const GR_COLS = ['Singer', 'Musician'];
const grRows: Row[] = [
  ['2026-09-13', ['Rachel'], ['Jonas']],
  ['2026-09-20', ['Rachel'], ['Moises']],
  ['2026-09-27', ['Rachel'], ['Natan']],
  ['2026-10-11', ['Rachel'], ['Jonas']],
  ['2026-10-18', ['Rachel'], ['Natan']],
];

// ---- Build state ------------------------------------------------------------------------------

export const volunteers: VolunteerRow[] = [];
export const contacts = new Map<string, Contact>();
export const qualifications = new Set<string>(); // `${volunteerId}|${positionId}`
export const services: ServiceRow[] = [];
export const assignments: AssignmentRow[] = [];
export const availability: AvailabilityRow[] = [];
export const announcements: AnnouncementRow[] = [];
export const roles = new Map<string, AppRole>([
  [ADMIN_USER_ID, 'admin'],
  [RDEN_USER_ID, 'volunteer'],
]);
export const history: HistoryRow[] = [];
export const log: LogRow[] = [];

export const volunteerByName = (name: string) => volunteers.find((v) => v.display_name === name);

function ensureVolunteer(name: string): VolunteerRow {
  let v = volunteerByName(name);
  if (!v) {
    v = {
      id: uid('vol'),
      display_name: name,
      user_id: name === 'Rden' ? RDEN_USER_ID : null,
      is_active: true,
      created_at: NOW,
      updated_at: NOW,
    };
    volunteers.push(v);
    const lower = name.toLowerCase();
    contacts.set(v.id, {
      full_name: null,
      email: ['Rden', 'Sica', 'Denver', 'Oba', 'Jonas'].includes(name)
        ? `${lower}@lnhc.example`
        : null,
      phone: null,
    });
  }
  return v;
}

function ensureService(venue: string, date: string, status: 'draft' | 'published'): ServiceRow {
  let s = services.find((x) => x.venue_id === venueId(venue) && x.service_date === date);
  if (!s) {
    s = {
      id: uid('svc'),
      venue_id: venueId(venue),
      service_date: date,
      status,
      published_at: status === 'published' ? NOW : null,
      published_by: status === 'published' ? ADMIN_USER_ID : null,
      note: null,
      created_at: NOW,
      updated_at: NOW,
    };
    services.push(s);
  }
  return s;
}

function seedRoster(venue: string, cols: string[], rows: Row[], status: 'draft' | 'published') {
  for (const [date, ...cells] of rows) {
    const service = ensureService(venue, date, status);
    cells.forEach((people, i) => {
      for (const name of people) {
        const v = ensureVolunteer(name);
        qualifications.add(`${v.id}|${posId(cols[i])}`);
        assignments.push({
          id: uid('asg'),
          service_id: service.id,
          service_date: date,
          position_id: posId(cols[i]),
          volunteer_id: v.id,
          created_at: NOW,
          created_by: ADMIN_USER_ID,
        });
      }
    });
  }
}

seedRoster('LNHC', LNHC_COLS, lnhcRows, 'published');
seedRoster('Tangway', TANGWAY_COLS, tangwayRows, 'published');
seedRoster('Garcia/Rosario', GR_COLS, grRows, 'published');

// A January draft copied from November, with one deliberate problem: Moises is Away on Jan 17.
const nov = lnhcRows.slice(0, 5);
const janDates = ['2027-01-03', '2027-01-10', '2027-01-17', '2027-01-24', '2027-01-31'];
seedRoster(
  'LNHC',
  LNHC_COLS,
  nov.map(([, ...cells], i): Row => [janDates[i], ...cells]),
  'draft',
);

const away = (name: string, date: string, note: string | null = null) =>
  availability.push({
    volunteer_id: volunteerByName(name)!.id,
    service_date: date,
    is_available: false,
    note,
    updated_at: NOW,
  });
const yes = (name: string, date: string) =>
  availability.push({
    volunteer_id: volunteerByName(name)!.id,
    service_date: date,
    is_available: true,
    note: null,
    updated_at: NOW,
  });
away('Moises', '2027-01-17', 'Away that weekend');
away('Sica', '2027-01-17');
yes('Sica', '2027-01-03');
yes('Sica', '2027-01-10');
yes('Denver', '2027-01-03');

// Qualified but not yet used: gives the suggestion panel a realistic choice.
for (const [name, position] of [
  ['Jonas', 'Acoustic'],
  ['Ferl', 'Acoustic'],
  ['Natan', 'Acoustic'],
  ['Mara', 'Acoustic'],
] as const) {
  qualifications.add(`${volunteerByName(name)!.id}|${posId(position)}`);
}

announcements.push(
  {
    id: uid('ann'),
    title: 'November theme: More Precious Than Gold',
    body: 'General cleaning follows rehearsal. Thank you for serving.',
    venue_id: null,
    is_pinned: true,
    published_at: NOW,
    created_by: ADMIN_USER_ID,
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: uid('ann'),
    title: 'Christmas rehearsal schedule (draft)',
    body: 'Dates to be confirmed with the worship leaders.',
    venue_id: null,
    is_pinned: false,
    published_at: null,
    created_by: ADMIN_USER_ID,
    created_at: NOW,
    updated_at: NOW,
  },
);

/** Pretend network time so loading states are real in the preview. */
export const delay = (ms = 120) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function record(summary: string) {
  log.unshift({ id: logCounter++, when: new Date().toISOString(), actor: 'Admin', summary });
}
