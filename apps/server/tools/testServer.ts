/**
 * @file   apps/server/tools/testServer.ts
 * @module server/tools
 * @brief  Test only: the server of an automated run, on a fresh database of its own.
 *
 * Responsibility: start the development PostgreSQL, recreate the run's database (DATABASE_URL,
 *                 a test database, never the dev database `smg`), migrate it and start the
 *                 server on it (../src/server, which reads the rest of its settings from the
 *                 environment: the run's port and allowed origins). Every run starts from an
 *                 empty database, so a run never reads what an earlier run or the developer left
 *                 (DECISIONS T345); the run drops it when it ends (./dropTestDatabase), and the
 *                 server, still up then, ends quietly when the drop closes its connections.
 * Depends on:     ./database, ../src/server, ../src/round/guessLimits
 * Used by:        package.json script "test-server" (e2e/playwright.config.ts), load/stack.mjs
 * Spec:           docs/spec/09-testing-strategy.md §1.1
 */
import { migrateDatabase, recreateDatabase, startDevPostgres, testDatabase } from './database.js';

const db = testDatabase(process.env['DATABASE_URL'] ?? '');
startDevPostgres();
await recreateDatabase(db);
await migrateDatabase(db);
// The play limits never wait in an automated run (shared dev accounts, parallel workers,
// DECISIONS T406); test/limits.integration.test.ts runs them with the real clock.
const { startServer } = await import('../src/server.js');
const { aheadClock } = await import('../src/round/guessLimits.js');
await startServer({ limitsNow: aheadClock() });
// PostgreSQL's "admin shutdown" (57P01): the run's end dropped the database under the server.
// Anything else is thrown as it would be.
process.on('uncaughtException', (error: Error & { code?: string }) => {
  if (error.code === '57P01') process.exit(0);
  throw error;
});
