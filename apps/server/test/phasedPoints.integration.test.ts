/**
 * @file   apps/server/test/phasedPoints.integration.test.ts
 * @module server/test
 * @brief  A Seasonal Mind Games round's points along their whole path, an All winner with 2.
 *
 * Responsibility: DECISIONS T340: the points of the game's result reach every place that shows
 *                 them. One round with All on, played by four accounts over sockets (All,
 *                 Winter, Winter, Spring: All and Spring are the least chosen), counting for
 *                 the leaderboard: the game's result view (+2 for All, +1 for Spring), the
 *                 RoundEnded frame, the round_results rows, the ended round's view (the
 *                 placings table's source; it read 0 before T340), the match standings in the
 *                 details, the closed match's summary, and the season and all-time boards all
 *                 give the same points. player-1 switches once first (Spring, then Winter):
 *                 no `guesses` above 0, no count of anyone's choices, appears in the round
 *                 view's results or roster, the RoundEnded frame or the rows (O91, T342). The game
 *                 list says Mind Games shows no season and every guess game does (O93).
 * Depends on:     vitest, socket.io-client, ./harness, ./socketKit
 * Spec:           docs/spec/02e-game-mind-games.md §8, §9; docs/spec/04-software-architecture.md §4.8 rule 6;
 *                 docs/spec/06-data-model-api-realtime.md §2.4–§2.6
 */
import type { Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SUITE_TIMEOUT_MS } from './harness.js';
import { startSocketKit, type SocketKit, type Who } from './socketKit.js';

let kit: SocketKit;
let code = '';

beforeAll(async () => {
  kit = await startSocketKit();
}, SUITE_TIMEOUT_MS);

afterAll(async () => {
  if (code !== '')
    await kit.clients.host.post(`/api/v1/matches/${code}/abort`, { reason: 'test done' });
  await kit.close();
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, Math.max(0, ms)));

// Each account's final choice, and the points 02e §8 gives it: All and Spring are chosen once,
// the least; a winning All scores 2 (owner decision 84).
const PLAYS: readonly (readonly [Who, string, number])[] = [
  ['host', 'all', 2],
  ['player-1', 'winter', 0],
  ['player-2', 'winter', 0],
  ['player-3', 'spring', 1],
];

interface Details {
  readonly status: string;
  readonly round: { readonly id: string; readonly status: string } | null;
  readonly standings: readonly { playerKey: string; points: number; wins: number }[];
  readonly ended: { readonly rounds?: readonly { words: string | null }[] } | null;
}

const details = async () => (await kit.clients.host.get(`/api/v1/matches/${code}`)).json<Details>();

async function until<T>(read: () => Promise<T>, ok: (v: T) => boolean, ms: number): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await read();
    if (ok(v)) return v;
    if (Date.now() > end) throw new Error(`timed out: ${JSON.stringify(v)}`);
    await sleep(250);
  }
}

// The match of the four accounts, watching, and its one round with All on, started at once.
async function playedRound(): Promise<{ id: string; sockets: Record<string, Socket> }> {
  const r = await kit.clients.host.post('/api/v1/matches', {
    gameId: 'mind-games',
    title: 'points',
    maxPlayers: 10,
    countsForLeaderboard: true,
  });
  code = r.json<{ code: string }>().code;
  const sockets: Record<string, Socket> = {};
  for (const [who] of PLAYS) {
    if (who !== 'host') await kit.clients[who].post(`/api/v1/matches/${code}/join`, {});
    const s = kit.open(kit.clients[who].cookie);
    expect(await kit.connected(s)).toBe('ok');
    expect((await kit.send(s, 'match.watch', { code })).ok).toBe(true);
    sockets[who] = s;
  }
  const settings = {
    'round.countdownS': 3,
    'mind.totalS': 30,
    'mind.delayAuto': false,
    'mind.delayS': 5,
    'mind.allOption': true,
    'mind.rounds': 1,
    'mind.pauseS': 5,
  };
  const round = await kit.clients.host.post(`/api/v1/matches/${code}/rounds`, {
    settings,
    season: 'summer',
    startNow: true,
  });
  expect(round.statusCode).toBe(201);
  const id = round.json<{ id: string }>().id;
  // player-1's first choice, switched below: a count would show it (T342).
  const first = { choice: 'spring', hide: false };
  await until(
    () => kit.send(sockets['player-1'] as Socket, 'guess', { roundId: id, value: first }),
    (a) => a.ok,
    10_000,
  );
  for (const [who, choice] of PLAYS) {
    const value = { choice, hide: false };
    await until(
      () => kit.send(sockets[who] as Socket, 'guess', { roundId: id, value }),
      (a) => a.ok,
      10_000,
    );
  }
  return { id, sockets };
}

// Display names by every key a place uses: the round's keys (its `names`) and account ids.
const names: Record<string, string> = {};

// The points by display name that a list of rows gives.
const byName = (rows: readonly { readonly key: string; readonly points: number }[]) =>
  Object.fromEntries(rows.map((r) => [names[r.key] ?? r.key, r.points]));

async function expected(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const [who, , points] of PLAYS) {
    names[await kit.accountId(who)] = `dev-${who}`;
    out[`dev-${who}`] = points;
  }
  return out;
}

interface Ended {
  readonly status: string;
  readonly roster: readonly { guesses: number }[];
  readonly names: Readonly<Record<string, string>>;
  readonly results: readonly { playerId: string; points: number; guesses: number }[];
  readonly game: { readonly players: readonly { playerKey: string; points: number }[] };
}

// The round's own view, the RoundEnded frame and the stored rows.
async function roundPoints(id: string, socket: Socket, want: Record<string, number>) {
  const ended = await until(
    async () => (await kit.clients['player-1'].get(`/api/v1/rounds/${id}/state`)).json<Ended>(),
    (v) => v.status === 'ended',
    45_000,
  );
  Object.assign(names, ended.names);
  const game = byName(ended.game.players.map((l) => ({ key: l.playerKey, points: l.points })));
  expect(game, 'the game result view').toEqual(want);
  // The placings table's rows: before T340 every point here was 0.
  expect(byName(ended.results.map((r) => ({ key: r.playerId, points: r.points })))).toEqual(want);
  // The room's end frame (sent wrapped before T341); it may follow the state answer.
  const endFrame = () =>
    Promise.resolve(
      (kit.frames(socket) as { events?: { event: Record<string, unknown> | null }[] }[])
        .flatMap((f) => f.events ?? [])
        .find((e) => e.event?.type === 'RoundEnded')?.event as Ended | undefined,
    );
  const frame = await until(endFrame, (f) => f !== undefined, 5_000);
  const sent = frame?.results.map((r) => ({ key: r.playerId, points: r.points })) ?? [];
  expect(byName(sent), 'the RoundEnded frame').toEqual(want);
  const rows = await kit.harness.pool.query<{
    player_key: string;
    points: number;
    guesses: number;
  }>('SELECT player_key, points, guesses FROM smg.round_results WHERE round_id = $1', [id]);
  expect(byName(rows.rows.map((x) => ({ key: x.player_key, points: x.points })))).toEqual(want);
  // No count of anyone's choices anywhere, although player-1 switched (O91, T342).
  const counts = [ended.results, ended.roster, frame?.results ?? [], rows.rows].flat();
  expect(counts.map((x) => x.guesses).filter((n) => n !== 0)).toEqual([]);
}

// The match standings, the summary once the series closed, and both boards.
async function matchAndBoards(want: Record<string, number>) {
  const standings = (d: Details) => byName(d.standings.map((s) => ({ key: s.playerKey, ...s })));
  expect(standings(await details()), 'the match standings').toEqual(want);
  const closed = await until(details, (d) => d.status === 'closed', 30_000);
  expect(standings(closed), 'the summary').toEqual(want);
  expect(closed.ended?.rounds?.[0]?.words).toBeTruthy();
  const periods = (await kit.clients.host.get('/api/v1/leaderboards')).json<{
    periods: { id: string; kind: string }[];
  }>().periods;
  for (const kind of ['season', 'all_time']) {
    const period = periods.find((p) => p.kind === kind);
    const board = (await kit.clients.host.get(`/api/v1/leaderboards/${period?.id ?? ''}`)).json<{
      rows: { displayName: string; points: number }[];
    }>().rows;
    const got = byName(board.map((b) => ({ key: b.displayName, ...b })));
    expect(got, `the ${kind} board`).toEqual(want);
  }
}

describe('a phased round’s points (DECISIONS T340)', () => {
  it('are the same in the result, the table, the standings, the summary and the boards', async () => {
    const want = await expected();
    const { id, sockets } = await playedRound();
    await roundPoints(id, sockets['player-1'] as Socket, want);
    await matchAndBoards(want);
    for (const s of Object.values(sockets)) s.disconnect();
  }, 120_000);
});

describe('the game list (O93)', () => {
  it('says Mind Games shows no season, and every guess game does', async () => {
    const games = (await kit.clients.host.get('/api/v1/games')).json<{
      games: { id: string; seasons: boolean }[];
    }>().games;
    expect(games.find((g) => g.id === 'mind-games')?.seasons).toBe(false);
    const guess = games.filter((g) => g.id !== 'mind-games');
    expect(guess.map((g) => g.id).sort()).toEqual([
      'bomb-defusal',
      'guess-the-number',
      'safecracker',
      'seasonal-target',
    ]);
    expect(guess.every((g) => g.seasons)).toBe(true);
  });
});
