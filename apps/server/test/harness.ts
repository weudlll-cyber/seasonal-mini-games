/**
 * @file   apps/server/test/harness.ts
 * @module server/test
 * @brief  Integration harness: a Testcontainers PostgreSQL 17, migrations, the Fastify app.
 *
 * Responsibility: start one database per test file, migrate it and build the app with
 *                 test settings (overridable, e.g. NODE_ENV=production or feature flags);
 *                 `buildOn` builds a second app on the same database; injected requests name
 *                 the game's own page as their source unless they name one; a test may install the
 *                 phased fixture beside the registry's games. Every test file
 *                 stops its own container (Bingo 12 §7: data created by a test is removed),
 *                 also when a test failed; while it stops, the server's "terminating
 *                 connection" to a client the pool is still ending is expected, not an error.
 * Depends on:     @testcontainers/postgresql, ../src/index
 * Used by:        ./*.integration.test.ts
 * Spec:           Bingo 12 §2, §7
 */
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { InstalledGame } from '@smg-game/registry';
import type { InjectOptions } from 'fastify';
import { vi } from 'vitest';

import { buildApp, createPool, loadEnv, migrate, type App, type DbPool } from '../src/index.js';
import { aheadClock } from '../src/round/guessLimits.js';

// Integration tests hash passwords and share the machine with their databases: in a full run a
// single test can pass Vitest's 5 s default while it is green alone (DECISIONS T39). A file's
// `afterAll` stops and removes its container, which Docker on the development laptop took over
// 10 s to do while other files started or stopped theirs (DECISIONS T206).
vi.setConfig({ testTimeout: 20_000, hookTimeout: 60_000 });

// Starting Postgres can be slow on a cold cache, so give each suite a generous ceiling.
export const SUITE_TIMEOUT_MS = 180_000;

export interface Harness {
  readonly container: StartedPostgreSqlContainer;
  readonly pool: DbPool;
  readonly built: App;
  readonly applied: readonly string[];
}

export async function buildOn(
  pool: DbPool,
  url: string,
  overrides: Record<string, string> = {},
  // The installed games: the registry's unless a test adds the phased fixture (09 §4.2); the
  // play limits' clock, `aheadClock` unless a test gives the real one.
  extra: { readonly games?: readonly InstalledGame[]; readonly limitsNow?: () => number } = {},
): Promise<App> {
  const { games, limitsNow = aheadClock() } = extra;
  const env = loadEnv({
    NODE_ENV: 'test',
    // The suites use the development features (quick sign-in, bots); production tests
    // pass SMG_DEV: '0'.
    SMG_DEV: '1',
    SMG_HOST: '127.0.0.1',
    SMG_PORT: '0',
    SMG_LOG_LEVEL: 'warn',
    DATABASE_URL: url,
    ...overrides,
  });
  const built = await buildApp({ env, pool, limitsNow, ...(games === undefined ? {} : { games }) });
  await built.fastify.ready();
  asFromItsOwnPage(built);
  return built;
}

// A browser names where a write comes from, and the server asks for it (the kit's writeCheck):
// an injected request that names neither Origin nor Sec-Fetch-Site comes from the game's page.
function asFromItsOwnPage(built: App): void {
  const inject = built.fastify.inject.bind(built.fastify) as (o: unknown) => unknown;
  built.fastify.inject = ((options: InjectOptions | string) => {
    if (typeof options === 'string') return inject(options);
    const headers = options.headers ?? {};
    const named = 'origin' in headers || 'sec-fetch-site' in headers;
    return inject(
      named ? options : { ...options, headers: { ...headers, 'sec-fetch-site': 'same-origin' } },
    );
  }) as typeof built.fastify.inject;
}

export async function startHarness(
  overrides: Record<string, string> = {},
  games?: readonly InstalledGame[],
  limitsNow?: () => number,
): Promise<Harness> {
  const container = await new PostgreSqlContainer('postgres:17-alpine').start();
  const pool = createPool(container.getConnectionUri());
  const applied = await migrate(pool);
  const extra = {
    ...(games === undefined ? {} : { games }),
    ...(limitsNow === undefined ? {} : { limitsNow }),
  };
  const built = await buildOn(pool, container.getConnectionUri(), overrides, extra);
  return { container, pool, built, applied };
}

// The server's "terminating connection due to administrator command": what a client the
// pool is still ending hears when its container stops (CI, MG-N11: two unhandled errors after
// a green authorization matrix). That is the shutdown itself; any other error still throws.
const SHUTDOWN = '57P01';

export async function stopHarness(h: Harness): Promise<void> {
  await h.built.fastify.close();
  h.pool.on('error', (e: Error & { code?: string }) => {
    if (e.code !== SHUTDOWN) throw e;
  });
  await h.pool.end();
  await h.container.stop();
}
