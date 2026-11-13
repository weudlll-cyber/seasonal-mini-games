/**
 * @file   apps/server/test/phased.integration.test.ts
 * @module server/test
 * @brief  A phased round end to end over sockets and HTTP, with the phased fixture game.
 *
 * Responsibility: 04 §4.8 rules 1–6 on the real server (09 §4.2 "Platform"): a match of a game
 *                 without teams has none; the acknowledgement is `{ ok: true }` only; nothing
 *                 younger than the delay reaches another player, a spectator or the admin view
 *                 (frames, state answers, the round's list of players), and the release
 *                 numbers are gap-free and never the log's; the windows refuse by the server's
 *                 receive time (JOIN_CLOSED, PLAY_OVER); a match player who joins while the
 *                 round runs may enter; the round ends at its plan with the game's results,
 *                 nobody placed, the winner's `won` counted as a win in the standings.
 * Depends on:     vitest, socket.io-client, @smg-game/registry (and its testing entry), ./*
 * Spec:           docs/spec/04-software-architecture.md §4.8; docs/spec/05-security-threat-model.md §3.2
 */
import { GAMES } from '@smg-game/registry';
import { SIDES_FIXTURE, SIDES_PLAN } from '@smg-game/registry/testing';
import type { Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SUITE_TIMEOUT_MS } from './harness.js';
import { startSocketKit, type SocketKit, type Who } from './socketKit.js';

let kit: SocketKit;
let code = '';

beforeAll(async () => {
  kit = await startSocketKit({}, [...GAMES, SIDES_FIXTURE]);
}, SUITE_TIMEOUT_MS);

afterAll(async () => {
  if (code !== '')
    await kit.clients.host.post(`/api/v1/matches/${code}/abort`, { reason: 'test done' });
  await kit.close();
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, Math.max(0, ms)));

interface Frame {
  readonly roundId: string;
  readonly s?: number;
  readonly events: readonly {
    readonly s: number;
    readonly event: { readonly type: string } | null;
  }[];
}

interface StateView {
  readonly seq: number;
  readonly opensAt: number;
  readonly roster: readonly { readonly playerKey: string; readonly guesses: number }[];
  readonly game: { readonly counts?: Record<string, number> } | null;
  readonly role: string;
}

async function watching(who: readonly Who[]): Promise<Record<string, Socket>> {
  const sockets: Record<string, Socket> = {};
  for (const w of who) {
    const s = kit.open(kit.clients[w].cookie);
    expect(await kit.connected(s)).toBe('ok');
    expect((await kit.send(s, 'match.watch', { code })).ok).toBe(true);
    sockets[w] = s;
  }
  return sockets;
}

const stateOf = async (who: Who, id: string) =>
  (await kit.clients[who].get(`/api/v1/rounds/${id}/state`)).json<StateView>();

const pick = (s: Socket, roundId: string, side: string) =>
  kit.send(s, 'guess', { roundId, value: side });

// The event types every frame of a socket carried for this round.
const typesSeen = (s: Socket, roundId: string) =>
  (kit.frames(s) as Frame[])
    .filter((f) => f.roundId === roundId)
    .flatMap((f) => f.events.map((e) => e.event?.type ?? 'null'));

type Sockets = Record<string, Socket>;

// A match of the fixture with two players watching (and a third, not yet in it), its round
// started at once; returns the round and its opening.
async function startedRound(): Promise<{ s: Sockets; id: string; opensAt: number }> {
  const open = await kit.clients.host.post('/api/v1/matches', {
    gameId: 'sides-fixture',
    title: 'phased',
    maxPlayers: 10,
  });
  expect(open.statusCode).toBe(201);
  // A game without teams makes a match without them (rule 3).
  expect(open.json<{ teamMatch: boolean }>().teamMatch).toBe(false);
  code = open.json<{ code: string }>().code;
  await kit.clients['player-1'].post(`/api/v1/matches/${code}/join`, {});
  await kit.clients['player-2'].post(`/api/v1/matches/${code}/join`, {});
  const s = await watching(['host', 'player-1', 'player-2', 'player-3']);
  const created = await kit.clients.host.post(`/api/v1/matches/${code}/rounds`, {
    settings: { 'round.countdownS': 3 },
    season: 'summer',
    startNow: true,
  });
  expect(created.statusCode).toBe(201);
  const id = created.json<{ id: string }>().id;
  const opensAt = (await stateOf('player-2', id)).opensAt;
  await sleep(opensAt - Date.now() + 100);
  return { s, id, opensAt };
}

// player-1's pick: hidden from everyone else until one delay and a tick later, then in the
// room in order, with gap-free release numbers that the state answer's seq follows.
async function hiddenThenReleased(s: Sockets, id: string): Promise<void> {
  // The acknowledgement carries nothing but its answer (rule 4).
  expect(await pick(s['player-1'] as Socket, id, 'a')).toEqual({ ok: true });
  await sleep(300);
  for (const who of ['player-2', 'player-3'] as const) {
    const v = await stateOf(who, id);
    expect(v.roster).toEqual([]);
    expect(v.game?.counts).toEqual({ a: 0, b: 0, c: 0 });
  }
  for (const w of ['player-2', 'player-3', 'host']) {
    expect(typesSeen(s[w] as Socket, id)).not.toContain('Game');
    expect(typesSeen(s[w] as Socket, id)).not.toContain('PlayerEntered');
  }
  expect(typesSeen(s['player-1'] as Socket, id)).toContain('Game');
  expect((await stateOf('player-1', id)).game).toMatchObject({ own: 'a' });
  await sleep(SIDES_PLAN.viewDelayMs + 1_200);
  const later = await stateOf('player-3', id);
  expect(later.game?.counts).toEqual({ a: 1, b: 0, c: 0 });
  expect(later.roster.map((r) => r.guesses)).toEqual([0]);
  const seen = typesSeen(s['player-3'] as Socket, id);
  expect(seen).toEqual(expect.arrayContaining(['PlayerEntered', 'Game']));
  expect(seen).not.toContain('GuessAccepted');
  const numbers = (kit.frames(s['player-3'] as Socket) as Frame[])
    .filter((f) => f.roundId === id)
    .flatMap((f) => f.events.map((e) => e.s));
  expect(numbers).toEqual(numbers.map((_, i) => (numbers[0] ?? 1) + i));
  expect(later.seq).toBe(numbers.at(-1));
}

// A newcomer to the match enters inside the entry window; after it a newcomer is refused and
// someone in the round still switches; after play nobody acts (rule 2, by receive time).
async function windows(s: Sockets, id: string, opensAt: number): Promise<void> {
  await kit.clients['player-3'].post(`/api/v1/matches/${code}/join`, {});
  expect(await pick(s['player-3'] as Socket, id, 'b')).toEqual({ ok: true });
  await sleep(opensAt + SIDES_PLAN.entryEndMs - Date.now() + 100);
  const late = await pick(s['player-2'] as Socket, id, 'c');
  expect(late).toEqual({ ok: false, code: 'JOIN_CLOSED' });
  expect(await pick(s['player-1'] as Socket, id, 'c')).toEqual({ ok: true });
  await sleep(opensAt + SIDES_PLAN.actionsEndMs - Date.now() + 100);
  expect(await pick(s['player-1'] as Socket, id, 'a')).toEqual({ ok: false, code: 'PLAY_OVER' });
}

// The end: the game's results, nobody placed, every winner's win in the standings (rule 6).
async function results(id: string, opensAt: number): Promise<void> {
  await sleep(opensAt + SIDES_PLAN.endMs - Date.now() + 500);
  expect((await stateOf('player-2', id)).role).toBe('result');
  const rows = await kit.harness.pool.query<{ place: number | null; won: boolean; points: number }>(
    'SELECT place, won, points FROM smg.round_results WHERE round_id = $1 ORDER BY player_key',
    [id],
  );
  expect(rows.rows.every((r) => r.place === null)).toBe(true);
  // Sides b and c were taken once each: both are the least taken, so both players win.
  expect(rows.rows.map((r) => [r.won, r.points])).toEqual([
    [true, 1],
    [true, 1],
  ]);
  const standings = await kit.harness.pool.query<{ wins: number; points: number }>(
    `SELECT s.wins, s.points FROM smg.match_standings s JOIN smg.matches m ON m.id = s.match_id
     WHERE m.code = $1`,
    [code],
  );
  expect(standings.rows.map((r) => [r.wins, r.points])).toEqual([
    [1, 1],
    [1, 1],
  ]);
}

describe('a phased round (04 §4.8)', () => {
  it('delays the room, refuses by the windows and ends with the game’s results', async () => {
    const { s, id, opensAt } = await startedRound();
    await hiddenThenReleased(s, id);
    await windows(s, id, opensAt);
    await results(id, opensAt);
  }, 60_000);
});
