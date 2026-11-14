/**
 * @file   e2e/playwright.config.ts
 * @module e2e
 * @brief  Playwright config: three browsers against the run's own server, client and admin app.
 *
 * Responsibility: start the run's own stack, never the developer's (09 §1.1): the test server
 *                 on 3940 on its fresh database smg_test (apps/server/tools/testServer, which
 *                 also starts the development PostgreSQL), the player client on 5440 and the
 *                 admin app on 5441, both pointed at it, and the test host site on 5420
 *                 (development only, ./host-page); a running `pnpm dev` (3910, 5410, 5411) is
 *                 neither reused nor touched, and a port already taken stops the run. Then run
 *                 the specs in Chromium, Firefox and WebKit at a phone viewport. Specs listed in
 *                 TIMING (their checks depend on browser timers, or they change shared settings)
 *                 run afterwards, one at a time and one browser after the other, as Bingo learned
 *                 to (its NIGHT-3); WebKit records no trace there. Specs in CHROMIUM_ONLY run in
 *                 Chromium alone (journey 36 starts its own website-mode server and nginx,
 *                 ./websiteStack).
 * Depends on:     @playwright/test, ./testStack
 * Spec:           docs/spec/09-testing-strategy.md §1.1, §4; Bingo 12 §7
 */
import { defineConfig, devices } from '@playwright/test';

import {
  ADMIN_PORT,
  ADMIN_URL,
  CLIENT_PORT,
  CLIENT_URL,
  HOST_PAGE_URL,
  REPO_ROOT,
  SERVER_PORT,
  SERVER_URL,
  databaseUrl,
} from './testStack.js';

const CI = process.env['CI'] !== undefined;

// The clients of the run, the only browser origins its server lets open a socket.
const ORIGINS = [CLIENT_PORT, ADMIN_PORT]
  .flatMap((port) => [`http://127.0.0.1:${String(port)}`, `http://localhost:${String(port)}`])
  .join(',');
// The Vite dev servers' port and the server they pass /api and /ws to (apps/*/vite.config.ts).
const viteEnv = (port: number) => ({ SMG_VITE_PORT: String(port), SMG_VITE_SERVER: SERVER_URL });

// Specs whose checks depend on timers firing on time (countdown, cooldown, specials, Frost):
// they run after the others, one test at a time.
const TIMING = [
  'rounds.spec.ts',
  'specials.spec.ts',
  'seasons.spec.ts',
  'leafFall.spec.ts',
  // The guess games' journeys 20–22: specials and the explosion's cooldown.
  'safecracker.spec.ts',
  'bombDefusal.spec.ts',
  'target.spec.ts',
  // Journey 37: the inactivity countdown's seconds and the limit's timer (O71).
  'inactivity.spec.ts',
  // Journeys 24–27: each game in focus mode, a guess at each size after a cooldown.
  'focus.spec.ts',
  'players.spec.ts',
  'access.spec.ts',
  'range.spec.ts',
  'lobby.spec.ts',
  'boards.spec.ts',
  // Not timing, but it changes platform-wide chat settings: never two browsers at once.
  'chat.spec.ts',
  // Changes and rolls back the game's settings document, and aborts a round.
  'admin.spec.ts',
  // Change the embed allowlist and the identity providers (journeys 8 and 29).
  'embed.spec.ts',
  'accountDeletion.spec.ts',
  // Journeys 30–32: add and remove an identity provider, an embed origin and a webhook.
  'integration.spec.ts',
];
// Specs that run in Chromium only: journey 36 starts its own server and nginx container, and
// proves the server and the proxy, not the browser (DECISIONS T241).
const CHROMIUM_ONLY = ['website.spec.ts'];
const BROWSERS = [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit-mobile', use: { ...devices['iPhone 13'] } },
] as const;

export default defineConfig({
  testDir: '.',
  outputDir: '../test-results',
  timeout: 90_000,
  forbidOnly: CI,
  retries: 0,
  workers: 3,
  reporter: 'list',
  use: { baseURL: CLIENT_URL, trace: 'retain-on-failure' },
  projects: [
    ...BROWSERS.map((b) => ({
      ...b,
      testIgnore: b.name === 'chromium' ? TIMING : [...TIMING, ...CHROMIUM_ONLY],
    })),
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
  // Never an existing server: a run always uses the stack it started (09 §1.1).
  webServer: [
    {
      command: 'pnpm --filter @smg/server test-server',
      cwd: REPO_ROOT,
      url: `${SERVER_URL}/readyz`,
      // The specs use the development features (quick sign-in, Quick Test bots).
      env: {
        DATABASE_URL: databaseUrl(),
        SMG_PORT: String(SERVER_PORT),
        SMG_ALLOWED_ORIGINS: ORIGINS,
        SMG_LOG_LEVEL: 'warn',
        SMG_DEV: '1',
      },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter @smg/web dev',
      cwd: REPO_ROOT,
      url: CLIENT_URL,
      env: viteEnv(CLIENT_PORT),
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter @smg/admin dev',
      cwd: REPO_ROOT,
      url: ADMIN_URL,
      env: viteEnv(ADMIN_PORT),
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      // Development only: the test host site of journey 8 (never part of the image).
      command: 'node --experimental-strip-types e2e/host-page/server.ts',
      cwd: REPO_ROOT,
      url: `${HOST_PAGE_URL}/healthz`,
      env: { SMG_TEST_HOST_GAME: CLIENT_URL },
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
