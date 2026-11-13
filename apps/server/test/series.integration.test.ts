/**
 * @file   apps/server/test/series.integration.test.ts
 * @module server/test
 * @brief  A series of rounds end to end, with the phased fixture (two rounds, 3 s apart).
 *
 * Responsibility: 04 §4.8 rule 7 and the routes of 06 §3.1. After a round of a series the
 *                 match details name its rounds, those played and the pause's end; the host
 *                 saves the next round's settings (a refused one named with its field) and
 *                 starts the next round at once, others may not, and once a round runs Start
 *                 next round now is ROUND_RUNNING; the next round started without the minimum;
 *                 after the last round's pause the match closes itself with `complete`; a
 *                 match of a guess game is no series.
 * Depends on:     vitest, socket.io-client, @smg-game/registry (and its testing entry), ./*
 * Spec:           docs/spec/04-software-architecture.md §4.8 rule 7; docs/spec/06-data-model-api-realtime.md §3.1
 */
import { GAMES } from '@smg-game/registry';
import { SIDES_FIXTURE, SIDES_PLAN, SIDES_SERIES } from '@smg-game/registry/testing';
import type { Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SUITE_TIMEOUT_MS } from './harness.js';
import { startSocketKit, type SocketKit, type Who } from './socketKit.js';

let kit: SocketKit;
const opened: string[] = [];

beforeAll(async () => {
  kit = await startSocketKit({}, [...GAMES, SIDES_FIXTURE]);
}, SUITE_TIMEOUT_MS);

afterAll(async () => {
  for (const code of opened)
    await kit.clients.host.post(`/api/v1/matches/${code}/abort`, { reason: 'test done' });
  await kit.close();
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, Math.max(0, ms)));

interface Details {
  readonly status: string;
  readonly round: { readonly id: string; readonly status: string } | null;
  readonly series: { rounds: number; played: number; nextAt: number | null } | null;
  readonly ended: { reason: string | null; roundsPlayed: number } | null;
}

const details = async (code: string) =>
  (await kit.clients.host.get(`/api/v1/matches/${code}`)).json<Details>();

async function until(code: string, test: (d: Details) => boolean, ms = 30_000): Promise<Details> {
  const end = Date.now() + ms;
  for (;;) {
    const d = await details(code);
    if (test(d)) return d;
    if (Date.now() > end) throw new Error(`timed out: ${JSON.stringify(d)}`);
    await sleep(200);
  }
}

async function seriesMatch(): Promise<{ code: string; sockets: Socket[] }> {
  const r = await kit.clients.host.post('/api/v1/matches', {
    gameId: 'sides-fixture',
    title: 'series',
    maxPlayers: 10,
  });
  const code = r.json<{ code: string }>().code;
  opened.push(code);
  await kit.clients['player-1'].post(`/api/v1/matches/${code}/join`, {});
  const sockets: Socket[] = [];
  for (const who of ['host', 'player-1'] as Who[]) {
    const s = kit.open(kit.clients[who].cookie);
    expect(await kit.connected(s)).toBe('ok');
    await kit.send(s, 'match.watch', { code });
    sockets.push(s);
  }
  return { code, sockets };
}

describe('a series of rounds (04 §4.8 rule 7)', () => {
  it('pauses, takes the next settings, starts the next round on the host’s click, then closes', async () => {
    const { code, sockets } = await seriesMatch();
    const first = await kit.clients.host.post(`/api/v1/matches/${code}/rounds`, {
      settings: { 'round.countdownS': 3 },
      season: 'summer',
      startNow: true,
    });
    expect(first.statusCode).toBe(201);
    const id = first.json<{ id: string }>().id;
    const pause = await until(code, (d) => d.round?.status === 'ended' && d.series?.nextAt != null);
    expect(pause.series).toMatchObject({ rounds: SIDES_SERIES.rounds, played: 1 });
    // The next round's settings, refused with their field, then kept.
    const bad = await kit.clients.host.put(`/api/v1/matches/${code}/next-round`, {
      settings: { 'round.countdownS': 99 },
    });
    expect(bad.statusCode).toBe(422);
    expect(bad.json<{ field: string }>().field).toBe('round.countdownS');
    const next = { settings: { 'round.countdownS': 4 }, season: 'winter' };
    expect(
      (await kit.clients.host.put(`/api/v1/matches/${code}/next-round`, next)).statusCode,
    ).toBe(204);
    // Only the host starts it; it starts at once, even with one player gone.
    const start = `/api/v1/matches/${code}/next-round/start`;
    expect((await kit.clients['player-1'].post(start, {})).statusCode).toBe(403);
    sockets[1]?.disconnect();
    expect((await kit.clients.host.post(start, {})).statusCode).toBe(204);
    const second = await details(code);
    expect(second.round?.id).not.toBe(id);
    expect(second.round?.status).toBe('countdown');
    const again = await kit.clients.host.post(start, {});
    expect(again.json<{ code: string }>().code).toBe('ROUND_RUNNING');
    const row = await kit.harness.pool.query<{ season: string; countdown: number }>(
      `SELECT season, (settings->'platform'->>'countdownMs')::int AS countdown FROM smg.rounds WHERE id = $1`,
      [second.round?.id],
    );
    expect(row.rows[0]).toEqual({ season: 'winter', countdown: 4_000 });
    // The last round ends, its pause runs out, the match closes itself.
    const closed = await until(
      code,
      (d) => d.status === 'closed',
      4_000 + SIDES_PLAN.endMs + SIDES_SERIES.pauseMs + 10_000,
    );
    expect(closed.ended).toMatchObject({ reason: 'complete', roundsPlayed: 2 });
  }, 90_000);

  it('is no series in a match of a guess game', async () => {
    const r = await kit.clients.host.post('/api/v1/matches', {
      gameId: 'guess-the-number',
      title: 'no series',
      maxPlayers: 10,
    });
    const code = r.json<{ code: string }>().code;
    opened.push(code);
    const put = await kit.clients.host.put(`/api/v1/matches/${code}/next-round`, { settings: {} });
    expect(put.json<{ code: string }>().code).toBe('NOT_A_SERIES');
    expect((await details(code)).series).toBeNull();
  });
});
