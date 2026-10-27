/**
 * @file   apps/server/test/adminLive.integration.test.ts
 * @module server/test
 * @brief  Live rounds with staff actions against Postgres: the live list, the staff view,
 *         kick, staff abort, and the removal of a round result.
 *
 * Responsibility: a running round shows in the live list with its counts and nothing else (no
 *                 secret, no seed); staff watch it with the spectator view; a kicked player
 *                 leaves as `kicked`, cannot guess or join again; a staff abort ends the round
 *                 with "by staff (reason)" for its players and is audited with the reason; a
 *                 removed result leaves the match standings, the team standings and the
 *                 league board, once, only after the end, audited. Every match is aborted.
 * Depends on:     vitest, socket.io-client (types), ./harness, ./session, ./socketKit
 * Spec:           docs/spec/06-data-model-api-realtime.md §3.2; Bingo 11 §3.2
 */
import type { Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SUITE_TIMEOUT_MS } from './harness.js';
import { signIn, type Client } from './session.js';
import { startSocketKit, type SocketKit, type Who } from './socketKit.js';

let kit: SocketKit;
let admin: Client;
const opened: string[] = [];

beforeAll(async () => {
  kit = await startSocketKit();
  admin = await signIn(kit.harness.built.fastify, 'admin');
}, SUITE_TIMEOUT_MS);

afterAll(async () => {
  for (const code of opened)
    await kit.clients.host.post(`/api/v1/matches/${code}/abort`, { reason: 'test done' });
  await kit.close();
});

const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));

// A match of the host with these players, everyone watching, and a started shared round.
async function runningRound(players: readonly Who[]) {
  const code = await kit.openMatch(players);
  opened.push(code);
  const sockets: Partial<Record<Who, Socket>> = {};
  for (const who of ['host', ...players] as Who[]) {
    const s = kit.open(kit.clients[who].cookie);
    expect(await kit.connected(s)).toBe('ok');
    expect((await kit.send(s, 'match.watch', { code })).ok).toBe(true);
    sockets[who] = s;
  }
  const r = await kit.clients.host.post(`/api/v1/matches/${code}/rounds`, {
    settings: { 'round.countdownS': 3, 'round.specialOn': false },
    season: 'spring',
    startNow: true,
  });
  expect(r.statusCode).toBe(201);
  const id = r.json<{ id: string }>().id;
  const opensAt = (await kit.clients.host.get(`/api/v1/rounds/${id}/state`)).json<{
    opensAt: number;
  }>().opensAt;
  await wait(Math.max(0, opensAt - Date.now()) + 50);
  return { code, id, sockets };
}

// Guesses the shared secret as `winner` until accepted, then waits for the announced end.
async function won(id: string, socket: Socket | undefined): Promise<void> {
  if (socket === undefined) throw new Error('the winner watches');
  const secrets = await kit.secretsOf(id);
  const value = secrets.mode === 'shared' ? secrets.value : 0;
  for (let tries = 0; tries < 80; tries += 1) {
    if ((await kit.send(socket, 'guess', { roundId: id, value })).ok) break;
    await wait(100);
  }
  for (let tries = 0; tries < 50; tries += 1) {
    const st = await kit.clients.host.get(`/api/v1/rounds/${id}/state`);
    if (st.json<{ status: string }>().status === 'ended') return;
    await wait(100);
  }
}

interface StaffView {
  role: string;
  status: string;
  match: { id: string; code: string };
  players: string[];
  removed: string[];
}

const LIVE_KEYS = [
  'connected',
  'endsAt',
  'guesses',
  'halving',
  'host',
  'matchCode',
  'matchId',
  'matchTitle',
  'opensAt',
  'roster',
  'roundId',
  'season',
  'secretMode',
  'status',
];

// The round the live tests share, its staff view and the kicked player.
let round: Awaited<ReturnType<typeof runningRound>>;
let view: StaffView;
let p1: string;

describe('the live list', () => {
  it('lists a running round with counts only and gives staff the spectator view', async () => {
    round = await runningRound(['player-1']);
    const { code, id } = round;
    const live = (await admin.get('/api/v1/admin/rounds/live')).json<{
      items: Record<string, unknown>[];
    }>().items;
    const item = live.find((r) => r['roundId'] === id);
    expect(item).toMatchObject({ matchCode: code, status: 'open', roster: 2, connected: 2 });
    expect(Object.keys(item ?? {}).sort()).toEqual(LIVE_KEYS.sort());
    view = (await admin.get(`/api/v1/admin/rounds/${id}`)).json<StaffView>();
    expect(view.role).toBe('spectator');
    expect(JSON.stringify(view)).not.toMatch(/"seed"|"secret"/);
  });

  it('refuses staff actions without a reason or the permission', async () => {
    const live = '/api/v1/admin/rounds/live';
    expect((await kit.clients['player-2'].get(live)).statusCode).toBe(403);
    const none = '00000000-0000-4000-8000-000000000000';
    expect(
      (await admin.post(`/api/v1/admin/rounds/${none}/abort`, { reason: 'x' })).statusCode,
    ).toBe(400);
    expect(
      (await admin.post(`/api/v1/admin/rounds/${none}/abort`, { reason: 'gone' })).statusCode,
    ).toBe(404);
  });
});

describe('staff actions on a running round', () => {
  it('kicks a player: kicked, no further guess, no way back in', async () => {
    const { code, id, sockets } = round;
    p1 = await kit.accountId('player-1');
    expect(
      (
        await admin.post(`/api/v1/admin/matches/${view.match.id}/kick`, {
          playerKey: p1,
          reason: 'abusive',
        })
      ).statusCode,
    ).toBe(200);
    const rows = await kit.harness.pool.query<{ state: string }>(
      'SELECT state FROM smg.match_players WHERE match_id = $1 AND player_key = $2',
      [view.match.id, p1],
    );
    expect(rows.rows[0]?.state).toBe('kicked');
    expect(
      (await kit.send(sockets['player-1'] as Socket, 'guess', { roundId: id, value: 1 })).code,
    ).toBe('NOT_IN_ROUND');
    expect(
      (await kit.clients['player-1'].post(`/api/v1/matches/${code}/join`, {})).statusCode,
    ).not.toBe(200);
  });

  it('aborts as staff: the players read who and why, the audit log keeps the reason', async () => {
    const { id, sockets } = round;
    const abort = await admin.post(`/api/v1/admin/rounds/${id}/abort`, { reason: 'cheating test' });
    expect(abort.statusCode).toBe(200);
    const state = (await kit.clients.host.get(`/api/v1/rounds/${id}/state`)).json<{
      status: string;
      abortReason: string;
    }>();
    expect(state).toMatchObject({ status: 'aborted', abortReason: 'by staff (cheating test)' });
    const audit = (await admin.get('/api/v1/admin/audit?action=round.abort')).json<{
      items: { targetId: string; diff: { reason: string } }[];
    }>().items;
    expect(audit[0]).toMatchObject({ targetId: id, diff: { reason: 'cheating test' } });
    expect(
      (await admin.get('/api/v1/admin/rounds/live')).json<{ items: unknown[] }>().items,
    ).toEqual([]);
    // Only an ended round has results to remove.
    expect(
      (
        await admin.post(`/api/v1/admin/rounds/${id}/results/${p1}/remove`, { reason: 'too early' })
      ).json(),
    ).toMatchObject({ code: 'ROUND_NOT_ENDED' });
    for (const s of Object.values(sockets)) s.disconnect();
  });
});

async function standingsOf(code: string) {
  return (await kit.clients.host.get(`/api/v1/matches/${code}`)).json<{
    standings: { playerKey: string; points: number }[];
    teamStandings: { points: number }[];
  }>();
}

// The all-time league board.
async function board() {
  const periods = (await kit.clients.host.get('/api/v1/leaderboards')).json<{
    periods: { id: string; kind: string }[];
  }>().periods;
  const allTime = periods.find((p) => p.kind === 'all_time')?.id ?? '';
  return (await kit.clients.host.get(`/api/v1/leaderboards/${allTime}`)).json<{
    rows: { displayName: string; points: number }[];
  }>().rows;
}

describe('removing a round result', () => {
  it('leaves the standings, the team standings and the league board, once', async () => {
    const players: Who[] = ['player-1', 'player-2', 'player-3'];
    const { code, id, sockets } = await runningRound(players);
    await won(id, sockets['player-1']);
    for (const s of Object.values(sockets)) s.disconnect();
    const p1 = await kit.accountId('player-1');
    const match = () => standingsOf(code);
    const teamPoints = async () => (await match()).teamStandings.reduce((n, t) => n + t.points, 0);
    expect((await match()).standings.find((s) => s.playerKey === p1)?.points).toBe(10);
    expect(await teamPoints()).toBe(1);
    expect((await board()).find((r) => r.displayName === 'dev-player-1')?.points).toBe(10);

    const url = `/api/v1/admin/rounds/${id}/results/${p1}/remove`;
    expect((await admin.post(url, {})).statusCode).toBe(400);
    const r = await admin.post(url, { reason: 'used a second account' });
    expect(r.json()).toEqual({ removed: [p1] });
    expect((await match()).standings.find((s) => s.playerKey === p1)).toBeUndefined();
    expect(await teamPoints()).toBe(0);
    // Three accounts are left, under the four that league points need: nobody keeps points.
    expect((await board()).find((row) => row.points > 0)).toBeUndefined();
    expect((await admin.post(url, { reason: 'again' })).json()).toMatchObject({
      code: 'ALREADY_REMOVED',
    });
    const audit = (await admin.get('/api/v1/admin/audit?action=round.result.remove')).json<{
      items: { diff: unknown }[];
    }>().items;
    expect(audit[0]?.diff).toEqual({ playerKey: p1, reason: 'used a second account' });
    const view = (await admin.get(`/api/v1/admin/rounds/${id}`)).json<StaffView>();
    expect(view.removed).toEqual([p1]);
  });
});
