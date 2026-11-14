/**
 * @file   apps/server/tools/resetDevDatabase.ts
 * @module server/tools
 * @brief  Development only: a clean start of the developer's database (`pnpm dev:reset-db`).
 *
 * Responsibility: recreate the dev database empty and run the migrations, after checking that
 *                 the settings are the development ones of apps/server/dev.env (NODE_ENV
 *                 development, SMG_DEV=1, the database `smg` on 127.0.0.1:5510) and that no
 *                 server answers on the dev port 3910 (stop `pnpm dev` first). Anything else is
 *                 refused before a connection is opened. The whole database is replaced, so no
 *                 row is deleted past a trigger or constraint and none is disabled (DECISIONS
 *                 T345). Everything in it is lost: accounts, matches, rounds, settings.
 * Depends on:     ./database
 * Used by:        apps/server/package.json script "db:reset-dev", the root `pnpm dev:reset-db`
 * Spec:           docs/spec/10-repository-structure.md §4
 */
import { localDatabase, migrateDatabase, recreateDatabase, startDevPostgres } from './database.js';

const DEV_DATABASE = { name: 'smg', port: '5510' };
const DEV_SERVER = 'http://127.0.0.1:3910/readyz';

function devDatabase() {
  if (process.env['NODE_ENV'] !== 'development' || process.env['SMG_DEV'] !== '1') {
    throw new Error('refused: run through `pnpm dev:reset-db` (NODE_ENV=development, SMG_DEV=1)');
  }
  const db = localDatabase(process.env['DATABASE_URL'] ?? '');
  if (db.name !== DEV_DATABASE.name || db.port !== DEV_DATABASE.port) {
    throw new Error(`refused: ${db.name} on port ${db.port} is not the dev database`);
  }
  return db;
}

const db = devDatabase();
const running = await fetch(DEV_SERVER).then(
  () => true,
  () => false,
);
if (running) throw new Error('refused: a server answers on 3910; stop `pnpm dev` first');
startDevPostgres();
await recreateDatabase(db);
const applied = await migrateDatabase(db);
console.log(
  `[smg] dev database ${db.name} recreated, ${String(applied.length)} migrations applied`,
);
