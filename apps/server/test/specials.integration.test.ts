/**
 * @file   apps/server/test/specials.integration.test.ts
 * @module server/test
 * @brief  The seasonal specials in real rounds (fast test profile), and the season feed.
 *
 * Responsibility: Leaf Fall strikes numbers for every watcher; Heatwave lowers the cooldown
 *                 for everyone; under Frost an answer reaches the guesser only after the
 *                 delay, `GET …/state` shows nothing of it before (09 §6 "Frost early read")
 *                 and the log records its delivery; Spring Herald's hint is in every player's
 *                 view; the In Season feed (a local test feed, SMG_DEV_FEED_URL) sets the season of a round
 *                 that asks for it, a wrong answer keeps the last good one, halving days from
 *                 an admin allow a halving round, and halving shrinks the range.
 * Depends on:     vitest, node:http, ./socketKit, ./harness, ./session
 * Spec:           docs/spec/03-seasonal-specials.md §2–§4; docs/spec/07-integration.md §5;
 *                 docs/spec/09-testing-strategy.md §4 (journeys 3, 4), §6
 */
import { createServer, type Server } from 'node:http';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SUITE_TIMEOUT_MS } from './harness.js';
import { signIn, type Client } from './session.js';
import { startSocketKit, type SocketKit } from './socketKit.js';

let feedBody: unknown = null;
let feed: Server;

async function startFeed(): Promise<string> {
  feed = createServer((_req, res) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(feedBody));
  });
  await new Promise<void>((r) => feed.listen(0, '127.0.0.1', r));
  const address = feed.address();
  return `http://127.0.0.1:${String(typeof address === 'object' && address !== null ? address.port : 0)}/season`;
}

let kit: SocketKit;
let admin: Client;
const opened: string[] = [];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeAll(async () => {
  const url = await startFeed();
  kit = await startSocketKit({ SMG_DEV_FEED_URL: url });
  admin = await signIn(kit.harness.built.fastify, 'admin');
}, SUITE_TIMEOUT_MS);

afterAll(async () => {
  await new Promise<void>((r) => {
    feed.close(() => {
      r();
    });
  });
  for (const code of opened)
    await kit.clients.host.post(`/api/v1/matches/${code}/abort`, { reason: 'test done' });
  await kit.close();
});

interface Started {
  readonly roundId: string;
  readonly matchCode: string;
}

async function quick(season: string, extra: Record<string, unknown> = {}): Promise<Started> {
  const r = await kit.clients['player-1'].post('/api/v1/dev/quicktest', {
    bots: 1,
    season,
    ...extra,
  });
  expect(r.statusCode).toBe(201);
  const started = r.json<Started>();
  opened.push(started.matchCode);
  return started;
}

async function state(id: string, who: Client = kit.clients['player-1']) {
  return (await who.get(`/api/v1/rounds/${id}/state`)).json<{
    status: string;
    cooldownMs: number;
    opensAt: number;
    game: {
      removed: number[];
      guesses: { value: number; feedback: string | null }[];
      hint: unknown;
      range: { low: number; high: number };
    };
  }>();
}

describe('specials in the fast test profile', () => {
  it('Leaf Fall strikes numbers for everyone and Heatwave lowers the cooldown', async () => {
    const autumn = await quick('autumn');
    const summer = await quick('summer', { cooldownS: 6 });
    const opensAt = (await state(autumn.roundId)).opensAt;
    await sleep(Math.max(0, opensAt - Date.now()) + 5_600);
    const fell = await state(autumn.roundId);
    expect(fell.game.removed.length).toBeGreaterThan(0);
    const spectator = await state(autumn.roundId, kit.clients['player-3']);
    expect(spectator.game.removed).toEqual(fell.game.removed);
    expect((await state(summer.roundId)).cooldownMs).toBeLessThan(6_000);
  }, 40_000);

  it('Spring Herald gives the player a hint at the open', async () => {
    const spring = await quick('spring');
    const opensAt = (await state(spring.roundId)).opensAt;
    await sleep(Math.max(0, opensAt - Date.now()) + 300);
    expect((await state(spring.roundId)).game.hint).toMatchObject({ kind: 'parity' });
  }, 20_000);

  it('Frost delivers an answer after the delay and shows nothing of it before', async () => {
    const winter = await quick('winter', { rangeHigh: 1_000_000 });
    const socket = kit.open(kit.clients['player-1'].cookie);
    expect(await kit.connected(socket)).toBe('ok');
    expect((await kit.send(socket, 'match.watch', { code: winter.matchCode })).ok).toBe(true);
    const opensAt = (await state(winter.roundId)).opensAt;
    await sleep(Math.max(0, opensAt - Date.now()) + 100);
    const arrived = new Promise<number>((resolve) => {
      socket.on(
        'events',
        (frame: { events: { event: { event?: { type?: string } } | null }[] }) => {
          if (frame.events.some((e) => e.event?.event?.type === 'FeedbackGiven'))
            resolve(Date.now());
        },
      );
    });
    const sent = Date.now();
    const ack = await kit.send(socket, 'guess', { roundId: winter.roundId, value: 500_000 });
    expect(ack.ok).toBe(true);
    const early = await state(winter.roundId);
    expect(early.game.guesses).toEqual([
      expect.objectContaining({ value: 500_000, feedback: null }),
    ]);
    expect(JSON.stringify(early)).not.toMatch(/"higher"|"lower"|"correct"/);
    const at = await arrived;
    expect(at - sent).toBeGreaterThanOrEqual(2_900);
    expect((await state(winter.roundId)).game.guesses[0]?.feedback).toMatch(/higher|lower|correct/);
    const log = await kit.harness.built.runtime.store.log(winter.roundId);
    expect(log.some((e) => e.type === 'HeldDelivered')).toBe(true);
  }, 30_000);
});

async function inSeasonRound(): Promise<string> {
  const code = await kit.openMatch(['player-1']);
  opened.push(code);
  const created = await kit.clients.host.post(`/api/v1/matches/${code}/rounds`, {});
  expect(created.statusCode).toBe(201);
  const id = created.json<{ id: string }>().id;
  const row = await kit.harness.pool.query(
    'SELECT season, season_source FROM smg.rounds WHERE id = $1',
    [id],
  );
  expect(row.rows[0]).toEqual({ season: 'winter', season_source: 'inSeason' });
  await kit.clients.host.post(`/api/v1/rounds/${id}/abort`, { reason: 'next' });
  return code;
}

describe('In Season', () => {
  it('takes the season from the feed and keeps the last good answer', async () => {
    const winter = { season: 'winter', token: 'WINTER', since: '2026-10-01T00:00:00Z' };
    feedBody = { v: 1, inSeason: winter, extra: true };
    const refreshed = (await admin.post('/api/v1/admin/seasons/feed/refresh', {})).json<unknown>();
    expect(refreshed).toEqual({ ok: true });
    const current = await kit.clients['player-1'].get('/api/v1/seasons/current');
    expect(current.json<unknown>()).toMatchObject({
      inSeason: { season: 'winter' },
      halvingToday: null,
    });
    feedBody = { v: 2 };
    const wrong = await admin.post('/api/v1/admin/seasons/feed/refresh', {});
    expect(wrong.json<unknown>()).toMatchObject({ ok: false });
    const kept = (await admin.get('/api/v1/admin/seasons/feed')).json<{
      inSeason: { season: string };
      lastError: string;
    }>();
    expect(kept.inSeason.season).toBe('winter');
    expect(kept.lastError).toMatch(/wrong shape/);
    // A round without a season of its own takes the season In Season reports.
    await inSeasonRound();
  }, 40_000);
});

describe('halving days', () => {
  it('allow a halving round only on a halving day an admin entered', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const code = await kit.openMatch(['player-1']);
    opened.push(code);
    const rounds = `/api/v1/matches/${code}/rounds`;
    const halving = { settings: { 'round.halving': true }, season: 'spring' };
    expect((await kit.clients.host.post(rounds, halving)).json<unknown>()).toMatchObject({
      code: 'NOT_A_HALVING_DAY',
    });
    const added = await admin.post('/api/v1/admin/halving-days', { day: today, token: 'SPRING' });
    expect(added.statusCode).toBe(204);
    expect((await kit.clients.host.post(rounds, halving)).statusCode).toBe(201);
    expect((await admin.get('/api/v1/admin/halving-days')).json<unknown>()).toMatchObject({
      days: [{ day: today, token: 'SPRING', source: 'admin' }],
    });
    const removed = await kit.harness.built.fastify.inject({
      method: 'DELETE',
      url: `/api/v1/admin/halving-days/${today}/SPRING`,
      headers: { cookie: admin.cookie, 'x-csrf-token': admin.csrf },
    });
    expect(removed.statusCode).toBe(204);
  }, 40_000);

  it('halve the range of a halving round (fast profile)', async () => {
    const today = new Date().toISOString().slice(0, 10);
    await admin.post('/api/v1/admin/halving-days', { day: today, token: 'TEST' });
    const r = await kit.clients['player-1'].post('/api/v1/dev/quicktest', {
      bots: 1,
      season: 'spring',
      halving: true,
    });
    expect(r.statusCode).toBe(201);
    const started = r.json<Started>();
    opened.push(started.matchCode);
    const opensAt = (await state(started.roundId)).opensAt;
    await sleep(Math.max(0, opensAt - Date.now()) + 6_400);
    const range = (await state(started.roundId)).game.range;
    expect(range.high - range.low + 1).toBe(500);
  }, 30_000);
});
