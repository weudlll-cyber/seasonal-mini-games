/**
 * @file   e2e/playwright.config.ts
 * @module e2e
 * @brief  Playwright config: three browsers against the dev server and player client.
 *
 * Responsibility: start PostgreSQL (global setup), the server on 3910 and the player
 *                 client on 5410, then run the specs in Chromium, Firefox and WebKit at a
 *                 phone viewport. Specs listed in TIMING (their checks depend on browser
 *                 timers) run afterwards, one at a time and one browser after the other, as
 *                 Bingo learned to (its NIGHT-3); WebKit records no trace there. Locally an
 *                 already-running stack is reused.
 * Depends on:     @playwright/test, ./devStack, ./globalSetup
 * Spec:           docs/spec/09-testing-strategy.md §1, §4; Bingo 12 §7
 */
import { defineConfig, devices } from '@playwright/test';

import { CLIENT_URL, REPO_ROOT, SERVER_URL, databaseUrl } from './devStack.js';

const CI = process.env['CI'] !== undefined;

// Specs whose checks depend on timers firing on time (countdown, cooldown, specials, Frost):
// they run after the others, one test at a time.
const TIMING = [
  'rounds.spec.ts',
  'specials.spec.ts',
  'players.spec.ts',
  'access.spec.ts',
  'range.spec.ts',
];
const BROWSERS = [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit-mobile', use: { ...devices['iPhone 13'] } },
] as const;

export default defineConfig({
  testDir: '.',
  outputDir: '../test-results',
  globalSetup: './globalSetup.ts',
  timeout: 90_000,
  forbidOnly: CI,
  retries: 0,
  workers: 3,
  reporter: 'list',
  use: { baseURL: CLIENT_URL, trace: 'retain-on-failure' },
  projects: [
    ...BROWSERS.map((b) => ({ ...b, testIgnore: TIMING })),
    // The timing specs: after all others, one test at a time, one browser after another.
    ...BROWSERS.map((b, i) => ({
      ...b,
      // WebKit on Windows records a trace at 1–3 s a step with several pages open, which
      // breaks the timing checks themselves: no trace there (found in night run P8).
      ...(b.name === 'webkit-mobile' ? { use: { ...b.use, trace: 'off' as const } } : {}),
      name: `${b.name}-timing`,
      testMatch: TIMING,
      workers: 1,
      dependencies:
        i === 0 ? BROWSERS.map((x) => x.name) : [`${BROWSERS[i - 1]?.name ?? ''}-timing`],
    })),
  ],
  webServer: [
    {
      command: 'pnpm --filter @smg/server start',
      cwd: REPO_ROOT,
      url: `${SERVER_URL}/readyz`,
      // The specs use the development features (quick sign-in, Quick Test bots).
      env: { DATABASE_URL: databaseUrl(), SMG_PORT: '3910', SMG_LOG_LEVEL: 'warn', SMG_DEV: '1' },
      reuseExistingServer: !CI,
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter @smg/web dev',
      cwd: REPO_ROOT,
      url: CLIENT_URL,
      reuseExistingServer: !CI,
      timeout: 120_000,
    },
  ],
});
