/**
 * @file   apps/server/tools/dropTestDatabase.ts
 * @module server/tools
 * @brief  Test only: throws away the database of an automated run when the run ends.
 *
 * Responsibility: drop the database DATABASE_URL names, a test database only (never the dev
 *                 database `smg`), so nothing a run wrote is left behind (kit K125).
 * Depends on:     ./database
 * Used by:        e2e/testStack.ts (the browser tests' end), load/stack.mjs
 * Spec:           docs/spec/09-testing-strategy.md §1.1
 */
import { dropDatabase, testDatabase } from './database.js';

await dropDatabase(testDatabase(process.env['DATABASE_URL'] ?? ''));
