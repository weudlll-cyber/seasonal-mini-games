/**
 * @file   apps/server/tools/testServer.ts
 * @module server/tools
 * @brief  Test only: the server of an automated run, on a fresh database of its own.
 *
 * Responsibility: start the development PostgreSQL, recreate the run's database (DATABASE_URL,
 *                 one of TEST_DATABASES, never the dev database `smg`), migrate it and start the
 *                 server on it (../src/main, which reads the rest of its settings from the
 *                 environment: the run's port and allowed origins). Every run starts from an
 *                 empty database, so a run never reads what an earlier run or the developer left
 *                 (DECISIONS T345).
 * Depends on:     ./database, ../src/main
 * Used by:        package.json script "test-server" (e2e/playwright.config.ts), load/stack.mjs
 * Spec:           docs/spec/09-testing-strategy.md §1.1
 */
import { localDatabase, migrateDatabase, recreateDatabase, startDevPostgres } from './database.js';

// The automated runs' databases (09 §1.1): Playwright's, and the load check's.
const TEST_DATABASES = new Set(['smg_test', 'smg_load']);

const db = localDatabase(process.env['DATABASE_URL'] ?? '');
if (!TEST_DATABASES.has(db.name)) {
  throw new Error(`refused: ${db.name} is not a test database (${[...TEST_DATABASES].join(', ')})`);
}
startDevPostgres();
await recreateDatabase(db);
await migrateDatabase(db);
await import('../src/main.js');
