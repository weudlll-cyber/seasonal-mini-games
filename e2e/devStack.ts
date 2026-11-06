/**
 * @file   e2e/devStack.ts
 * @module e2e
 * @brief  Ports and database URL of the local dev stack, read from ops/.env.dev.example.
 *
 * Responsibility: one place for the project's fixed ports (server 3910, player client
 *                 5410, admin app 5411, test host site 5420; journey 36's website-mode server 3930 behind
 *                 the stand-in website on 5430) and the DATABASE_URL built from the dev env file, so the e2e
 *                 config never repeats credentials (also for another database of the same
 *                 PostgreSQL, as journey 36 uses).
 * Depends on:     ops/.env.dev.example
 * Used by:        ./playwright.config.ts, ./globalSetup.ts, ./screens, ./embed.spec,
 *                 ./websiteStack
 * Spec:           docs/spec/10-repository-structure.md §4; Bingo 08 §1, §8
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
export const ENV_FILE = 'ops/.env.dev.example';
export const COMPOSE_FILE = 'ops/compose.dev.yml';
export const SERVER_URL = 'http://127.0.0.1:3910';
export const CLIENT_URL = 'http://127.0.0.1:5410';
export const ADMIN_URL = 'http://127.0.0.1:5411';
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

// The dev database, or another database of the same PostgreSQL (journey 36's own, T241).
export function databaseUrl(database?: string): string {
  const env = readEnvFile();
  const get = (key: string): string => {
    const value = env.get(key);
    if (value === undefined) throw new Error(`${ENV_FILE} has no ${key}`);
    return value;
  };
  const user = encodeURIComponent(get('POSTGRES_USER'));
  const password = encodeURIComponent(get('POSTGRES_PASSWORD'));
  return `postgres://${user}:${password}@127.0.0.1:${get('SMG_DEV_POSTGRES_PORT')}/${database ?? get('POSTGRES_DB')}`;
}
