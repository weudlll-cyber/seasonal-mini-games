/**
 * @file   apps/server/test/websiteFeed.integration.test.ts
 * @module server/test
 * @brief  Website mode: the account-changes feed's poller against a stub website (O66).
 *
 * Responsibility: a stub of the website's feed (node:http on 127.0.0.1, refusing a wrong
 *                 token with 401) and a server in website mode. One poll applies the changes in
 *                 order and asks again until `next` stops changing: `deleted` makes the account
 *                 "Deleted player" in the match it played, drops it from the leaderboard while
 *                 its points stay stored, and ends its sessions; `locked` and `rights` end the
 *                 sessions; `unlocked` and an unknown id change nothing; the cursor is stored
 *                 and sent as `since`; GET /readyz names the last success (local mode does not).
 *                 A failing feed is logged without the token and retried later. After a member
 *                 deleted their own account (DELETE /me, a hard delete), every change for that
 *                 website user id is a no-op: no error, nothing logged, the cursor moves on.
 *                 A kind the game does not know neither refuses the page nor stalls the
 *                 cursor: it is logged once and ends the sessions, as `rights` does.
 * Depends on:     vitest, node:http, ../src/integration/accountFeed, ./harness, ./websiteHelpers
 * Spec:           docs/spec/07-integration.md §7; docs/spec/06-data-model-api-realtime.md §2.9
 */
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  pollAccountFeed,
  startAccountFeed,
  type AccountFeedDeps,
} from '../src/integration/accountFeed.js';
import type { App } from '../src/index.js';
import { buildOn, startHarness, stopHarness, SUITE_TIMEOUT_MS, type Harness } from './harness.js';
import {
  BASE,
  callWith,
  ORIGIN,
  sessionOf,
  signedIn,
  SYNC_TOKEN,
  WEBSITE,
} from './websiteHelpers.js';

let harness: Harness;
let local: App;
let stub: Server;
let stubUrl = '';
// What the stub answers to each `since`, and the `since` values it was asked for.
let pages: Record<string, { status?: number; body: unknown }> = {};
const asked: string[] = [];

beforeAll(async () => {
  harness = await startHarness(WEBSITE);
  local = await buildOn(harness.pool, harness.container.getConnectionUri());
  stub = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://stub');
    const since = url.searchParams.get('since') ?? '';
    asked.push(since);
    const ok = req.headers['x-games-sync-token'] === SYNC_TOKEN;
    const page = ok ? (pages[since] ?? { body: { changes: [], next: since } }) : null;
    res.writeHead(page === null ? 401 : (page.status ?? 200), {
      'content-type': 'application/json',
    });
    res.end(JSON.stringify(page?.body ?? { error: 'unauthorized' }));
  });
  await new Promise<void>((resolve) => stub.listen(0, '127.0.0.1', resolve));
  stubUrl = `http://127.0.0.1:${String((stub.address() as AddressInfo).port)}`;
}, SUITE_TIMEOUT_MS);
afterAll(async () => {
  await new Promise((resolve) => stub.close(resolve));
  await local.fastify.close();
  await stopHarness(harness);
}, SUITE_TIMEOUT_MS);

const lines: string[] = [];
const feed = (over: Partial<AccountFeedDeps> = {}): AccountFeedDeps => ({
  pool: harness.pool,
  issuer: ORIGIN,
  localUrl: stubUrl,
  token: SYNC_TOKEN,
  sessionEnds: harness.built.sessionEnds,
  log: {
    info: (details, message) => lines.push(JSON.stringify({ details, message })),
    warn: (details, message) => lines.push(JSON.stringify({ details, message })),
  },
  ...over,
});

const signedInStill = async (cookie: string | null) =>
  (await sessionOf(harness.built, cookie)).signedIn;

// Five members: a host with a match the one to be deleted plays in, with league points.
async function members() {
  const [host, gone, locked, rights, free] = await Promise.all(
    [
      { id: '50', name: 'Hostess', canHost: 'true' as const },
      { id: '51', name: 'Goner' },
      { id: '52', name: 'Locky' },
      { id: '53', name: 'Righty' },
      { id: '54', name: 'Freddy' },
    ].map((m) => signedIn(harness.built, m)),
  );
  if (!host || !gone || !locked || !rights || !free) throw new Error('members');
  const made = await callWith(harness.built, host, 'matches', {
    gameId: 'guess-the-number',
    title: 'feed',
    maxPlayers: 10,
  });
  const code = made.json<{ code: string }>().code;
  await callWith(harness.built, gone, `matches/${code}/join`, {});
  const period = await harness.pool.query<{ id: string }>(
    `INSERT INTO smg.league_entries (period_id, account_id, points, wins, solves, matches)
     SELECT id, $1, 7, 1, 1, 1 FROM smg.leaderboard_periods WHERE kind = 'all_time'
     RETURNING period_id::text AS id`,
    [gone.session.account?.id],
  );
  return { host, gone, locked, rights, free, code, periodId: period.rows[0]?.id ?? '' };
}

const CHANGES = [
  { id: 52, kind: 'locked' },
  { id: 53, kind: 'rights' },
  { id: 54, kind: 'unlocked' },
  { id: 51, kind: 'deleted' },
  { id: 999, kind: 'deleted' },
];

describe('the account-changes feed (O66)', () => {
  it('applies deleted, locked, rights and unlocked in order and keeps the cursor', async () => {
    const m = await members();
    pages = { '0': { body: { changes: CHANGES, next: '5' } } };
    expect(await pollAccountFeed(feed())).toBe(5);
    expect(asked.slice(-2)).toEqual(['0', '5']);
    const still = [m.gone, m.locked, m.rights, m.free].map((w) => signedInStill(w.cookie));
    expect(await Promise.all(still)).toEqual([false, false, false, true]);
    const details = await callWith(harness.built, m.host, `matches/${m.code}`);
    const names = details.json<{ players: { name: string }[] }>().players.map((p) => p.name);
    expect(names).toContain('Deleted player');
    expect(names).not.toContain('Goner');
    const board = await callWith(harness.built, m.host, `leaderboards/${m.periodId}`);
    expect(board.json<{ rows: unknown[] }>().rows).toEqual([]);
    const kept = await harness.pool.query(
      'SELECT points FROM smg.league_entries WHERE account_id = $1',
      [m.gone.session.account?.id],
    );
    expect(kept.rows).toEqual([{ points: 7 }]);
    await callWith(harness.built, m.host, `matches/${m.code}/abort`, { reason: 'test' });
    // Five sign-ins, a match and a league row: past the 20 s default under a full parallel run.
  }, 60_000);
});

describe('the feed later (O66)', () => {
  it('asks from the stored cursor next time and names the last success in /readyz', async () => {
    asked.length = 0;
    expect(await pollAccountFeed(feed())).toBe(0);
    expect(asked).toEqual(['5']);
    const ready = await harness.built.fastify.inject({ method: 'GET', url: `${BASE}readyz` });
    const at = ready.json<{ websiteFeed: { lastSuccessAt: string } }>().websiteFeed.lastSuccessAt;
    expect(Date.now() - Date.parse(at)).toBeLessThan(60_000);
    const there = await local.fastify.inject({ method: 'GET', url: '/readyz' });
    expect(there.json()).toEqual({ status: 'ready' });
  });

  it('logs a failing feed without the token and tries again later', async () => {
    lines.length = 0;
    const failures = [
      feed({ token: 'a-wrong-token-that-must-not-be-logged' }),
      feed({ localUrl: 'http://127.0.0.1:9' }),
    ];
    pages = { '5': { body: { changes: [{ id: 'x' }], next: '6' } } };
    failures.push(feed());
    for (const deps of failures) {
      const stop = startAccountFeed(deps);
      await expect.poll(() => lines.length, { timeout: 15_000 }).toBeGreaterThan(0);
      stop();
      expect(lines.join('\n')).toMatch(/website account feed failed/);
      expect(lines.join('\n')).not.toContain(deps.token);
      lines.length = 0;
    }
    const state = await harness.pool.query<{ cursor: string; failed: boolean }>(
      'SELECT cursor, last_failure_at IS NOT NULL AS failed FROM smg.website_feed',
    );
    expect(state.rows).toEqual([{ cursor: '5', failed: true }]);
    // Three poller starts, each waiting up to 15 s for its first log line.
  }, 60_000);
});

describe('changes for an account its member deleted (DELETE /me)', () => {
  it('are no-ops: no error, no warning, the cursor moves on', async () => {
    const gone = await signedIn(harness.built, { id: '55', name: 'Selfie' });
    const deleted = await harness.built.fastify.inject({
      method: 'DELETE',
      url: `${BASE}api/v1/me`,
      headers: { cookie: gone.cookie ?? '', 'x-csrf-token': gone.session.csrfToken ?? '' },
      payload: { confirm: gone.session.account?.displayName },
    });
    expect(deleted.statusCode).toBe(204);
    const changes = ['deleted', 'locked', 'unlocked', 'rights'].map((kind) => ({ id: 55, kind }));
    pages = { '5': { body: { changes, next: '9' } } };
    lines.length = 0;
    const stop = startAccountFeed(feed());
    await expect.poll(() => lines.length, { timeout: 15_000 }).toBeGreaterThan(0);
    stop();
    expect(lines).toEqual([
      JSON.stringify({ details: { applied: 4 }, message: 'website account changes applied' }),
    ]);
    const state = await harness.pool.query<{ cursor: string }>(
      'SELECT cursor FROM smg.website_feed',
    );
    expect(state.rows).toEqual([{ cursor: '9' }]);
  }, 60_000);
});

describe('a kind the game does not know', () => {
  it('is logged once, handled like rights, and the cursor moves on', async () => {
    const member = await signedIn(harness.built, { id: '56', name: 'Newkind' });
    const twice = [56, 999].map((id) => ({ id, kind: 'password-reset' }));
    pages = {
      '9': { body: { changes: [...twice, { id: 999, kind: 'locked' }], next: '12' } },
      '12': { body: { changes: [{ id: 999, kind: 'password-reset' }], next: '13' } },
    };
    lines.length = 0;
    expect(await pollAccountFeed(feed())).toBe(4);
    expect(await signedInStill(member.cookie)).toBe(false);
    expect(lines).toEqual([
      JSON.stringify({
        details: { kind: 'password-reset' },
        message: 'website account feed: unknown kind handled as rights',
      }),
    ]);
    const state = await harness.pool.query<{ cursor: string }>(
      'SELECT cursor FROM smg.website_feed',
    );
    expect(state.rows).toEqual([{ cursor: '13' }]);
  }, 60_000);
});
