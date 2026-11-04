// Scheduling rule tests (Phase 4): assigning, problems, publishing, suggestions, copying, history.
// Same approach as database.test.mjs: the real migrations on an in-memory Postgres.
//   npm run test:db

import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';
import { createDb, fails } from './harness.mjs';

const { db, as, rows, count } = await createDb();

const id = {};
const pos = {};
const venue = {};

async function user(email) {
  return (await rows(`insert into auth.users (email) values ($1) returning id`, [email]))[0].id;
}

/** Add a volunteer and the positions they are qualified for (set up as the server, not through the API). */
async function volunteer(name, qualifiedFor = [], { active = true, userId = null } = {}) {
  const v = (
    await rows(
      `insert into public.volunteers (display_name, is_active, user_id) values ($1, $2, $3) returning id`,
      [name, active, userId],
    )
  )[0].id;
  for (const p of qualifiedFor) {
    await db.query(
      `insert into public.volunteer_qualifications (volunteer_id, position_id) values ($1, $2)`,
      [v, pos[p]],
    );
  }
  return v;
}

async function service(venueName, date, status = 'draft') {
  return (
    await rows(
      `insert into public.services (venue_id, service_date, status, published_at)
       values ($1, $2, $3::public.publish_status, case when $3::text = 'published' then now() end) returning id`,
      [venue[venueName], date, status],
    )
  )[0].id;
}

const assign = (serviceId, date, position, volunteerId) =>
  db.query(
    `insert into public.assignments (service_id, service_date, position_id, volunteer_id) values ($1, $2, $3, $4)`,
    [serviceId, date, pos[position], volunteerId],
  );

const away = (volunteerId, date) =>
  db.query(
    `insert into public.volunteer_availability (volunteer_id, service_date, is_available) values ($1, $2, false)
     on conflict (volunteer_id, service_date) do update set is_available = false`,
    [volunteerId, date],
  );

const serviceStatus = async (serviceId) =>
  (await rows(`select status from public.services where id = $1`, [serviceId]))[0].status;

before(async () => {
  for (const r of await rows(`select id, name from public.positions`)) pos[r.name] = r.id;
  for (const r of await rows(`select id, name from public.venues`)) venue[r.name] = r.id;

  id.adminUser = await user('admin@example.com');
  id.aliceUser = await user('alice@example.com');
  await db.exec(`update public.user_roles set role = 'admin' where user_id = '${id.adminUser}'`);
  id.pastor = await volunteer('Pastor', [], { userId: id.adminUser }); // lets history show the actor's name

  id.alice = await volunteer('Alice', ['Keyboard', 'Song Leader'], { userId: id.aliceUser });
  id.sica = await volunteer('Sica', ['Song Leader', 'Keyboard', 'Back Up', 'Musician']);
  id.denver = await volunteer('Denver', ['Song Leader', 'Acoustic', 'Bass Guitarist']);
  id.natan = await volunteer('Natan', ['Back Up', 'Acoustic', 'Bass Guitarist', 'Lead Guitarist']);
  id.ferl = await volunteer('Ferl', ['Bass Guitarist', 'Acoustic']);
  id.zed = await volunteer('Zed'); // qualified for nothing
  id.gone = await volunteer('Gone', ['Keyboard'], { active: false });
});

describe('assigning someone to a position', () => {
  test('is refused for someone not qualified, with a message that says what to do', async () => {
    const s = await service('LNHC', '2026-11-01');
    await as(id.adminUser, async () => {
      await fails(
        assign(s, '2026-11-01', 'Keyboard', id.zed),
        /Zed isn't qualified for Keyboard\. Add it to their qualifications first\./,
      );
    });
  });

  test('is refused for a position the venue does not use', async () => {
    const s = await service('Tangway', '2026-11-01');
    await as(id.adminUser, async () => {
      await fails(
        assign(s, '2026-11-01', 'Keyboard', id.sica),
        /Keyboard isn't a position at Tangway/,
      );
    });
  });

  test('is refused for someone who is no longer active', async () => {
    const s = (
      await rows(
        `select id from public.services where venue_id = $1 and service_date = '2026-11-01'`,
        [venue.LNHC],
      )
    )[0].id;
    await as(id.adminUser, async () => {
      await fails(
        assign(s, '2026-11-01', 'Keyboard', id.gone),
        /Gone is no longer an active volunteer/,
      );
    });
  });

  test('is refused for someone marked Away that Sunday, but not when they simply have not answered', async () => {
    const s = await service('LNHC', '2026-11-08');
    await away(id.natan, '2026-11-08');
    await as(id.adminUser, async () => {
      await fails(
        assign(s, '2026-11-08', 'Lead Guitarist', id.natan),
        /Natan is marked Away on November 8\. Choose someone else/,
      );
      await assign(s, '2026-11-08', 'Acoustic', id.denver); // Denver has not answered: allowed
    });
  });

  test('allows several people in one position, and one person qualified for several positions on different Sundays', async () => {
    const s = await service('LNHC', '2026-11-15');
    const s22 = await service('LNHC', '2026-11-22');
    await as(id.adminUser, async () => {
      await assign(s, '2026-11-15', 'Back Up', id.natan);
      await assign(s, '2026-11-15', 'Back Up', id.sica);
      await assign(s, '2026-11-15', 'Song Leader', id.denver);
      await assign(s22, '2026-11-22', 'Keyboard', id.sica);
      // On the same Sunday Sica can't take a second position.
      await fails(
        assign(s, '2026-11-15', 'Keyboard', id.sica),
        /one_assignment_per_person_per_sunday/,
      );
    });
    assert.equal(
      await count(
        `select count(*) n from public.assignments where service_id = $1 and position_id = $2`,
        [s, pos['Back Up']],
      ),
      2,
    );
  });

  test('changing an existing assignment to someone unqualified is also refused', async () => {
    await as(id.adminUser, async () => {
      await fails(
        db.query(
          `update public.assignments set volunteer_id = $1 where service_id = (select id from public.services where venue_id = $2 and service_date = '2026-11-22')`,
          [id.zed, venue.LNHC],
        ),
        /Zed isn't qualified/,
      );
    });
  });
});

describe('marking Away after being scheduled', () => {
  test('a volunteer cannot mark Away a Sunday they are published to serve, and is told who to ask', async () => {
    const s = await service('LNHC', '2026-11-29', 'published');
    await assign(s, '2026-11-29', 'Keyboard', id.alice);
    await as(id.aliceUser, async () => {
      await fails(
        db.query(
          `insert into public.volunteer_availability (volunteer_id, service_date, is_available) values ($1, '2026-11-29', false)`,
          [id.alice],
        ),
        /You're scheduled to serve on November 29\. Ask your administrator to take you off the schedule first\./,
      );
    });
  });

  test('a volunteer can mark Away a Sunday that is only a draft, and the draft is not revealed to them', async () => {
    const s = await service('LNHC', '2026-12-06');
    await assign(s, '2026-12-06', 'Keyboard', id.alice);
    await as(id.aliceUser, async () => {
      await db.query(
        `insert into public.volunteer_availability (volunteer_id, service_date, is_available) values ($1, '2026-12-06', false)`,
        [id.alice],
      );
    });
  });

  test('an administrator is not blocked, and the clash then appears in the problem list', async () => {
    await as(id.adminUser, async () => {
      await away(id.alice, '2026-11-29'); // an administrator is not blocked, unlike the volunteer above
      const problems = await rows(
        `select problem, message from public.schedule_problems('2026-11-01', '2026-12-31') where volunteer_id = $1 order by service_date`,
        [id.alice],
      );
      assert.deepEqual(
        problems.map((p) => p.problem),
        ['away', 'away'],
      );
      assert.match(
        problems[0].message,
        /Alice is marked Away on November 29 but is scheduled as Keyboard at LNHC\./,
      );
    });
    // Put things back for the tests that follow.
    await db.query(`delete from public.volunteer_availability where volunteer_id = $1`, [id.alice]);
  });
});

describe('problems in existing schedules', () => {
  test('are reported to administrators only', async () => {
    await db.query(
      `delete from public.volunteer_qualifications where volunteer_id = $1 and position_id = $2`,
      [id.denver, pos['Song Leader']],
    );
    await as(id.adminUser, async () => {
      const p = await rows(
        `select problem, message from public.schedule_problems('2026-11-01', '2026-11-30')`,
      );
      assert.ok(
        p.some(
          (x) =>
            x.problem === 'not_qualified' &&
            /Denver isn't qualified for Song Leader \(LNHC, November 15\)\./.test(x.message),
        ),
      );
    });
    await as(id.aliceUser, async () => {
      assert.equal(
        (await rows(`select * from public.schedule_problems('2026-11-01', '2026-12-31')`)).length,
        0,
      );
    });
    await as('anon', async () => {
      await fails(
        db.query(`select * from public.schedule_problems('2026-11-01', '2026-12-31')`),
        /permission denied/i,
      );
    });
  });

  test('a deactivated volunteer who is still scheduled is reported', async () => {
    await db.query(`update public.volunteers set is_active = false where id = $1`, [id.ferl]);
    const s = await service('LNHC', '2027-01-03');
    await db.query(`update public.volunteers set is_active = true where id = $1`, [id.ferl]);
    await assign(s, '2027-01-03', 'Bass Guitarist', id.ferl);
    await db.query(`update public.volunteers set is_active = false where id = $1`, [id.ferl]);
    await as(id.adminUser, async () => {
      const p = await rows(
        `select problem from public.schedule_problems('2027-01-01', '2027-01-31')`,
      );
      assert.deepEqual(
        p.map((x) => x.problem),
        ['inactive'],
      );
    });
    await db.query(`update public.volunteers set is_active = true where id = $1`, [id.ferl]);
  });
});

describe('publishing', () => {
  test('is refused while there are problems, and says how many and what the first one is', async () => {
    const nov15 = (
      await rows(
        `select id from public.services where venue_id = $1 and service_date = '2026-11-15'`,
        [venue.LNHC],
      )
    )[0].id;
    await as(id.adminUser, async () => {
      await fails(
        db.query(`update public.services set status = 'published' where id = $1`, [nov15]),
        /Fix 1 problem before publishing LNHC for November 15: Denver isn't qualified for Song Leader/,
      );
    });
    assert.equal(await serviceStatus(nov15), 'draft');
  });

  test('works once the problem is fixed, and records who published and when', async () => {
    const nov15 = (
      await rows(
        `select id from public.services where venue_id = $1 and service_date = '2026-11-15'`,
        [venue.LNHC],
      )
    )[0].id;
    await db.query(
      `insert into public.volunteer_qualifications (volunteer_id, position_id) values ($1, $2)`,
      [id.denver, pos['Song Leader']],
    );
    await as(id.adminUser, async () => {
      await db.query(`update public.services set status = 'published' where id = $1`, [nov15]);
    });
    const r = (
      await rows(
        `select status, published_at is not null as has_time, published_by from public.services where id = $1`,
        [nov15],
      )
    )[0];
    assert.equal(r.status, 'published');
    assert.equal(r.has_time, true);
    assert.equal(r.published_by, id.adminUser);
  });

  test('a whole month is all-or-nothing: one problem stops every Sunday in the same update', async () => {
    const sundays = ['2027-02-07', '2027-02-14', '2027-02-21'];
    const ids = [];
    for (const d of sundays) ids.push(await service('LNHC', d));
    await assign(ids[0], sundays[0], 'Keyboard', id.sica);
    await assign(ids[1], sundays[1], 'Keyboard', id.sica);
    await db.query(
      `delete from public.volunteer_qualifications where volunteer_id = $1 and position_id = $2`,
      [id.sica, pos.Keyboard],
    );
    await as(id.adminUser, async () => {
      await fails(
        db.query(
          `update public.services set status = 'published' where venue_id = $1 and service_date between '2027-02-01' and '2027-02-28'`,
          [venue.LNHC],
        ),
        /Fix 1 problem before publishing/,
      );
    });
    for (const sid of ids) assert.equal(await serviceStatus(sid), 'draft');
    await db.query(
      `insert into public.volunteer_qualifications (volunteer_id, position_id) values ($1, $2)`,
      [id.sica, pos.Keyboard],
    );
  });

  test('a volunteer sees a schedule only once it is published, and sees later edits to it', async () => {
    const nov15 = (
      await rows(
        `select id from public.services where venue_id = $1 and service_date = '2026-11-15'`,
        [venue.LNHC],
      )
    )[0].id;
    await as(id.aliceUser, async () => {
      assert.equal(
        await count(`select count(*) n from public.assignments where service_id = $1`, [nov15]),
        3,
      );
    });
    const ferl = id.ferl;
    await as(id.adminUser, async () => {
      await assign(nov15, '2026-11-15', 'Bass Guitarist', ferl); // edit a published schedule
    });
    await as(id.aliceUser, async () => {
      assert.equal(
        await count(`select count(*) n from public.assignments where service_id = $1`, [nov15]),
        4,
      );
    });
  });

  test('unpublishing hides it again and clears the publish details', async () => {
    const nov15 = (
      await rows(
        `select id from public.services where venue_id = $1 and service_date = '2026-11-15'`,
        [venue.LNHC],
      )
    )[0].id;
    await as(id.adminUser, async () => {
      await db.query(`update public.services set status = 'draft' where id = $1`, [nov15]);
    });
    const r = (
      await rows(`select published_at, published_by from public.services where id = $1`, [nov15])
    )[0];
    assert.equal(r.published_at, null);
    assert.equal(r.published_by, null);
    await as(id.aliceUser, async () => {
      assert.equal(
        await count(`select count(*) n from public.assignments where service_id = $1`, [nov15]),
        0,
      );
    });
  });

  test('a schedule cannot be moved to another venue', async () => {
    const nov15 = (
      await rows(
        `select id from public.services where venue_id = $1 and service_date = '2026-11-15'`,
        [venue.LNHC],
      )
    )[0].id;
    await as(id.adminUser, async () => {
      await fails(
        db.query(`update public.services set venue_id = $1 where id = $2`, [venue.Tangway, nov15]),
        /can't be moved to another venue/,
      );
    });
  });

  test('moving a schedule to a Sunday where someone is Away is refused', async () => {
    const s = await service('LNHC', '2027-03-07');
    await assign(s, '2027-03-07', 'Keyboard', id.sica);
    await away(id.sica, '2027-03-14');
    await as(id.adminUser, async () => {
      await fails(
        db.query(`update public.services set service_date = '2027-03-14' where id = $1`, [s]),
        /Sica is marked Away on March 14/,
      );
    });
  });
});

describe('suggestions for a position', () => {
  let nov8, pia, lee, mara;

  before(async () => {
    nov8 = (
      await rows(
        `select id from public.services where venue_id = $1 and service_date = '2026-11-08'`,
        [venue.LNHC],
      )
    )[0].id;
    // Existing state on Nov 8: Denver is on the LNHC Acoustic, Natan is Away.
    await db.query(`delete from public.assignments where service_id = $1`, [nov8]);
    mara = await volunteer('Mara', ['Acoustic']); // never served, has not answered
    lee = await volunteer('Lee', ['Acoustic']); // answered Available, last served Nov 1
    pia = await volunteer('Pia', ['Acoustic']); // last served Oct 4
    await db.query(
      `insert into public.volunteer_availability (volunteer_id, service_date, is_available) values ($1, '2026-11-08', true)`,
      [lee],
    );
    const oct4 = await service('LNHC', '2026-10-04');
    await assign(oct4, '2026-10-04', 'Acoustic', pia);
    const nov1 = (
      await rows(
        `select id from public.services where venue_id = $1 and service_date = '2026-11-01'`,
        [venue.LNHC],
      )
    )[0].id;
    await assign(nov1, '2026-11-01', 'Acoustic', lee);
    // Ferl is Away, Denver already serves at Tangway, Natan already serves at LNHC on Nov 8.
    await away(id.ferl, '2026-11-08');
    const tang = await service('Tangway', '2026-11-08');
    await assign(tang, '2026-11-08', 'Song Leader', id.denver);
    await db
      .query(
        `insert into public.volunteer_qualifications (volunteer_id, position_id) values ($1, $2)`,
        [id.natan, pos['Lead Guitarist']],
      )
      .catch(() => {});
    await db.query(`delete from public.volunteer_availability where volunteer_id = $1`, [id.natan]);
    await assign(nov8, '2026-11-08', 'Lead Guitarist', id.natan);
  });

  test('lists qualified people, those who can be assigned first, longest-rested first', async () => {
    await as(id.adminUser, async () => {
      const r = await rows(`select * from public.suggest_volunteers($1, $2)`, [nov8, pos.Acoustic]);
      assert.deepEqual(
        r.map((x) => [x.display_name, x.can_assign]),
        [
          ['Mara', true], // never served
          ['Pia', true], // Oct 4
          ['Lee', true], // Nov 1
          ['Denver', false],
          ['Ferl', false],
          ['Natan', false],
        ],
      );
      assert.equal(r.find((x) => x.display_name === 'Mara').status, 'no_answer');
      assert.equal(r.find((x) => x.display_name === 'Lee').status, 'available');
      assert.equal(r.find((x) => x.display_name === 'Lee').times_served_8_weeks, 1);
      assert.equal(r.find((x) => x.display_name === 'Mara').last_served, null);
    });
  });

  test('says why each blocked person cannot be assigned', async () => {
    await as(id.adminUser, async () => {
      const r = await rows(`select display_name, reason from public.suggest_volunteers($1, $2)`, [
        nov8,
        pos.Acoustic,
      ]);
      const why = Object.fromEntries(r.map((x) => [x.display_name, x.reason]));
      assert.match(
        why.Denver,
        /Serving at Tangway \(Song Leader\) that Sunday\. One person can't serve at two venues on the same day\./,
      );
      assert.match(why.Ferl, /Marked Away on November 8\./);
      assert.match(
        why.Natan,
        /Already serving as Lead Guitarist at LNHC on November 8\. Each person has one position per Sunday\./,
      );
      assert.match(why.Mara, /Hasn't answered for November 8\./);
    });
  });

  test('never lists unqualified or inactive people, or a position the venue does not use', async () => {
    await as(id.adminUser, async () => {
      const names = (
        await rows(`select display_name from public.suggest_volunteers($1, $2)`, [
          nov8,
          pos.Keyboard,
        ])
      ).map((x) => x.display_name);
      assert.ok(!names.includes('Zed'));
      assert.ok(!names.includes('Gone'));
      const tang = (
        await rows(
          `select id from public.services where venue_id = $1 and service_date = '2026-11-08'`,
          [venue.Tangway],
        )
      )[0].id;
      assert.equal(
        (await rows(`select * from public.suggest_volunteers($1, $2)`, [tang, pos.Acoustic]))
          .length,
        0,
      );
    });
  });

  test('gives nothing to volunteers', async () => {
    await as(id.aliceUser, async () => {
      assert.equal(
        (await rows(`select * from public.suggest_volunteers($1, $2)`, [nov8, pos.Acoustic]))
          .length,
        0,
      );
    });
  });
});

describe('copying a schedule', () => {
  let src1, src2;

  before(async () => {
    // Source: Nov 1 and Nov 8 at Garcia/Rosario (own venue, own dates, so earlier tests don't interfere).
    src1 = await service('Garcia/Rosario', '2027-04-04');
    src2 = await service('Garcia/Rosario', '2027-04-11');
    const singer = await volunteer('Rachel', ['Singer']);
    const m1 = await volunteer('Jonas', ['Musician']);
    const m2 = await volunteer('Moises', ['Musician']);
    id.rachel = singer;
    await assign(src1, '2027-04-04', 'Singer', singer);
    await assign(src1, '2027-04-04', 'Musician', m1);
    await assign(src2, '2027-04-11', 'Singer', singer);
    await assign(src2, '2027-04-11', 'Musician', m2);
    // Targets: 2027-05-09 and 2027-05-16 (5 weeks later). Moises is Away on the second.
    await away(m2, '2027-05-16');
    // Jonas is already serving at Tangway on the first target Sunday.
    const tang = await service('Tangway', '2027-05-09');
    await assign(tang, '2027-05-09', 'Musician', m1);
  });

  test('copies what it can as drafts and reports everyone it could not place, and why', async () => {
    await as(id.adminUser, async () => {
      const r = (
        await rows(
          `select public.copy_schedule($1, '2027-04-04', '2027-04-11', '2027-05-09') as r`,
          [venue['Garcia/Rosario']],
        )
      )[0].r;
      assert.equal(r.services_created, 2);
      assert.equal(r.assignments_created, 2); // both Rachels; both musicians were blocked
      const skipped = Object.fromEntries(r.skipped.map((x) => [x.volunteer, x.reason]));
      assert.match(skipped.Jonas, /Jonas is already serving on May 9\./);
      assert.match(skipped.Moises, /Moises is marked Away on May 16\./);
      assert.deepEqual(r.days_skipped, []);
    });
    const copies = await rows(
      `select status from public.services where venue_id = $1 and service_date in ('2027-05-09', '2027-05-16')`,
      [venue['Garcia/Rosario']],
    );
    assert.deepEqual(
      copies.map((c) => c.status),
      ['draft', 'draft'],
    );
  });

  test('copying onto Sundays that already have assignments changes nothing', async () => {
    await as(id.adminUser, async () => {
      const r = (
        await rows(
          `select public.copy_schedule($1, '2027-04-04', '2027-04-11', '2027-05-09') as r`,
          [venue['Garcia/Rosario']],
        )
      )[0].r;
      assert.equal(r.assignments_created, 0);
      assert.equal(r.days_skipped.length, 2);
      assert.match(r.days_skipped[0].reason, /already has assignments/);
    });
  });

  test('refuses dates that do not line up by whole weeks, the same date, and non-administrators', async () => {
    await as(id.adminUser, async () => {
      await fails(
        db.query(`select public.copy_schedule($1, '2027-04-04', '2027-04-11', '2027-05-10')`, [
          venue['Garcia/Rosario'],
        ]),
        /must be Sundays so the weeks line up/,
      );
      await fails(
        db.query(`select public.copy_schedule($1, '2027-04-04', '2027-04-11', '2027-04-04')`, [
          venue['Garcia/Rosario'],
        ]),
        /Choose a different Sunday or month/,
      );
    });
    await as(id.aliceUser, async () => {
      await fails(
        db.query(`select public.copy_schedule($1, '2027-04-04', '2027-04-11', '2027-05-09')`, [
          venue['Garcia/Rosario'],
        ]),
        /Only administrators can copy schedules/,
      );
    });
  });
});

describe('assignment history', () => {
  test('shows who was added or removed, by whom, newest first, to administrators only', async () => {
    const s = await service('LNHC', '2027-06-06');
    await as(id.adminUser, async () => {
      await assign(s, '2027-06-06', 'Song Leader', id.sica);
      await db.query(`delete from public.assignments where service_id = $1 and volunteer_id = $2`, [
        s,
        id.sica,
      ]);
      const h = await rows(
        `select action, actor_name, volunteer_name, position_name from public.assignment_history($1)`,
        [s],
      );
      assert.deepEqual(h, [
        {
          action: 'removed',
          actor_name: 'Pastor',
          volunteer_name: 'Sica',
          position_name: 'Song Leader',
        },
        {
          action: 'added',
          actor_name: 'Pastor',
          volunteer_name: 'Sica',
          position_name: 'Song Leader',
        },
      ]);
    });
    await as(id.aliceUser, async () => {
      assert.equal((await rows(`select * from public.assignment_history($1)`, [s])).length, 0);
    });
  });
});
