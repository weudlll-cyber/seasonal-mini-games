/**
 * @file   apps/server/test/openRounds.integration.test.ts
 * @module server/test
 * @brief  The website's open-rounds status: the contract's shape, its limits and what it lists.
 *
 * Responsibility: owner decisions O124 and O125 against Postgres. `GET /api/public/open-rounds`
 *                 needs no sign-in, is cacheable for 30 s and answers version 1 of the website's
 *                 contract (the kit's openRoundsPage checks each entry); it lists a match opened from the form (on by default) with
 *                 the match code, its title, "Seasonal Mini Games · <game>", the player counts
 *                 and a https join URL to the match, and never a match its host switched off, an
 *                 ended or full one, or a Quick Test even with the option set; at most 20,
 *                 never a player's name. Only the host switches the option, never on a Quick
 *                 Test. With a public address the join URL is the match's page under it. The
 *                 matches made here are aborted.
 * Depends on:     vitest, fastify, @seasonal/kit/server (types), ../src/http/routes/openRounds,
 *                 ../src/match/matches, ./harness, ./session
 * Spec:           docs/spec/07-integration.md §8
 */
import type { OpenRoundsPage } from '@seasonal/kit/server';
import Fastify from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { registerOpenRounds } from '../src/http/routes/openRounds.js';
import { openMatch } from '../src/match/matches.js';
import { startHarness, stopHarness, SUITE_TIMEOUT_MS, type Harness } from './harness.js';
import { signIn, type Client } from './session.js';

let h: Harness;
let host: Client;
let player: Client;

beforeAll(async () => {
  h = await startHarness();
  host = await signIn(h.built.fastify, 'host');
  player = await signIn(h.built.fastify, 'player-1');
}, SUITE_TIMEOUT_MS);
afterAll(async () => {
  await h.pool.query(
    "UPDATE smg.matches SET status = 'aborted', aborted_reason = 'test done' WHERE status IN ('lobby', 'open')",
  );
  await stopHarness(h);
}, SUITE_TIMEOUT_MS);

const status = async () => {
  const r = await h.built.fastify.inject({ method: 'GET', url: '/api/public/open-rounds' });
  const body = r.json<OpenRoundsPage>();
  expect(body.version).toBe(1);
  return { r, body };
};
const opened = async (title: string, change: object = {}) => {
  const r = await host.post('/api/v1/matches', {
    gameId: 'safecracker',
    title,
    maxPlayers: 10,
    ...change,
  });
  return r.json<{ code: string; showOnWebsite: boolean }>();
};
const hostId = async () =>
  (await host.get('/api/v1/session')).json<{ account: { id: string } }>().account.id;

describe('the open-rounds status (O124)', () => {
  it('lists a match opened from the form, in the contract, without a name', async () => {
    const m = await opened('Friday night');
    expect(m.showOnWebsite).toBe(true);
    const { r, body } = await status();
    expect(r.statusCode).toBe(200);
    expect(r.headers['cache-control']).toBe('public, max-age=30');
    expect(body.rounds).toEqual([
      {
        id: m.code,
        title: 'Friday night',
        kind: 'Seasonal Mini Games · Safecracker',
        startsAt: null,
        signupClosesAt: null,
        players: 1,
        maxPlayers: 10,
        joinUrl: expect.stringMatching(new RegExp(`^https://.+#/match/${m.code}$`)) as string,
      },
    ]);
    expect(r.body).not.toMatch(/dev-host/);
  });

  it('never lists a match switched off, ended, full, or a Quick Test', async () => {
    const off = await opened('Hidden', { showOnWebsite: false });
    const later = await opened('Switched off later');
    expect(
      (await player.put(`/api/v1/matches/${later.code}/website`, { show: false })).statusCode,
    ).toBe(403);
    expect(
      (await host.put(`/api/v1/matches/${later.code}/website`, { show: false })).statusCode,
    ).toBe(204);
    const ended = await opened('Ended');
    await host.post(`/api/v1/matches/${ended.code}/abort`, { reason: 'test' });
    const full = await opened('Full', { maxPlayers: 2 });
    await player.post(`/api/v1/matches/${full.code}/join`, {});
    const quick = await openMatch(h.pool, {
      gameId: 'safecracker',
      title: 'Quick Test',
      visibility: 'unlisted',
      maxPlayers: 10,
      countsForLeaderboard: false,
      teamMatch: false,
      hostId: await hostId(),
      showOnWebsite: true,
      quickTest: true,
    });
    const put = await host.put(`/api/v1/matches/${quick.code}/website`, { show: true });
    expect(put.json<{ code: string }>().code).toBe('QUICK_TEST');
    const ids = (await status()).body.rounds.map((e) => e.id);
    for (const code of [off.code, later.code, ended.code, full.code, quick.code])
      expect(ids).not.toContain(code);
  });
});

describe('the open-rounds status: its limit and its join URL (O124)', () => {
  it('lists at most 20', async () => {
    for (let i = 0; i < 22; i += 1) {
      await openMatch(h.pool, {
        gameId: 'mind-games',
        title: `Many ${String(i)}`,
        visibility: 'public',
        maxPlayers: 10,
        countsForLeaderboard: true,
        teamMatch: false,
        hostId: await hostId(),
        showOnWebsite: true,
      });
    }
    const { body } = await status();
    expect(body.rounds).toHaveLength(20);
    expect(body.rounds.some((e) => e.kind === 'Seasonal Mini Games · Mind Games')).toBe(true);
  });

  it('builds the join URL under the configured public address', async () => {
    const app = Fastify();
    registerOpenRounds(app, {
      pool: h.pool,
      rounds: h.built.runtime.rounds,
      publicUrl: 'https://example.org/games/mini-games',
    });
    const r = await app.inject({ method: 'GET', url: '/api/public/open-rounds' });
    const first = r.json<OpenRoundsPage>().rounds[0];
    expect(first?.joinUrl).toBe(`https://example.org/games/mini-games/#/match/${first?.id ?? ''}`);
    await app.close();
  });
});
