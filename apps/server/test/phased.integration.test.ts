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
 *                 round runs may enter; the round ends at its time-up, the host's hold after
 *                 its plan (T384); with the game's results, nobody placed, the winner's `won`
 *                 counted as a win in the standings. The delay and the end are checked by the
 *                 server's own times (each event's receive time `at`, the release numbers, the
 *                 stated `endsAt`, the recorded end), and the test waits for the frames it
 *                 checks, not for fixed times (DECISIONS T387).
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
// The round's hold before the result, in seconds.
const HOLD_S = 2;

beforeAll(async () => {
  kit = await startSocketKit({}, [...GAMES, SIDES_FIXTURE]);
}, SUITE_TIMEOUT_MS);

afterAll(async () => {
  if (code !== '')
    await kit.clients.host.post(`/api/v1/matches/${code}/abort`, { reason: 'test done' });
  await kit.close();
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, Math.max(0, ms)));

// The test's budget; the waits below end with it, never sooner.
const TEST_MS = 60_000;
let deadline = 0;

interface Frame {
  readonly roundId: string;
  readonly s?: number;
  readonly events: readonly {
    readonly s: number;
    // The server's receive time of the action (delayedRoom, views).
    readonly at: number;
    readonly event: { readonly type: string } | null;
  }[];
}

// Every frame each socket received, with its arrival by the test's clock, which is the
// server's (in-process): a delayed event may arrive late under load, never early.
const arrived = new Map<Socket, { readonly got: number; readonly frame: Frame }[]>();

// The first event of `type` in this round that `s` received, with its frame's arrival.
function eventOf(s: Socket, roundId: string, type: string) {
  for (const { got, frame } of arrived.get(s) ?? []) {
    if (frame.roundId !== roundId) continue;
    const e = frame.events.find((x) => x.event?.type === type);
    if (e !== undefined) return { got, s: e.s, at: e.at };
  }
  return undefined;
}

// Waits for `found` to give something, within the test's budget: for the condition a check
// is about, not for a fixed time.
async function until<T>(found: () => T | undefined, what: string): Promise<T> {
  for (;;) {
    const v = found();
    if (v !== undefined) return v;
    if (Date.now() > deadline) throw new Error(`never came: ${what}`);
    await sleep(50);
  }
}

interface StateView {
  readonly seq: number;
  readonly opensAt: number;
  readonly endsAt: number | null;
  readonly endReason: string | null;
  readonly roster: readonly { readonly playerKey: string; readonly guesses: number }[];
  readonly game: { readonly counts?: Record<string, number> } | null;
  readonly role: string;
}

async function watching(who: readonly Who[]): Promise<Record<string, Socket>> {
  const sockets: Record<string, Socket> = {};
  for (const w of who) {
    const s = kit.open(kit.clients[w].cookie);
    const list: { got: number; frame: Frame }[] = [];
    arrived.set(s, list);
    s.on('events', (frame: Frame) => list.push({ got: Date.now(), frame }));
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
    // A hold of 2 s, so the end shows it is the host's and not the old settle of 1 s (T384).
    settings: { 'round.countdownS': 3, 'round.resultHoldS': HOLD_S },
    season: 'summer',
    startNow: true,
  });
  expect(created.statusCode).toBe(201);
  const id = created.json<{ id: string }>().id;
  const opensAt = (await stateOf('player-2', id)).opensAt;
  await sleep(opensAt - Date.now() + 100);
  return { s, id, opensAt };
}

// Everything that `s` received of this round's delayed events (the entries and the game's
// moves) arrived no earlier than one delay after the server received the action.
function neverEarly(s: Socket, roundId: string): void {
  for (const { got, frame } of arrived.get(s) ?? []) {
    if (frame.roundId !== roundId) continue;
    for (const e of frame.events) {
      if (e.event?.type !== 'Game' && e.event?.type !== 'PlayerEntered') continue;
      expect(got, e.event.type).toBeGreaterThanOrEqual(e.at + SIDES_PLAN.viewDelayMs);
    }
  }
}

// player-1's pick: hidden from everyone else until one delay after the server received it,
// then in the room in order, with gap-free release numbers that the state answer's seq
// follows. By the server's own times (its receive time and release numbers), not the test's
// clock: a look 300 ms after the pick arrived after the release under load (MG-MERGE-3).
async function hiddenThenReleased(s: Sockets, id: string): Promise<void> {
  const p1 = s['player-1'] as Socket;
  const p3 = s['player-3'] as Socket;
  // The acknowledgement carries nothing but its answer (rule 4).
  expect(await pick(p1, id, 'a')).toEqual({ ok: true });
  // player-1's own frame comes at once and names the server's receive time.
  const own = await until(() => eventOf(p1, id, 'Game'), 'player-1’s own pick');
  const releaseAt = own.at + SIDES_PLAN.viewDelayMs;
  expect((await stateOf('player-1', id)).game).toMatchObject({ own: 'a' });
  const looks: { v: StateView; answered: number }[] = [];
  for (const who of ['player-2', 'player-3'] as const) {
    const v = await stateOf(who, id);
    looks.push({ v, answered: Date.now() });
  }
  const entered = await until(() => eventOf(p3, id, 'PlayerEntered'), 'the release');
  for (const w of ['player-2', 'player-3', 'host']) neverEarly(s[w] as Socket, id);
  // Each look shows the pick exactly when its seq has reached the release, and shows it only
  // if the server answered once the pick was a delay old.
  for (const { v, answered } of looks) {
    const shown = v.seq >= entered.s;
    expect(v.roster.length).toBe(shown ? 1 : 0);
    expect(v.game?.counts).toEqual({ a: shown ? 1 : 0, b: 0, c: 0 });
    expect(!shown || answered >= releaseAt).toBe(true);
  }
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
async function results(s: Sockets, id: string, opensAt: number): Promise<void> {
  // The time-up comes the host's hold after the plan's end (DECISIONS T384): the round states
  // it, ends by it, and its recorded end (below) is not before it. The server's own times, not
  // the test's clock: a look half a second before the time-up arrived after it under load, so
  // the test waits for the end's frame instead (BACKLOG part two, MG-MERGE-3).
  const timeUp = opensAt + SIDES_PLAN.endMs + HOLD_S * 1_000;
  expect((await stateOf('player-2', id)).endsAt).toBe(timeUp);
  await until(() => eventOf(s['player-2'] as Socket, id, 'RoundEnded'), 'the round’s end');
  const ended = await stateOf('player-2', id);
  expect(ended).toMatchObject({ role: 'result', endReason: 'timeUp' });
  // The game's result view, although the fixture has no secret (DECISIONS T324).
  expect(ended.game).toMatchObject({ counts: { a: 0, b: 1, c: 1 } });
  // The view runs ahead of the log by the batches still being written (the proof route drains
  // for the same reason): the rows are read once the end's batch is committed.
  const read = () =>
    kit.harness.pool.query<{ place: number | null; won: boolean; points: number }>(
      'SELECT place, won, points FROM smg.round_results WHERE round_id = $1 ORDER BY player_key',
      [id],
    );
  let rows = await read();
  for (let tries = 0; tries < 50 && rows.rows.length === 0; tries += 1) {
    await sleep(100);
    rows = await read();
  }
  // The round ran its hold: the end the server recorded is not before the time-up.
  const end = await kit.harness.pool.query<{ at: number }>(
    'SELECT round(extract(epoch FROM ended_at) * 1000)::float8 AS at FROM smg.rounds WHERE id = $1',
    [id],
  );
  expect(end.rows[0]?.at).toBeGreaterThanOrEqual(timeUp);
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
  it(
    'delays the room, refuses by the windows and ends with the game’s results',
    async () => {
      deadline = Date.now() + TEST_MS;
      const { s, id, opensAt } = await startedRound();
      await hiddenThenReleased(s, id);
      await windows(s, id, opensAt);
      await results(s, id, opensAt);
    },
    TEST_MS,
  );
});
