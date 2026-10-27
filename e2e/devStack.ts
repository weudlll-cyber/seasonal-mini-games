/**
 * @file   e2e/devStack.ts
 * @module e2e
 * @brief  Ports and database URL of the local dev stack, read from ops/.env.dev.example.
 *
 * Responsibility: one place for the project's fixed ports (server 3910, player client
 *                 5410, admin app 5411, test host site 5420) and the DATABASE_URL built from the dev env file, so the e2e
 *                 config never repeats credentials.
 * Depends on:     ops/.env.dev.example
 * Used by:        ./playwright.config.ts, ./globalSetup.ts, ./screens, ./embed.spec
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

export function databaseUrl(): string {
  const env = readEnvFile();
  const get = (key: string): string => {
    const value = env.get(key);
    if (value === undefined) throw new Error(`${ENV_FILE} has no ${key}`);
    return value;
  };
  const user = encodeURIComponent(get('POSTGRES_USER'));
  const password = encodeURIComponent(get('POSTGRES_PASSWORD'));
  return `postgres://${user}:${password}@127.0.0.1:${get('SMG_DEV_POSTGRES_PORT')}/${get('POSTGRES_DB')}`;
}
