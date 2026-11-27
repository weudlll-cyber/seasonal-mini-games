/**
 * @file   e2e/globalTeardown.ts
 * @module e2e
 * @brief  The end of a browser-test run: its database is thrown away (kit K125).
 *
 * Responsibility: drop `smg_test`, which the run's server (apps/server/tools/testServer) made
 *                 fresh at the start; journey 36 drops its own (./websiteStack).
 * Depends on:     ./testStack
 * Used by:        ./playwright.config.ts
 * Spec:           docs/spec/09-testing-strategy.md §1.1
 */
import { dropTestDatabase } from './testStack.js';

export default function globalTeardown(): void {
  dropTestDatabase();
}
