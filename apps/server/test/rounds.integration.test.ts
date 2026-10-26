/**
 * @file   apps/server/test/rounds.integration.test.ts
 * @module server/test
 * @brief  A real round over sockets and HTTP with Postgres: lifecycle, order, cooldown,
 *         winning, results, proof, persistence and recovery after a restart.
 *
 * Responsibility: a shared round from creation to result (the host on the roster, guesses
 *                 refused before the open, the cooldown held across socket and HTTP, the first
 *                 correct guess wins and later ones are ROUND_OVER, results, standings and the
 *                 fairness proof); frames carry no guessed value to the room and a player's
 *                 answers only to that player; the event log is gap-free and append-only; a
 *                 second server on the same database recovers a running round with its
 *                 cooldowns; one round at a time and team locks; matches are aborted at the end.
 * Depends on:     vitest, ./socketKit, ./harness
 * Spec:           docs/spec/02-game-guess-the-number.md §4–§10; docs/spec/04-software-architecture.md §5;
 *                 docs/spec/06-data-model-api-realtime.md §2–§4; docs/spec/09-testing-strategy.md §2, §6
 */
import type { Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildOn, SUITE_TIMEOUT_MS } from './harness.js';
import { startSocketKit, type SocketKit, type Who } from './socketKit.js';

let kit: SocketKit;
const opened: string[] = [];

beforeAll(async () => {
  kit = await startSocketKit();
}, SUITE_TIMEOUT_MS);

afterAll(async () => {
  for (const code of opened)
    await kit.clients.host.post(`/api/v1/matches/${code}/abort`, { reason: 'test done' });
  await kit.close();
});

async function until<T>(probe: () => Promise<T | null>, ms = 20_000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await probe();
    if (v !== null) return v;
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 100));
  }
}

async function watching<W extends Who>(
  code: string,
  who: readonly W[],
): Promise<Record<W, Socket>> {
  const sockets: Partial<Record<W, Socket>> = {};
  for (const w of who) {
    const s = kit.open(kit.clients[w].cookie);
    expect(await kit.connected(s)).toBe('ok');
    expect((await kit.send(s, 'match.watch', { code })).ok).toBe(true);
    sockets[w] = s;
  }
  return sockets as Record<W, Socket>;
}

async function newRound(code: string, settings: Record<string, unknown> = {}) {
  const r = await kit.clients.host.post(`/api/v1/matches/${code}/rounds`, {
    settings: { 'round.cooldownS': 3, 'round.countdownS': 3, ...settings },
    season: 'spring',
  });
  expect(r.statusCode).toBe(201);
  return r.json<{ id: string }>().id;
}

async function openAt(roundId: string): Promise<void> {
  const state = await kit.clients['player-1'].get(`/api/v1/rounds/${roundId}/state`);
  const opensAt = state.json<{ opensAt: number }>().opensAt;
  await new Promise((r) => setTimeout(r, Math.max(0, opensAt - Date.now()) + 50));
}

// Guesses of a started shared round: refused before the open, the cooldown held from the
// socket and the HTTP fallback, the first correct guess wins, later ones are ROUND_OVER.
async function playShared(s: Record<'player-1' | 'player-2', Socket>, id: string, secret: number) {
  const wrong = secret === 1 ? 2 : secret - 1;
  const p1 = s['player-1'];
  const p2 = s['player-2'];
  expect(await kit.send(p1, 'guess', { roundId: id, value: wrong })).toMatchObject({
    code: 'ROUND_NOT_OPEN',
  });
  await openAt(id);
  const first = await kit.send(p1, 'guess', { roundId: id, value: wrong });
  expect(first).toMatchObject({ ok: true, receiveSeq: 1 });
  expect(await kit.send(p1, 'guess', { roundId: id, value: wrong + 2 })).toMatchObject({
    code: 'COOLDOWN_ACTIVE',
    until: first.cooldownEndsAt,
  });
  const http = await kit.clients['player-1'].post(`/api/v1/rounds/${id}/guesses`, {
    value: wrong + 2,
  });
  expect(http.json<unknown>()).toMatchObject({ code: 'COOLDOWN_ACTIVE' });
  expect(await kit.send(p2, 'guess', { roundId: id, value: secret })).toMatchObject({
    ok: true,
    receiveSeq: 2,
  });
  expect(await kit.send(p2, 'guess', { roundId: id, value: wrong })).toMatchObject({
    code: 'ROUND_OVER',
  });
}

async function checkResult(id: string, secret: number, winner: string) {
  const result = (await kit.clients['player-1'].get(`/api/v1/rounds/${id}/result`)).json<{
    role: string;
    winner: string;
    seed: string;
    game: { secret: number };
    results: { playerId: string; place: number | null; points: number }[];
  }>();
  expect(result).toMatchObject({ role: 'result', winner, game: { secret } });
  expect(result.results[0]).toMatchObject({ playerId: winner, place: 1, points: 10 });
  expect(result.seed).toMatch(/^[0-9a-f]{64}$/);
  const verify = (await kit.clients['player-1'].get(`/api/v1/rounds/${id}/verify`)).json<unknown>();
  expect(verify).toMatchObject({ ok: true, secrets: { mode: 'shared', value: secret } });
}

describe('a shared round', () => {
  it('runs from creation to result with order, cooldown and a single winner', async () => {
    const code = await kit.openMatch(['player-1', 'player-2']);
    opened.push(code);
    const s = await watching(code, ['host', 'player-1', 'player-2']);
    const id = await newRound(code);
    const again = await kit.clients.host.post(`/api/v1/matches/${code}/rounds`, {
      season: 'spring',
    });
    expect(again.json<unknown>()).toMatchObject({ code: 'ROUND_RUNNING' });
    expect((await kit.send(s.host, 'round.start', { roundId: id })).ok).toBe(true);
    const [p1, p2] = [await kit.accountId('player-1'), await kit.accountId('player-2')];
    const host = await kit.accountId('host');
    const state = (await kit.clients.host.get(`/api/v1/rounds/${id}/state`)).json<{
      roster: { playerKey: string }[];
      role: string;
    }>();
    // The host joined first and plays along with a player's view (O16); teams lock while
    // the round runs.
    expect(state.roster.map((r) => r.playerKey)).toEqual([host, p1, p2]);
    expect(state.role).toBe('player');
    const team = await kit.clients['player-1'].post(`/api/v1/matches/${code}/team`, {
      team: 'winter',
    });
    expect(team.json<unknown>()).toMatchObject({ code: 'TEAMS_LOCKED' });
    const secrets = await kit.secretsOf(id);
    const secret = secrets.mode === 'shared' ? secrets.value : 0;
    await playShared(s, id, secret);
    await checkResult(id, secret, p2);
    await checkStorage(id, code, p2);
    await checkFrames(s, id, p1);
  }, 60_000);
});

async function checkStorage(roundId: string, code: string, winner: string) {
  const pool = kit.harness.pool;
  const seqs = await pool.query<{ seq: string }>(
    'SELECT seq FROM smg.round_events WHERE round_id = $1 ORDER BY seq',
    [roundId],
  );
  expect(seqs.rows.map((r) => Number(r.seq))).toEqual(seqs.rows.map((_, i) => i + 1));
  await expect(
    pool.query('UPDATE smg.round_events SET type = type WHERE round_id = $1', [roundId]),
  ).rejects.toThrow(/append-only/);
  const row = await pool.query<{ status: string; end_reason: string }>(
    'SELECT status, end_reason FROM smg.rounds WHERE id = $1',
    [roundId],
  );
  expect(row.rows[0]).toEqual({ status: 'ended', end_reason: 'solved' });
  const standing = await pool.query<{ player_key: string; points: number; rank: number }>(
    `SELECT s.player_key, s.points, s.rank FROM smg.match_standings s JOIN smg.matches m ON m.id = s.match_id
     WHERE m.code = $1 ORDER BY rank`,
    [code],
  );
  expect(standing.rows[0]).toEqual({ player_key: winner, points: 10, rank: 1 });
  // Players without a team were put into teams; the winner's team scored 1 (03 §5, O12).
  const teams = await pool.query<{ points: number; rank: number }>(
    `SELECT t.points, t.rank FROM smg.match_team_standings t JOIN smg.matches m ON m.id = t.match_id
     WHERE m.code = $1 ORDER BY rank, team`,
    [code],
  );
  expect(teams.rows[0]).toEqual({ points: 1, rank: 1 });
}

async function checkFrames(s: Record<'host' | 'player-1', Socket>, roundId: string, p1: string) {
  await until(() => Promise.resolve(kit.frames(s['player-1']).length > 0 ? true : null));
  const all = JSON.stringify(kit.frames(s.host));
  expect(all).toContain('GuessAccepted');
  // The room never gets a guess's action; the guesser's answers go to the guesser alone.
  expect(all).not.toContain('"action"');
  expect(all).not.toContain('FeedbackGiven');
  const own = JSON.stringify(kit.frames(s['player-1']));
  expect(own).toContain('FeedbackGiven');
  expect(own).toContain(p1);
  expect(own).toContain(roundId);
}

describe('recovery after a restart', () => {
  it('continues a running round on a second server with its cooldowns', async () => {
    const code = await kit.openMatch(['player-1', 'player-2']);
    opened.push(code);
    const s = await watching(code, ['host', 'player-1', 'player-2']);
    const id = await newRound(code, { 'round.cooldownS': 30 });
    expect((await kit.send(s.host, 'round.start', { roundId: id })).ok).toBe(true);
    await openAt(id);
    const secrets = await kit.secretsOf(id);
    const wrong = secrets.mode === 'shared' && secrets.value === 1 ? 2 : 1;
    expect((await kit.send(s['player-1'], 'guess', { roundId: id, value: wrong })).ok).toBe(true);
    const before = (await kit.clients['player-1'].get(`/api/v1/rounds/${id}/state`)).json<
      Record<string, unknown>
    >();

    const second = await buildOn(kit.harness.pool, kit.harness.container.getConnectionUri());
    try {
      const round = await second.runtime.rounds.get(id);
      expect(round).not.toBeNull();
      const p1 = await kit.accountId('player-1');
      const after = round?.view(p1) as Record<string, unknown>;
      expect({ ...after, seq: 0 }).toEqual({ ...before, seq: 0, names: undefined });
      expect(await round?.guess(p1, { value: wrong + 1 })).toMatchObject({
        code: 'COOLDOWN_ACTIVE',
      });
    } finally {
      await second.fastify.close();
    }
  }, 60_000);
});
