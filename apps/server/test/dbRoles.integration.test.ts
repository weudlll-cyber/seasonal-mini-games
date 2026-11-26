/**
 * @file   apps/server/test/dbRoles.integration.test.ts
 * @module server/test
 * @brief  The two database roles on a real PostgreSQL: the conversion of a database made before
 *         them, and what the app role may and may not do afterwards (kit K90).
 *
 * Responsibility: a database migrated by the superuser (as an older install) is converted with
 *                 the kit's db-roles.sql and the game's one grant more (as ops/lib/config.sh
 *                 apply_db_roles does it); the owner then runs the migration step, which grants
 *                 the app role; the app role reads and writes rows, only adds to the event
 *                 logs, only reads the migration record and creates, alters and drops nothing.
 *                 A fresh database migrates as the owner from nothing.
 * Depends on:     vitest, node:fs, pg (through ../src/db/pool), ./harness, ../src/db/migrator,
 *                 the kit's ops/lib/db-roles.sql
 * Spec:           DECISIONS T436; kit docs/OPERATIONS.md "Database roles"
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { APP_ROLE, migrate } from '../src/db/migrator.js';
import { createPool, type DbPool } from '../src/db/pool.js';
import { startHarness, stopHarness, SUITE_TIMEOUT_MS, type Harness } from './harness.js';

const PASSWORD = { smg_owner: 'owner-password-for-test', smg_app: 'app-password-for-the-test' };

// The kit's script with the game's names, as ops/lib/db-roles.sh fills it in.
function kitRolesSql(): string {
  const kit = path.dirname(createRequire(import.meta.url).resolve('@seasonal/kit/tokens.css'));
  return readFileSync(path.join(kit, '../ops/lib/db-roles.sql'), 'utf8')
    .replaceAll('__SCHEMA__', APP_ROLE.schema)
    .replaceAll('__OWNER__', 'smg_owner')
    .replaceAll('__APP__', APP_ROLE.role)
    .replaceAll('__OWNER_PASSWORD__', PASSWORD.smg_owner)
    .replaceAll('__APP_PASSWORD__', PASSWORD.smg_app);
}

// What apply_db_roles runs: the kit's script, then the owner's temporary tables (migration
// 0011), on the database the connection is on.
async function applyRoles(admin: DbPool): Promise<void> {
  await admin.query(kitRolesSql());
  const r = await admin.query<{ name: string }>('SELECT current_database() AS name');
  await admin.query(`GRANT TEMPORARY ON DATABASE "${r.rows[0]?.name ?? ''}" TO smg_owner`);
}

let harness: Harness;
const opened: DbPool[] = [];

// A pool on `database` as `role`, or as the container's superuser.
function poolOn(database: string, role?: keyof typeof PASSWORD): DbPool {
  const url = new URL(harness.container.getConnectionUri());
  url.pathname = `/${database}`;
  if (role !== undefined) {
    url.username = role;
    url.password = PASSWORD[role];
  }
  const pool = createPool(url.href);
  opened.push(pool);
  return pool;
}

beforeAll(async () => {
  harness = await startHarness();
}, SUITE_TIMEOUT_MS);

afterAll(async () => {
  for (const pool of opened) await pool.end();
  await stopHarness(harness);
}, SUITE_TIMEOUT_MS);

const refused = (pool: DbPool, sql: string) =>
  expect(pool.query(sql), sql).rejects.toMatchObject({ code: '42501' });

describe('the database roles (kit K90)', () => {
  it(
    'converts an older database and leaves the app role rows only',
    async () => {
      // The harness's database is migrated by the superuser: an install from before the roles.
      const database = new URL(harness.container.getConnectionUri()).pathname.slice(1);
      await applyRoles(harness.pool);
      // Idempotent, as the installer runs it again on every re-run and after a restore.
      await applyRoles(harness.pool);
      expect(await migrate(poolOn(database, 'smg_owner'))).toEqual([]);
      const app = poolOn(database, 'smg_app');
      const record = await app.query('SELECT count(*)::int AS n FROM smg.schema_migrations');
      expect((record.rows[0] as { n: number }).n).toBeGreaterThan(0);
      await app.query("UPDATE smg.website_feed SET cursor = '7'");
      await app.query(
        "INSERT INTO smg.embed_origins (origin, label, allow_auth_handoff) VALUES ('https://a.example', 'a', false)",
      );
      await app.query('DELETE FROM smg.embed_origins');
      for (const table of APP_ROLE.appendOnly) {
        await refused(app, `DELETE FROM smg.${table}`);
        await refused(app, `TRUNCATE smg.${table}`);
      }
      await refused(app, 'DELETE FROM smg.schema_migrations');
      await refused(app, 'CREATE TABLE smg.mine (id int)');
      await refused(app, 'ALTER TABLE smg.accounts ADD COLUMN mine int');
      await refused(app, 'DROP TABLE smg.accounts');
    },
    SUITE_TIMEOUT_MS,
  );

  it(
    'lets the owner build a new database from nothing, the app role ready after it',
    async () => {
      await harness.pool.query('CREATE DATABASE smg_fresh');
      const admin = poolOn('smg_fresh');
      await applyRoles(admin);
      const applied = await migrate(poolOn('smg_fresh', 'smg_owner'));
      expect(applied.length).toBeGreaterThan(0);
      const app = poolOn('smg_fresh', 'smg_app');
      // citext, made by the owner, is found by the app role too.
      await app.query("SELECT 'A'::citext = 'a'::citext");
      await refused(app, 'DELETE FROM smg.audit_log');
    },
    SUITE_TIMEOUT_MS,
  );
});
