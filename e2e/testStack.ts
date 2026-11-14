/**
 * @file   e2e/testStack.ts
 * @module e2e
 * @brief  Ports and database of the browser tests' own stack, apart from the developer's.
 *
 * Responsibility: one place for the ports a Playwright run uses (server 3940, player client
 *                 5440, admin app 5441, test host site 5420; journey 36's website-mode server
 *                 3930 behind the stand-in website on 5430), none of them a port of `pnpm dev`
 *                 (3910, 5410, 5411), and the URL of a database of the development PostgreSQL
 *                 built from its env file: the run's own `smg_test` (recreated empty at every
 *                 start by apps/server/tools/testServer), or another one (journey 36's), never
 *                 the developer's `smg` (09 §1.1, DECISIONS T345).
 * Depends on:     ops/.env.dev.example
 * Used by:        ./playwright.config.ts, ./play, ./screens, ./builtAdmin, ./hostSite, the
 *                 specs that open the admin app, the host site or the database, ./websiteStack
 * Spec:           docs/spec/09-testing-strategy.md §1.1; docs/spec/10-repository-structure.md §4
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
export const ENV_FILE = 'ops/.env.dev.example';
export const COMPOSE_FILE = 'ops/compose.dev.yml';
export const SERVER_PORT = 3940;
export const CLIENT_PORT = 5440;
export const ADMIN_PORT = 5441;
export const SERVER_URL = `http://127.0.0.1:${String(SERVER_PORT)}`;
export const CLIENT_URL = `http://127.0.0.1:${String(CLIENT_PORT)}`;
export const ADMIN_URL = `http://127.0.0.1:${String(ADMIN_PORT)}`;
// The run's database; the test server recreates it empty, so every run starts clean.
export const TEST_DATABASE = 'smg_test';
// Development only: the test host site that embeds the game (./host-page, journey 8).
export const HOST_PAGE_URL = 'http://127.0.0.1:5420';
// Journey 36 (T241): a server in website mode, reached only through the stand-in website's
// nginx, which serves the game under /games/mini-games/ as the real website does.
export const WEBSITE_SERVER_PORT = 3930;
export const WEBSITE_URL = 'http://127.0.0.1:5430';

function readEnvFile(): Map<string, string> {
  const text = readFileSync(new URL(`../${ENV_FILE}`, import.meta.url), 'utf8');
  const entries = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
    .map((line) => {
      const at = line.indexOf('=');
      return [line.slice(0, at), line.slice(at + 1)] as const;
    });
  return new Map(entries);
}

// A database of the development PostgreSQL: the run's own, or journey 36's (T241).
export function databaseUrl(database = TEST_DATABASE): string {
  const env = readEnvFile();
  const get = (key: string): string => {
    const value = env.get(key);
    if (value === undefined) throw new Error(`${ENV_FILE} has no ${key}`);
    return value;
  };
  const user = encodeURIComponent(get('POSTGRES_USER'));
  const password = encodeURIComponent(get('POSTGRES_PASSWORD'));
  return `postgres://${user}:${password}@127.0.0.1:${get('SMG_DEV_POSTGRES_PORT')}/${database}`;
}
