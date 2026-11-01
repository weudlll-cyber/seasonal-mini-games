/**
 * @file   apps/server/test/matchFlow.integration.test.ts
 * @module server/test
 * @brief  A match from teams to its end: the team once per match, End match with the summary,
 *         and the idle close with a fake clock and after a restart (O26, O27, O28).
 *
 * Responsibility: a player without a team is placed in the smallest team when their first
 *                 round starts and keeps it; after their first round `team.choose` is refused
 *                 with TEAM_LOCKED over the socket and over HTTP alike, while a newcomer still
 *                 chooses; the host's close aborts a round only set up, keeps the ended rounds'
 *                 results, and every viewer reads the summary; a match without a round closes
 *                 itself after `match.lobbyIdleCloseMin` (not a minute before), never while a
 *                 round runs, aborts a round only set up, says how long it was idle, and a
 *                 restarted server closes an overdue match at once. Every match is closed or
 *                 aborted at the end; the container goes with the suite.
 * Depends on:     vitest, ../src/match/idleClose, ./socketKit, ./harness
 * Spec:           docs/spec/02-game-guess-the-number.md §2; docs/spec/09-testing-strategy.md §2
 */
import type { MatchDetailsView } from '@smg/contracts';
import type { Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { IdleClose } from '../src/match/idleClose.js';
import { buildOn, SUITE_TIMEOUT_MS } from './harness.js';
import { startSocketKit, type SocketKit, type Who } from './socketKit.js';

let kit: SocketKit;
const opened: string[] = [];
const MIN = 60_000;

beforeAll(async () => {
  kit = await startSocketKit();
}, SUITE_TIMEOUT_MS);

afterAll(async () => {
  for (const code of opened)
    await kit.clients.host.post(`/api/v1/matches/${code}/abort`, { reason: 'test done' });
  await kit.close();
});

async function watching(code: string, who: readonly Who[]): Promise<Socket[]> {
  const sockets: Socket[] = [];
  for (const w of who) {
    const s = kit.open(kit.clients[w].cookie);
    expect(await kit.connected(s)).toBe('ok');
    expect((await kit.send(s, 'match.watch', { code })).ok).toBe(true);
    sockets.push(s);
  }
  return sockets;
}

async function newRound(code: string): Promise<string> {
  const r = await kit.clients.host.post(`/api/v1/matches/${code}/rounds`, {
    settings: { 'round.cooldownS': 3, 'round.countdownS': 3 },
    season: 'spring',
  });
  expect(r.statusCode).toBe(201);
  return r.json<{ id: string }>().id;
}

const details = async (who: Who, code: string) =>
  (await kit.clients[who].get(`/api/v1/matches/${code}`)).json<MatchDetailsView>();

async function teamsOf(code: string): Promise<Record<string, string | null>> {
  const r = await kit.harness.pool.query<{ player_key: string; team: string | null }>(
    `SELECT p.player_key, p.team FROM smg.match_players p JOIN smg.matches m ON m.id = p.match_id
     WHERE m.code = $1`,
    [code],
  );
  return Object.fromEntries(r.rows.map((row) => [row.player_key, row.team]));
}

const idleClose = (now: () => number) =>
  new IdleClose(kit.harness.pool, kit.harness.built.runtime.play, kit.harness.built.settings, now);

describe('the season team, once per match (O26)', () => {
  it('places a player without a team, then refuses a change on socket and HTTP', async () => {
    const code = await kit.openMatch(['player-1', 'player-2']);
    opened.push(code);
    const [host, p1] = await watching(code, ['host', 'player-1', 'player-2']);
    if (host === undefined || p1 === undefined) throw new Error('sockets');
    const chose = await kit.clients['player-1'].post(`/api/v1/matches/${code}/team`, {
      team: 'spring',
    });
    expect(chose.statusCode).toBe(204);
    const id = await newRound(code);
    expect((await kit.send(host, 'round.start', { roundId: id })).ok).toBe(true);
    // The host and player-2 had no team: each went to a smallest team, two different ones.
    const teams = await teamsOf(code);
    const [hostKey, p1Key, p2Key] = [
      await kit.accountId('host'),
      await kit.accountId('player-1'),
      await kit.accountId('player-2'),
    ];
    expect(teams[p1Key]).toBe('spring');
    expect(teams[hostKey]).not.toBeNull();
    expect(teams[p2Key]).not.toBeNull();
    expect(new Set([teams[p1Key], teams[hostKey], teams[p2Key]]).size).toBe(3);
    expect((await kit.send(host, 'round.end', { roundId: id })).ok).toBe(true);
    // After the round: the team is fixed, over HTTP and over the socket alike.
    const http = await kit.clients['player-1'].post(`/api/v1/matches/${code}/team`, {
      team: 'winter',
    });
    expect(http.statusCode).toBe(409);
    expect(http.json<unknown>()).toEqual({ code: 'TEAM_LOCKED' });
    expect(await kit.send(p1, 'team.choose', { code, team: 'winter' })).toMatchObject({
      ok: false,
      code: 'TEAM_LOCKED',
    });
    expect((await details('player-1', code)).teamLocked).toBe(true);
    expect((await teamsOf(code))[p1Key]).toBe('spring');
    // A newcomer has not played yet and still chooses.
    await kit.clients['player-3'].post(`/api/v1/matches/${code}/join`, {});
    expect((await details('player-3', code)).teamLocked).toBe(false);
    const late = await kit.clients['player-3'].post(`/api/v1/matches/${code}/team`, {
      team: 'autumn',
    });
    expect(late.statusCode).toBe(204);
  }, 60_000);
});

describe('End match (O27)', () => {
  it('aborts a round only set up, keeps the ended rounds and shows everyone the summary', async () => {
    const code = await kit.openMatch(['player-1']);
    const [host] = await watching(code, ['host', 'player-1']);
    if (host === undefined) throw new Error('sockets');
    const first = await newRound(code);
    expect((await kit.send(host, 'round.start', { roundId: first })).ok).toBe(true);
    expect((await kit.send(host, 'round.end', { roundId: first })).ok).toBe(true);
    const second = await newRound(code);
    const refused = await kit.clients['player-1'].post(`/api/v1/matches/${code}/close`, {});
    expect(refused.json<unknown>()).toEqual({ code: 'NOT_THE_HOST' });
    expect((await kit.clients.host.post(`/api/v1/matches/${code}/close`, {})).statusCode).toBe(204);
    const rounds = await kit.harness.pool.query<{ id: string; status: string }>(
      'SELECT id::text, status FROM smg.rounds WHERE id = ANY($1)',
      [[first, second]],
    );
    expect(Object.fromEntries(rounds.rows.map((r) => [r.id, r.status]))).toEqual({
      [first]: 'ended',
      [second]: 'aborted',
    });
    const results = await kit.harness.pool.query(
      'SELECT 1 FROM smg.round_results WHERE round_id = $1',
      [first],
    );
    expect(results.rowCount).toBe(2);
    const seen = await details('player-1', code);
    expect(seen.status).toBe('closed');
    expect(seen.ended).toMatchObject({
      roundsPlayed: 1,
      by: 'host',
      reason: null,
      idleMinutes: null,
    });
    expect(seen.ended?.players).toHaveLength(2);
    expect(JSON.stringify(seen.ended)).not.toContain(await kit.accountId('player-1'));
    // Guests read it too.
    const guest = await kit.harness.built.fastify.inject({ url: `/api/v1/matches/${code}` });
    expect(guest.json<MatchDetailsView>().ended?.roundsPlayed).toBe(1);
  }, 60_000);
});

describe('the idle close (O28)', () => {
  it('closes a match without a round after the configured time, not a minute before', async () => {
    const code = await kit.openMatch([]);
    const created = (await details('host', code)).createdAt;
    expect(await idleClose(() => created + 59 * MIN).sweep()).toBe(0);
    expect((await details('host', code)).status).toBe('lobby');
    // A second over: createdAt has milliseconds, the database microseconds.
    await idleClose(() => created + 61 * MIN + 1000).sweep();
    const seen = await details('host', code);
    expect(seen.status).toBe('closed');
    expect(seen.ended).toMatchObject({ by: 'system', reason: 'idle', idleMinutes: 61 });
  });

  it('never closes a running round, and aborts a round only set up', async () => {
    const code = await kit.openMatch(['player-1']);
    opened.push(code);
    const [host] = await watching(code, ['host', 'player-1']);
    if (host === undefined) throw new Error('sockets');
    const running = await newRound(code);
    expect((await kit.send(host, 'round.start', { roundId: running })).ok).toBe(true);
    const later = Date.now() + 120 * MIN;
    await idleClose(() => later).sweep();
    expect((await details('host', code)).status).toBe('open');
    expect((await kit.send(host, 'round.end', { roundId: running })).ok).toBe(true);
    const setUp = await newRound(code);
    await idleClose(() => later).sweep();
    expect((await details('host', code)).ended).toMatchObject({ reason: 'idle', by: 'system' });
    const row = await kit.harness.pool.query<{ status: string; aborted_reason: string }>(
      'SELECT status, aborted_reason FROM smg.rounds WHERE id = $1',
      [setUp],
    );
    expect(row.rows[0]).toEqual({ status: 'aborted', aborted_reason: 'idle' });
  }, 60_000);

  it('closes an overdue match as soon as a server starts', async () => {
    const code = await kit.openMatch([]);
    // The server was down for two hours: the match is overdue when the next one starts.
    await kit.harness.pool.query(
      `UPDATE smg.matches SET created_at = now() - interval '2 hours' WHERE code = $1`,
      [code],
    );
    const second = await buildOn(kit.harness.pool, kit.harness.container.getConnectionUri());
    try {
      await second.runtime.start();
      const seen = await details('host', code);
      expect(seen.status).toBe('closed');
      expect(seen.ended?.idleMinutes).toBeGreaterThanOrEqual(120);
    } finally {
      await second.fastify.close();
    }
  }, 60_000);
});
