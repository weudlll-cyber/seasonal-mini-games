/**
 * @file   apps/server/test/league.integration.test.ts
 * @module server/test
 * @brief  League points with Postgres: two matches add up on the season and all-time boards
 *         with the team board beside, profiles, adjustments, and points taken back.
 *
 * Responsibility: shared rounds of four accounts award each player their match standing to
 *                 both boards, and two matches add up; the team board sums the teams' round
 *                 wins; `/me` finds the viewer; the profile agrees with the boards; a staff
 *                 adjustment needs a reason, is audited, append-only and public on the profile;
 *                 a match with fewer accounts than `leaderboard.minPlayersForPoints` or one that
 *                 does not count awards nothing; aborting a match takes its points back (T70).
 *                 Every match is aborted at the end, which also removes its points.
 * Depends on:     vitest, ./socketKit, ./session
 * Spec:           docs/spec/02-game-guess-the-number.md §9; docs/spec/06-data-model-api-realtime.md §2.6, §3.1;
 *                 docs/spec/09-testing-strategy.md §2
 */
import type { Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SUITE_TIMEOUT_MS } from './harness.js';
import { signIn, type Client } from './session.js';
import { startSocketKit, type SocketKit, type Who } from './socketKit.js';

let kit: SocketKit;
let admin: Client;
const opened: string[] = [];
const EVERYONE: readonly Who[] = ['host', 'player-1', 'player-2', 'player-3'];

beforeAll(async () => {
  kit = await startSocketKit();
  admin = await signIn(kit.harness.built.fastify, 'admin');
}, SUITE_TIMEOUT_MS);

afterAll(async () => {
  for (const code of opened)
    await kit.clients.host.post(`/api/v1/matches/${code}/abort`, { reason: 'test done' });
  await kit.close();
});

interface Row {
  displayName: string;
  points: number;
  wins: number;
  solves: number;
  matches: number;
  rank: number;
  you: boolean;
}

// A match of the host with the players, all watching; one shared round won by `winner`.
async function wonMatch(players: readonly Who[], winner: Who, counts = true): Promise<string> {
  const r = await kit.clients.host.post('/api/v1/matches', {
    gameId: 'guess-the-number',
    title: 'league',
    maxPlayers: 10,
    countsForLeaderboard: counts,
  });
  const code = r.json<{ code: string }>().code;
  opened.push(code);
  const sockets: Partial<Record<Who, Socket>> = {};
  for (const who of ['host', ...players] as Who[]) {
    if (who !== 'host') await kit.clients[who].post(`/api/v1/matches/${code}/join`, {});
    const s = kit.open(kit.clients[who].cookie);
    expect(await kit.connected(s)).toBe('ok');
    expect((await kit.send(s, 'match.watch', { code })).ok).toBe(true);
    sockets[who] = s;
  }
  const round = await kit.clients.host.post(`/api/v1/matches/${code}/rounds`, {
    settings: { 'round.countdownS': 3 },
    season: 'spring',
    startNow: true,
  });
  const id = round.json<{ id: string }>().id;
  const secrets = await kit.secretsOf(id);
  const secret = secrets.mode === 'shared' ? secrets.value : 0;
  const s = sockets[winner];
  if (s === undefined) throw new Error('the winner watches');
  for (let tries = 0; tries < 80; tries += 1) {
    const answer = await kit.send(s, 'guess', { roundId: id, value: secret });
    if (answer.ok) break;
    await new Promise((done) => setTimeout(done, 100));
  }
  // The result is written with RoundEnded; wait until the round is announced as ended.
  for (let tries = 0; tries < 50; tries += 1) {
    const st = await kit.clients.host.get(`/api/v1/rounds/${id}/state`);
    if (st.json<{ status: string }>().status === 'ended') break;
    await new Promise((done) => setTimeout(done, 100));
  }
  for (const sock of Object.values(sockets)) sock.disconnect();
  return code;
}

async function boards() {
  const list = (await kit.clients['player-1'].get('/api/v1/leaderboards')).json<{
    periods: { id: string; kind: string; name: string }[];
  }>().periods;
  const allTime = list.find((p) => p.kind === 'all_time');
  const season = list.find((p) => p.kind === 'season');
  return { list, allTime, season };
}

async function rows(periodId: string, as: Who = 'player-1'): Promise<Row[]> {
  return (await kit.clients[as].get(`/api/v1/leaderboards/${periodId}`)).json<{ rows: Row[] }>()
    .rows;
}

const byName = (list: readonly Row[], name: string) => list.find((r) => r.displayName === name);

// After the two won matches: both boards give each winner 10 points and the teams 2 wins.
async function expectTwoMatches(periodId: string): Promise<void> {
  const board = await rows(periodId);
  expect(byName(board, 'dev-player-1')).toMatchObject({
    points: 10,
    wins: 1,
    solves: 1,
    matches: 2,
    rank: 1,
    you: true,
  });
  expect(byName(board, 'dev-player-2')).toMatchObject({ points: 10, wins: 1, rank: 1, you: false });
  expect(byName(board, 'dev-host')).toMatchObject({ points: 0, matches: 2, rank: 3 });
  const teams = (await kit.clients.host.get(`/api/v1/leaderboards/${periodId}/teams`)).json<{
    rows: { points: number }[];
  }>().rows;
  // One point per round win for the winner's team (O12): two rounds, two points.
  expect(teams.reduce((sum, t) => sum + t.points, 0)).toBe(2);
}

// The profile agrees with the boards and carries no e-mail.
async function expectProfile(): Promise<void> {
  const profile = (await kit.clients['player-3'].get('/api/v1/players/DEV-PLAYER-1')).json<{
    displayName: string;
    matchesPlayed: number;
    wins: number;
    bestPlace: number;
    recent: { secretMode: string }[];
    boards: { rank: number; points: number }[];
  }>();
  expect(profile).toMatchObject({
    displayName: 'dev-player-1',
    matchesPlayed: 2,
    wins: 1,
    bestPlace: 1,
  });
  expect(profile.recent).toEqual([
    expect.objectContaining({ secretMode: 'shared' }),
    expect.objectContaining({ secretMode: 'shared' }),
  ]);
  expect(profile.boards).toEqual([
    expect.objectContaining({ rank: 1, points: 10 }),
    expect.objectContaining({ rank: 1, points: 10 }),
  ]);
  expect(JSON.stringify(profile)).not.toMatch(/@|example/);
}

describe('league points', () => {
  it('add up over two matches on the season and all-time boards, teams beside', async () => {
    await wonMatch(['player-1', 'player-2', 'player-3'], 'player-1');
    await wonMatch(['player-1', 'player-2', 'player-3'], 'player-2');
    const { list, allTime, season } = await boards();
    expect(list[0]?.kind).toBe('all_time');
    expect(season?.name).toMatch(/^(Winter|Spring|Summer|Autumn) \d{4}$/);
    for (const p of [allTime, season]) await expectTwoMatches(p?.id ?? '');
    const me = (
      await kit.clients['player-3'].get(`/api/v1/leaderboards/${allTime?.id ?? ''}/me`)
    ).json<{
      rows: Row[];
    }>().rows;
    expect(me.find((r) => r.you)?.displayName).toBe('dev-player-3');
    await expectProfile();
    const bad = await kit.clients.host.get(`/api/v1/leaderboards/${allTime?.id ?? ''}?offset=-1`);
    expect(bad.statusCode).toBe(400);
  }, 120_000);

  it('award nothing below the minimum of accounts or when a match does not count', async () => {
    const { allTime } = await boards();
    const periodId = allTime?.id ?? '';
    const before = await rows(periodId);
    await wonMatch(['player-1', 'player-2'], 'player-1');
    await wonMatch(['player-1', 'player-2', 'player-3'], 'player-1', false);
    expect(await rows(periodId)).toEqual(before);
  }, 120_000);

  it('take an aborted match’s points back', async () => {
    const { allTime } = await boards();
    const periodId = allTime?.id ?? '';
    const code = await wonMatch(EVERYONE.slice(1), 'player-3');
    expect(byName(await rows(periodId), 'dev-player-3')?.wins).toBe(1);
    await kit.clients.host.post(`/api/v1/matches/${code}/abort`, { reason: 'test' });
    expect(byName(await rows(periodId), 'dev-player-3')?.wins).toBe(0);
  }, 120_000);
});

describe('leaderboard adjustments', () => {
  it('show a staff adjustment with its reason; it cannot be changed', async () => {
    const { allTime } = await boards();
    const periodId = allTime?.id ?? '';
    const refused = await kit.clients['player-1'].post('/api/v1/admin/leaderboard-adjustments', {
      periodId,
      displayName: 'dev-player-1',
      delta: 100,
      reason: 'my own',
    });
    expect(refused.statusCode).toBe(403);
    const before = byName(await rows(periodId), 'dev-player-3')?.points ?? 0;
    const made = await admin.post('/api/v1/admin/leaderboard-adjustments', {
      periodId,
      displayName: 'dev-player-3',
      delta: 5,
      reason: 'Make-up for a lost round',
    });
    expect(made.statusCode).toBe(201);
    expect(byName(await rows(periodId), 'dev-player-3')?.points).toBe(before + 5);
    const profile = (await kit.clients.host.get('/api/v1/players/dev-player-3')).json<{
      adjustments: { delta: number; reason: string }[];
    }>();
    expect(profile.adjustments[0]).toMatchObject({ delta: 5, reason: 'Make-up for a lost round' });
    await expect(
      kit.harness.pool.query('UPDATE smg.leaderboard_adjustments SET delta = 50'),
    ).rejects.toThrow(/append-only/);
    const audit = await kit.harness.pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM smg.audit_log WHERE action = 'leaderboard.adjust'`,
    );
    expect(Number(audit.rows[0]?.n)).toBe(1);
  });

  it('refuse a body that is not an adjustment', async () => {
    const r = await admin.post('/api/v1/admin/leaderboard-adjustments', { delta: 0 });
    expect(r.statusCode).toBe(400);
  });
});
