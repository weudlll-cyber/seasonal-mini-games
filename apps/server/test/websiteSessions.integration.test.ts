/**
 * @file   apps/server/test/websiteSessions.integration.test.ts
 * @module server/test
 * @brief  Website mode: how long a game session lives (DECISIONS T280).
 *
 * Responsibility: a server in website mode and a local one on the same database. A player
 *                 session from the website's sign-in and a website guest session end 7 days
 *                 after they start, the same as Bingo's; an admin session from the website
 *                 keeps 8 hours absolute and 30 minutes idle; a local player and a local guest
 *                 keep 30 days.
 * Depends on:     vitest, ../src/index (types), ./harness, ./websiteHelpers
 * Spec:           docs/spec/07-integration.md §7; Bingo 03 §3
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { App } from '../src/index.js';
import { buildOn, startHarness, stopHarness, SUITE_TIMEOUT_MS, type Harness } from './harness.js';
import { BASE, signedIn, WEBSITE } from './websiteHelpers.js';

let harness: Harness;
let local: App;

beforeAll(async () => {
  harness = await startHarness(WEBSITE);
  local = await buildOn(harness.pool, harness.container.getConnectionUri());
}, SUITE_TIMEOUT_MS);
afterAll(async () => {
  await local.fastify.close();
  await stopHarness(harness);
}, SUITE_TIMEOUT_MS);

interface Lifetime {
  kind: string;
  hours: number;
  idleMinutes: number;
}

// The newest session's absolute lifetime in hours and idle span in minutes, for an account
// or (null) for a guest.
async function lifetime(accountId: string | null): Promise<Lifetime | undefined> {
  const r = await harness.pool.query<Lifetime>(
    `SELECT kind,
       round(extract(epoch FROM expires_at - created_at) / 3600)::int AS hours,
       round(extract(epoch FROM idle_expires_at - last_seen_at) / 60)::int AS "idleMinutes"
     FROM smg.sessions WHERE account_id IS NOT DISTINCT FROM $1
     ORDER BY created_at DESC LIMIT 1`,
    [accountId],
  );
  return r.rows[0];
}

const DAY_H = 24;

describe('session lifetimes in website mode (T280)', () => {
  it('ends a player session 7 days after the website sign-in', async () => {
    const who = await signedIn(harness.built, { id: '301', name: 'Weekly' });
    const id = who.session.account?.id ?? null;
    expect(await lifetime(id)).toEqual({ kind: 'player', hours: 7 * DAY_H, idleMinutes: 7 * 1440 });
  });

  it('keeps an admin session at 8 hours and 30 minutes idle', async () => {
    const who = await signedIn(harness.built, { id: '302', name: 'Admina', roles: 'admin' });
    const id = who.session.account?.id ?? null;
    expect(await lifetime(id)).toEqual({ kind: 'admin', hours: 8, idleMinutes: 30 });
  });

  it('ends a website guest session after 7 days and a local guest after 30', async () => {
    const guest = await harness.built.fastify.inject({
      method: 'POST',
      url: `${BASE}api/v1/auth/guest`,
      payload: {},
    });
    expect(guest.statusCode).toBe(201);
    expect((await lifetime(null))?.hours).toBe(7 * DAY_H);
    const there = await local.fastify.inject({
      method: 'POST',
      url: '/api/v1/auth/guest',
      payload: {},
    });
    expect(there.statusCode).toBe(201);
    expect((await lifetime(null))?.hours).toBe(30 * DAY_H);
  });

  it('keeps 30 days for a local player', async () => {
    const r = await local.fastify.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'monthly@example.org',
        displayName: 'Monthly',
        password: 'a-long-test-passphrase-30d',
      },
    });
    expect(r.statusCode).toBe(201);
    const id = r.json<{ accountId: string }>().accountId;
    expect(await lifetime(id)).toEqual({
      kind: 'player',
      hours: 30 * DAY_H,
      idleMinutes: 7 * 1440,
    });
    await harness.pool.query('DELETE FROM smg.accounts WHERE id = $1', [id]);
  });
});
