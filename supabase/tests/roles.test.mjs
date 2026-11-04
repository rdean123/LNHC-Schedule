// Schedule maker role tests: a schedule maker does everything an administrator does EXCEPT
// change roles (and link logins to volunteers). Same approach as the other database tests.
//   npm run test:db

import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';
import { RLS, createDb, fails } from './harness.mjs';

const { db, as, rows, count } = await createDb();
const id = {};

const user = async (email) =>
  (await rows(`insert into auth.users (email) values ($1) returning id`, [email]))[0].id;
const position = async (name) =>
  (await rows(`select id from public.positions where name = $1`, [name]))[0].id;

before(async () => {
  id.admin = await user('admin@example.com');
  id.maker = await user('maker@example.com');
  id.aliceUser = await user('alice@example.com');
  await db.exec(`update public.user_roles set role = 'admin' where user_id = '${id.admin}'`);
  await db.exec(`update public.user_roles set role = 'scheduler' where user_id = '${id.maker}'`);

  id.alice = (
    await rows(
      `insert into public.volunteers (display_name, user_id) values ('Alice', $1) returning id`,
      [id.aliceUser],
    )
  )[0].id;
  id.lnhc = (await rows(`select id from public.venues where name = 'LNHC'`))[0].id;
  id.keyboard = await position('Keyboard');
  id.songLeader = await position('Song Leader');
});

describe('the schedule maker role', () => {
  test('exists, and a new account still starts as a plain volunteer', async () => {
    const roles = (await rows(`select unnest(enum_range(null::public.app_role))::text r`)).map(
      (r) => r.r,
    );
    assert.deepEqual(roles, ['admin', 'scheduler', 'volunteer']);
    assert.equal(
      (await rows(`select role from public.user_roles where user_id = $1`, [id.aliceUser]))[0].role,
      'volunteer',
    );
  });

  test('can add a volunteer, set their contact details including email, and choose what they can do', async () => {
    await as(id.maker, async () => {
      const v = (
        await rows(`insert into public.volunteers (display_name) values ('Dan') returning id`)
      )[0].id;
      id.dan = v;
      await db.query(
        `insert into public.volunteer_contacts (volunteer_id, full_name, email, phone) values ($1, 'Dan D', 'dan@example.com', '111')`,
        [v],
      );
      await db.query(
        `update public.volunteer_contacts set email = 'dan2@example.com' where volunteer_id = $1`,
        [v],
      );
      await db.query(
        `insert into public.volunteer_qualifications (volunteer_id, position_id) values ($1, $2), ($1, $3)`,
        [v, id.keyboard, id.songLeader],
      );
      await db.query(`update public.volunteers set is_active = false where id = $1`, [v]);
      await db.query(`update public.volunteers set is_active = true where id = $1`, [v]);
      assert.equal(await count(`select count(*) n from public.volunteer_contacts`), 1);
    });
  });

  test('can build, check, copy and publish a schedule', async () => {
    await as(id.maker, async () => {
      const s = (
        await rows(
          `insert into public.services (venue_id, service_date) values ($1, '2026-11-08') returning id`,
          [id.lnhc],
        )
      )[0].id;
      await db.query(
        `insert into public.assignments (service_id, service_date, position_id, volunteer_id) values ($1, '2026-11-08', $2, $3)`,
        [s, id.keyboard, id.dan],
      );
      const suggestions = await rows(`select display_name from public.suggest_volunteers($1, $2)`, [
        s,
        id.songLeader,
      ]);
      assert.deepEqual(
        suggestions.map((x) => x.display_name),
        ['Dan'],
      );
      assert.equal(
        (await rows(`select * from public.schedule_problems('2026-11-01', '2026-11-30')`)).length,
        0,
      );
      await db.query(`update public.services set status = 'published' where id = $1`, [s]);
      const copied = (
        await rows(
          `select public.copy_schedule($1, '2026-11-08', '2026-11-08', '2026-11-15') as r`,
          [id.lnhc],
        )
      )[0].r;
      assert.equal(copied.services_created, 1);
      assert.equal((await rows(`select action from public.assignment_history($1)`, [s])).length, 1);
    });
    // The person who made the change is recorded.
    assert.equal(
      (
        await rows(
          `select actor_id from public.audit_logs where table_name = 'services' and action = 'UPDATE' order by id desc limit 1`,
        )
      )[0].actor_id,
      id.maker,
    );
  });

  test('can edit venues and positions, post announcements, and read the activity log', async () => {
    await as(id.maker, async () => {
      await db.query(`update public.venues set sort_order = 9 where id = $1`, [id.lnhc]);
      await db.query(
        `insert into public.announcements (title, body, published_at) values ('Hello', 'Welcome', now())`,
      );
      assert.ok((await count(`select count(*) n from public.audit_logs`)) > 0);
    });
  });

  test('can see who holds which role, but cannot change any role, including their own', async () => {
    await as(id.maker, async () => {
      assert.equal(await count(`select count(*) n from public.user_roles`), 3);
      await fails(
        db.query(`insert into public.user_roles (user_id, role) values ($1, 'admin')`, [
          id.aliceUser,
        ]),
        RLS,
      );
      assert.equal(
        (
          await db.query(`update public.user_roles set role = 'admin' where user_id = $1`, [
            id.maker,
          ])
        ).affectedRows,
        0,
      );
      assert.equal(
        (
          await db.query(`update public.user_roles set role = 'scheduler' where user_id = $1`, [
            id.aliceUser,
          ])
        ).affectedRows,
        0,
      );
      assert.equal(
        (
          await db.query(`update public.user_roles set role = 'volunteer' where user_id = $1`, [
            id.admin,
          ])
        ).affectedRows,
        0,
      );
      assert.equal(
        (await db.query(`delete from public.user_roles where user_id = $1`, [id.admin]))
          .affectedRows,
        0,
      );
    });
    const roles = Object.fromEntries(
      (await rows(`select user_id, role from public.user_roles`)).map((r) => [r.user_id, r.role]),
    );
    assert.equal(roles[id.maker], 'scheduler');
    assert.equal(roles[id.admin], 'admin');
    assert.equal(roles[id.aliceUser], 'volunteer');
  });

  test('cannot attach a login to a volunteer record', async () => {
    await as(id.maker, async () => {
      await fails(
        db.query(`update public.volunteers set user_id = $1 where id = $2`, [id.maker, id.dan]),
        /Only an administrator can link a volunteer to a login/,
      );
    });
  });

  test('is not blocked from marking a volunteer unavailable on a published Sunday, unlike the volunteer themself', async () => {
    const s = (await rows(`select id from public.services where service_date = '2026-11-08'`))[0]
      .id;
    await db.query(
      `insert into public.volunteer_qualifications (volunteer_id, position_id) values ($1, $2)`,
      [id.alice, id.songLeader],
    );
    await db.query(
      `insert into public.assignments (service_id, service_date, position_id, volunteer_id) values ($1, '2026-11-08', $2, $3)`,
      [s, id.songLeader, id.alice],
    );
    await as(id.aliceUser, async () => {
      await fails(
        db.query(
          `insert into public.volunteer_availability (volunteer_id, service_date, is_available) values ($1, '2026-11-08', false)`,
          [id.alice],
        ),
        /You're scheduled to serve on November 8/,
      );
    });
    await as(id.maker, async () => {
      await db.query(
        `insert into public.volunteer_availability (volunteer_id, service_date, is_available) values ($1, '2026-11-08', false)`,
        [id.alice],
      );
    });
  });
});

describe('administrators and plain volunteers are unchanged', () => {
  test('an administrator can still change roles, including to schedule maker', async () => {
    await as(id.admin, async () => {
      await db.query(`update public.user_roles set role = 'scheduler' where user_id = $1`, [
        id.aliceUser,
      ]);
      await db.query(`update public.user_roles set role = 'volunteer' where user_id = $1`, [
        id.aliceUser,
      ]);
    });
    assert.equal(
      (await rows(`select role from public.user_roles where user_id = $1`, [id.aliceUser]))[0].role,
      'volunteer',
    );
  });

  test('the last administrator cannot be demoted, even to schedule maker', async () => {
    await as(id.admin, async () => {
      await fails(
        db.query(`update public.user_roles set role = 'scheduler' where user_id = $1`, [id.admin]),
        /last administrator/,
      );
    });
  });

  test('a plain volunteer still cannot do any of it', async () => {
    await as(id.aliceUser, async () => {
      await fails(db.query(`insert into public.volunteers (display_name) values ('Eve')`), RLS);
      await fails(
        db.query(`insert into public.announcements (title, body) values ('x', 'y')`),
        RLS,
      );
      await fails(
        db.query(`insert into public.services (venue_id, service_date) values ($1, '2026-12-06')`, [
          id.lnhc,
        ]),
        RLS,
      );
      assert.equal(await count(`select count(*) n from public.audit_logs`), 0);
      assert.equal(
        (await rows(`select * from public.schedule_problems('2026-11-01', '2026-12-31')`)).length,
        0,
      );
      assert.equal(
        (
          await db.query(`update public.user_roles set role = 'scheduler' where user_id = $1`, [
            id.aliceUser,
          ])
        ).affectedRows,
        0,
      );
    });
  });
});
