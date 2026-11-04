// Database tests: run the real migrations on an in-memory Postgres (PGlite) and try to break
// the rules as an anonymous visitor, a volunteer, and an administrator.
//   npm run test:db
// This proves the SQL logic and row level security. It is not a substitute for checking the
// hosted Supabase project (see DATABASE_SCHEMA.md, "Verifying the hosted project").

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { RLS, createDb, fails, migrationFiles, migrationsDir } from './harness.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const { db, as, rows, count } = await createDb();
const id = {}; // fixture ids

before(async () => {
  // Accounts. The on_auth_user_created trigger gives each one a volunteer role.
  const admin = await rows(
    `insert into auth.users (email) values ('admin@example.com') returning id`,
  );
  const admin2 = await rows(
    `insert into auth.users (email) values ('admin2@example.com') returning id`,
  );
  const alice = await rows(
    `insert into auth.users (email) values ('alice@example.com') returning id`,
  );
  const bob = await rows(`insert into auth.users (email) values ('bob@example.com') returning id`);
  id.admin = admin[0].id;
  id.admin2 = admin2[0].id;
  id.aliceUser = alice[0].id;
  id.bobUser = bob[0].id;
  await db.exec(
    `update public.user_roles set role = 'admin' where user_id in ('${id.admin}', '${id.admin2}')`,
  );

  // People who serve: Alice and Bob have accounts, Cara does not.
  id.alice = (
    await rows(
      `insert into public.volunteers (display_name, user_id) values ('Alice', $1) returning id`,
      [id.aliceUser],
    )
  )[0].id;
  id.bob = (
    await rows(
      `insert into public.volunteers (display_name, user_id) values ('Bob', $1) returning id`,
      [id.bobUser],
    )
  )[0].id;
  id.cara = (
    await rows(`insert into public.volunteers (display_name) values ('Cara') returning id`)
  )[0].id;
  id.retired = (
    await rows(
      `insert into public.volunteers (display_name, is_active) values ('Retired', false) returning id`,
    )
  )[0].id;
  await db.exec(`
    insert into public.volunteer_contacts (volunteer_id, full_name, email, phone) values
      ('${id.alice}', 'Alice A', 'alice@example.com', '111'),
      ('${id.bob}', 'Bob B', 'bob@example.com', '222'),
      ('${id.cara}', 'Cara C', 'cara@example.com', '333');
  `);

  id.lnhc = (await rows(`select id from public.venues where name = 'LNHC'`))[0].id;
  id.tangway = (await rows(`select id from public.venues where name = 'Tangway'`))[0].id;
  id.keyboard = (await rows(`select id from public.positions where name = 'Keyboard'`))[0].id;
  id.drummer = (await rows(`select id from public.positions where name = 'Drummer'`))[0].id;
  id.musician = (await rows(`select id from public.positions where name = 'Musician'`))[0].id;

  // The scheduling rules require qualifications before anyone can be assigned.
  await db.query(
    `insert into public.volunteer_qualifications (volunteer_id, position_id) values
      ($1, $4), ($1, $5), ($1, $6), ($2, $5), ($3, $5)`,
    [id.alice, id.bob, id.cara, id.keyboard, id.drummer, id.musician],
  );

  // One published and one draft service, each with an assignment.
  id.pubService = (
    await rows(
      `insert into public.services (venue_id, service_date, status, published_at) values ($1, '2026-11-08', 'published', now()) returning id`,
      [id.lnhc],
    )
  )[0].id;
  id.draftService = (
    await rows(
      `insert into public.services (venue_id, service_date) values ($1, '2026-11-15') returning id`,
      [id.lnhc],
    )
  )[0].id;
  await db.exec(`
    insert into public.assignments (service_id, service_date, position_id, volunteer_id) values
      ('${id.pubService}', '2026-11-08', '${id.keyboard}', '${id.alice}'),
      ('${id.draftService}', '2026-11-15', '${id.keyboard}', '${id.alice}');
  `);
});

describe('migrations and reference data', () => {
  test('all migrations applied and reference data matches the church schedules', async () => {
    assert.equal(migrationFiles.length, 9);
    assert.equal(await count(`select count(*) n from public.ministries`), 1);
    assert.equal(await count(`select count(*) n from public.venues`), 3);
    assert.equal(await count(`select count(*) n from public.positions`), 12);
    const perVenue = await rows(`
      select v.name, count(*)::int n from public.venue_positions vp
      join public.venues v on v.id = vp.venue_id group by v.name order by v.name`);
    assert.deepEqual(perVenue, [
      { name: 'Garcia/Rosario', n: 2 },
      { name: 'LNHC', n: 9 },
      { name: 'Tangway', n: 4 },
    ]);
    const label = await rows(`
      select vp.label from public.venue_positions vp
      join public.venues v on v.id = vp.venue_id join public.positions p on p.id = vp.position_id
      where v.name = 'Garcia/Rosario' and p.name = 'Musician'`);
    assert.equal(label[0].label, 'Musicians');
  });

  test('reference data migration can be re-run without duplicating anything', async () => {
    await db.exec(
      fs.readFileSync(path.join(migrationsDir, '20261104120500_reference_data.sql'), 'utf8'),
    );
    assert.equal(await count(`select count(*) n from public.venues`), 3);
    assert.equal(await count(`select count(*) n from public.positions`), 12);
    assert.equal(await count(`select count(*) n from public.venue_positions`), 15);
  });

  test('every table has row level security enabled', async () => {
    const off = await rows(`
      select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
    assert.deepEqual(off, []);
  });
});

describe('accounts and roles', () => {
  test('a new account becomes a volunteer, never an administrator', async () => {
    const r = await rows(`select role from public.user_roles where user_id = $1`, [id.aliceUser]);
    assert.equal(r[0].role, 'volunteer');
  });

  test('a new account is linked to the volunteer with the same email', async () => {
    const u = (
      await rows(`insert into auth.users (email) values ('CARA@example.com') returning id`)
    )[0].id;
    const linked = await rows(`select user_id from public.volunteers where id = $1`, [id.cara]);
    assert.equal(linked[0].user_id, u);
  });

  test('a volunteer cannot make themselves an administrator', async () => {
    await as(id.aliceUser, async () => {
      await fails(
        db.query(`insert into public.user_roles (user_id, role) values ($1, 'admin')`, [
          id.aliceUser,
        ]),
        RLS,
      );
      const upd = await db.query(`update public.user_roles set role = 'admin' where user_id = $1`, [
        id.aliceUser,
      ]);
      assert.equal(upd.affectedRows, 0);
    });
    const r = await rows(`select role from public.user_roles where user_id = $1`, [id.aliceUser]);
    assert.equal(r[0].role, 'volunteer');
  });

  test('a volunteer can read only their own role', async () => {
    await as(id.aliceUser, async () => {
      const r = await rows(`select user_id from public.user_roles`);
      assert.deepEqual(
        r.map((x) => x.user_id),
        [id.aliceUser],
      );
    });
  });

  test('an administrator can promote and demote, but never remove the last administrator', async () => {
    await as(id.admin, async () => {
      await db.query(`update public.user_roles set role = 'admin' where user_id = $1`, [
        id.bobUser,
      ]);
      await db.query(`update public.user_roles set role = 'volunteer' where user_id = $1`, [
        id.bobUser,
      ]);
    });
    // Down to two admins: demoting one is fine, the second is not.
    await as(id.admin, async () => {
      await db.query(`update public.user_roles set role = 'volunteer' where user_id = $1`, [
        id.admin2,
      ]);
      await fails(
        db.query(`update public.user_roles set role = 'volunteer' where user_id = $1`, [id.admin]),
        /last administrator/,
      );
      await fails(
        db.query(`delete from public.user_roles where user_id = $1`, [id.admin]),
        /last administrator/,
      );
    });
    await db.exec(`update public.user_roles set role = 'admin' where user_id = '${id.admin2}'`);
  });
});

describe('anonymous visitors', () => {
  test('cannot read any table', async () => {
    const tables = (await rows(`select tablename from pg_tables where schemaname = 'public'`)).map(
      (r) => r.tablename,
    );
    assert.ok(tables.length >= 13);
    await as('anon', async () => {
      for (const t of tables) {
        await fails(db.query(`select * from public.${t}`), /permission denied/i);
      }
    });
  });

  test('cannot call the role helpers', async () => {
    await as('anon', async () => {
      await fails(db.query(`select public.is_admin()`), /permission denied/i);
    });
  });
});

describe('volunteers', () => {
  test('can see every name, including people who are no longer active', async () => {
    await as(id.aliceUser, async () => {
      const names = (
        await rows(`select display_name from public.volunteers order by display_name`)
      ).map((r) => r.display_name);
      assert.deepEqual(names, ['Alice', 'Bob', 'Cara', 'Retired']);
    });
  });

  test('can see only their own contact details', async () => {
    await as(id.aliceUser, async () => {
      const r = await rows(`select email, phone from public.volunteer_contacts`);
      assert.deepEqual(r, [{ email: 'alice@example.com', phone: '111' }]);
    });
  });

  test('can change their own phone but not their email, and not someone else’s record', async () => {
    await as(id.aliceUser, async () => {
      await db.query(`update public.volunteer_contacts set phone = '999' where volunteer_id = $1`, [
        id.alice,
      ]);
      await fails(
        db.query(
          `update public.volunteer_contacts set email = 'x@example.com' where volunteer_id = $1`,
          [id.alice],
        ),
        /Only an administrator/,
      );
      const other = await db.query(
        `update public.volunteer_contacts set phone = '000' where volunteer_id = $1`,
        [id.bob],
      );
      assert.equal(other.affectedRows, 0);
    });
    assert.equal(
      (
        await rows(`select phone from public.volunteer_contacts where volunteer_id = $1`, [
          id.alice,
        ])
      )[0].phone,
      '999',
    );
    assert.equal(
      (
        await rows(`select phone from public.volunteer_contacts where volunteer_id = $1`, [id.bob])
      )[0].phone,
      '222',
    );
  });

  test('cannot create, edit or remove volunteers, or give anyone a qualification', async () => {
    await as(id.aliceUser, async () => {
      await fails(db.query(`insert into public.volunteers (display_name) values ('Eve')`), RLS);
      assert.equal(
        (
          await db.query(`update public.volunteers set display_name = 'Hacked' where id = $1`, [
            id.alice,
          ])
        ).affectedRows,
        0,
      );
      assert.equal(
        (await db.query(`delete from public.volunteers where id = $1`, [id.bob])).affectedRows,
        0,
      );
      await fails(
        db.query(
          `insert into public.volunteer_qualifications (volunteer_id, position_id) values ($1, $2)`,
          [id.alice, id.keyboard],
        ),
        RLS,
      );
    });
  });

  test('can read venues and positions but not change them', async () => {
    await as(id.aliceUser, async () => {
      assert.equal(await count(`select count(*) n from public.venues`), 3);
      assert.equal(await count(`select count(*) n from public.positions`), 12);
      await fails(db.query(`insert into public.venues (name) values ('Rogue')`), RLS);
      assert.equal(
        (await db.query(`update public.positions set name = 'X' where name = 'Keyboard'`))
          .affectedRows,
        0,
      );
    });
  });

  test('can set their own availability on Sundays only, and not for anyone else', async () => {
    await as(id.aliceUser, async () => {
      await db.query(
        `insert into public.volunteer_availability (volunteer_id, service_date, is_available, note) values ($1, '2027-01-17', false, 'Away')`,
        [id.alice],
      );
      await db.query(
        `update public.volunteer_availability set is_available = true where volunteer_id = $1 and service_date = '2027-01-17'`,
        [id.alice],
      );
      await fails(
        db.query(
          `insert into public.volunteer_availability (volunteer_id, service_date, is_available) values ($1, '2027-01-18', true)`,
          [id.alice],
        ),
        /availability_is_sunday/,
      );
      await fails(
        db.query(
          `insert into public.volunteer_availability (volunteer_id, service_date, is_available) values ($1, '2027-01-17', false)`,
          [id.bob],
        ),
        RLS,
      );
    });
  });

  test('cannot see anyone else’s availability', async () => {
    await db.exec(
      `insert into public.volunteer_availability (volunteer_id, service_date, is_available) values ('${id.bob}', '2027-01-10', false)`,
    );
    await as(id.aliceUser, async () => {
      const r = await rows(`select volunteer_id from public.volunteer_availability`);
      assert.ok(r.every((x) => x.volunteer_id === id.alice));
    });
    await as(id.admin, async () => {
      assert.ok(
        (await count(
          `select count(*) n from public.volunteer_availability where volunteer_id = '${id.bob}'`,
        )) >= 1,
      );
    });
  });

  test('see published schedules and their assignments, never drafts', async () => {
    await as(id.aliceUser, async () => {
      const s = await rows(`select id from public.services`);
      assert.deepEqual(
        s.map((x) => x.id),
        [id.pubService],
      );
      const a = await rows(`select service_id from public.assignments`);
      assert.deepEqual(
        a.map((x) => x.service_id),
        [id.pubService],
      );
    });
  });

  test('cannot change schedules or assignments', async () => {
    await as(id.aliceUser, async () => {
      await fails(
        db.query(`insert into public.services (venue_id, service_date) values ($1, '2026-11-22')`, [
          id.lnhc,
        ]),
        RLS,
      );
      assert.equal(
        (
          await db.query(
            `update public.services set status = 'draft', published_at = null where id = $1`,
            [id.pubService],
          )
        ).affectedRows,
        0,
      );
      assert.equal(
        (await db.query(`delete from public.assignments where service_id = $1`, [id.pubService]))
          .affectedRows,
        0,
      );
    });
  });

  test('see only announcements that are published and not scheduled for later', async () => {
    await db.exec(`
      insert into public.announcements (title, body, published_at) values
        ('Live', 'Visible now', now() - interval '1 day'),
        ('Soon', 'Scheduled', now() + interval '1 day'),
        ('Draft', 'Not published', null);
    `);
    await as(id.aliceUser, async () => {
      const t = (await rows(`select title from public.announcements`)).map((r) => r.title);
      assert.deepEqual(t, ['Live']);
    });
  });

  test('cannot read or write the audit log', async () => {
    await as(id.aliceUser, async () => {
      assert.equal(await count(`select count(*) n from public.audit_logs`), 0);
      await fails(
        db.query(`insert into public.audit_logs (action, table_name) values ('x', 'y')`),
        /permission denied/i,
      );
      await fails(db.query(`delete from public.audit_logs`), /permission denied/i);
    });
  });
});

describe('administrators', () => {
  test('can see everything, including drafts and everyone’s contact details', async () => {
    await as(id.admin, async () => {
      assert.equal(await count(`select count(*) n from public.services`), 2);
      assert.equal(await count(`select count(*) n from public.assignments`), 2);
      assert.equal(await count(`select count(*) n from public.volunteer_contacts`), 3);
    });
  });

  test('can add a volunteer and qualify them for several positions', async () => {
    await as(id.admin, async () => {
      const v = (
        await rows(`insert into public.volunteers (display_name) values ('Dan') returning id`)
      )[0].id;
      await db.query(
        `insert into public.volunteer_qualifications (volunteer_id, position_id) values ($1, $2), ($1, $3)`,
        [v, id.keyboard, id.drummer],
      );
      assert.equal(
        await count(
          `select count(*) n from public.volunteer_qualifications where volunteer_id = '${v}'`,
        ),
        2,
      );
    });
  });

  test('two active volunteers cannot share a name, but a deactivated name can be reused', async () => {
    await as(id.admin, async () => {
      await fails(
        db.query(`insert into public.volunteers (display_name) values ('  alice ')`),
        /volunteers_active_display_name_key/,
      );
      await db.query(`insert into public.volunteers (display_name) values ('Retired')`); // the old Retired is inactive
    });
  });

  test('a person can have only one assignment per Sunday: not two venues, not two positions', async () => {
    await as(id.admin, async () => {
      const other = (
        await rows(
          `insert into public.services (venue_id, service_date) values ($1, '2026-11-08') returning id`,
          [id.tangway],
        )
      )[0].id;
      // Alice is already on the LNHC keyboard on 8 Nov.
      await fails(
        db.query(
          `insert into public.assignments (service_id, service_date, position_id, volunteer_id) values ($1, '2026-11-08', $2, $3)`,
          [other, id.musician, id.alice],
        ),
        /one_assignment_per_person_per_sunday/,
      );
      await fails(
        db.query(
          `insert into public.assignments (service_id, service_date, position_id, volunteer_id) values ($1, '2026-11-08', $2, $3)`,
          [id.pubService, id.drummer, id.alice],
        ),
        /one_assignment_per_person_per_sunday/,
      );
      // A different person is fine, and several people can share one position.
      await db.query(
        `insert into public.assignments (service_id, service_date, position_id, volunteer_id) values ($1, '2026-11-08', $2, $3), ($1, '2026-11-08', $2, $4)`,
        [id.pubService, id.drummer, id.bob, id.cara],
      );
      // The same person on a different Sunday is fine.
      await db.query(
        `insert into public.assignments (service_id, service_date, position_id, volunteer_id) values ($1, '2026-11-15', $2, $3)`,
        [id.draftService, id.drummer, id.bob],
      );
    });
  });

  test('an assignment must carry the same date as its service', async () => {
    await as(id.admin, async () => {
      const dan = (await rows(`select id from public.volunteers where display_name = 'Dan'`))[0].id;
      await fails(
        db.query(
          `insert into public.assignments (service_id, service_date, position_id, volunteer_id) values ($1, '2026-11-22', $2, $3)`,
          [id.pubService, id.keyboard, dan],
        ),
        /foreign key/i,
      );
    });
  });

  test('services must be on a Sunday, and published services need a published time', async () => {
    await as(id.admin, async () => {
      await fails(
        db.query(`insert into public.services (venue_id, service_date) values ($1, '2026-11-09')`, [
          id.lnhc,
        ]),
        /services_is_sunday/,
      );
      await fails(
        db.query(
          `insert into public.services (venue_id, service_date, status) values ($1, '2026-11-29', 'published')`,
          [id.lnhc],
        ),
        /services_published_has_timestamp/,
      );
      await fails(
        db.query(`insert into public.services (venue_id, service_date) values ($1, '2026-11-08')`, [
          id.lnhc,
        ]),
        /services_venue_id_service_date_key/,
      );
    });
  });

  test('moving a service to another Sunday moves its assignments with it', async () => {
    await as(id.admin, async () => {
      const s = (
        await rows(
          `insert into public.services (venue_id, service_date) values ($1, '2026-12-06') returning id`,
          [id.tangway],
        )
      )[0].id;
      const eve = (
        await rows(`insert into public.volunteers (display_name) values ('Eve') returning id`)
      )[0].id;
      await db.query(
        `insert into public.volunteer_qualifications (volunteer_id, position_id) values ($1, $2)`,
        [eve, id.musician],
      );
      await db.query(
        `insert into public.assignments (service_id, service_date, position_id, volunteer_id) values ($1, '2026-12-06', $2, $3)`,
        [s, id.musician, eve],
      );
      await db.query(`update public.services set service_date = '2026-12-13' where id = $1`, [s]);
      const a = await rows(
        `select service_date::text d from public.assignments where service_id = $1`,
        [s],
      );
      assert.equal(a[0].d, '2026-12-13');
    });
  });

  test('a volunteer who has been assigned cannot be deleted, only deactivated', async () => {
    await as(id.admin, async () => {
      await fails(
        db.query(`delete from public.volunteers where id = $1`, [id.alice]),
        /foreign key|violates/i,
      );
      await db.query(`update public.volunteers set is_active = false where id = $1`, [id.bob]);
      await db.query(`update public.volunteers set is_active = true where id = $1`, [id.bob]);
    });
  });

  test('changes are recorded in the audit log with who made them, and only administrators can read it', async () => {
    await as(id.admin, async () => {
      await db.query(`update public.venues set sort_order = 5 where id = $1`, [id.tangway]);
      const log = await rows(
        `select actor_id, action, table_name, new_data->>'sort_order' s from public.audit_logs where table_name = 'venues' and action = 'UPDATE' order by id desc limit 1`,
      );
      assert.equal(log[0].actor_id, id.admin);
      assert.equal(log[0].s, '5');
    });
    await as(id.aliceUser, async () => {
      assert.equal(await count(`select count(*) n from public.audit_logs`), 0);
    });
  });
});
