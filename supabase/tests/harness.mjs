// Shared helpers for the database tests: an in-memory Postgres (PGlite) with the real
// migrations applied, and a way to act as an anonymous visitor or a signed-in user.

import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const migrationsDir = process.env.MIGRATIONS_DIR ?? path.join(here, '..', 'migrations');
export const migrationFiles = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

export const RLS = /row-level security|permission denied/i;

/** A fresh database with the stand-in auth schema and every migration applied. */
export async function createDb() {
  const db = new PGlite();
  await db.exec(fs.readFileSync(path.join(here, 'prelude.sql'), 'utf8'));
  for (const file of migrationFiles) {
    await db.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
  }

  /** Run `fn` as an anonymous visitor ('anon') or as the signed-in user with this id. */
  async function as(userId, fn) {
    const role = userId === 'anon' ? 'anon' : 'authenticated';
    const sub = userId === 'anon' ? '' : userId;
    await db.exec(`select set_config('request.jwt.claim.sub', '${sub}', false); set role ${role};`);
    try {
      return await fn();
    } finally {
      await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
    }
  }

  const rows = async (sql, params) => (await db.query(sql, params)).rows;
  const count = async (sql, params) => Number((await rows(sql, params))[0].n);

  return { db, as, rows, count };
}

/** Assert that a promise rejects, optionally with a message matching `pattern`. */
export async function fails(promise, pattern) {
  await assert.rejects(promise, (err) => {
    if (pattern && !pattern.test(err.message)) {
      assert.fail(`Expected error matching ${pattern} but got: ${err.message}`);
    }
    return true;
  });
}
