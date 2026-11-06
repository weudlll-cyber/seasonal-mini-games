/**
 * @file   apps/server/test/inactivity.integration.test.ts
 * @module server/test
 * @brief  The inactivity limit (O71) in a real round: the actor's timer, the refusal, the
 *         log, recovery on a second server and the round's end.
 *
 * Responsibility: with a 20 s limit and a 5 s warning, the state gives each roster player
 *                 their deadlines from the open (server times, as the cooldown end); idle
 *                 players are timed out by the round's own timer with no command arriving,
 *                 the log's PlayerTimedOut carries the deadline; a timed-out player's guess is
 *                 TIMED_OUT; a second server on the same database replays the same state; the
 *                 one player left times out too and the shared round ends without a winner
 *                 ("no players left"), each of them "timed out" in the results.
 * Depends on:     vitest, socket.io-client (types), ../src/match/publicIds, ./harness, ./socketKit
 * Spec:           docs/spec/02-game-guess-the-number.md §5.3, §8; docs/spec/04-software-architecture.md §5.2;
 *                 docs/spec/06-data-model-api-realtime.md §2.3
 */
import type { Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { toPublic } from '../src/match/publicIds.js';
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

interface Row {
  readonly playerKey: string;
  readonly timedOut: boolean;
  readonly inactivity: { readonly warnAt: number; readonly outAt: number } | null;
}
interface State {
  readonly status: string;
  readonly opensAt: number;
  readonly endReason: string | null;
  readonly winner: string | null;
  readonly roster: readonly Row[];
  readonly results?: readonly { playerId: string; place: number | null; timedOut: boolean }[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function stateOf(id: string): Promise<State> {
  return (await kit.clients['player-1'].get(`/api/v1/rounds/${id}/state`)).json<State>();
}

// Reads the state every 200 ms until `done` holds (a timer on a busy machine runs late).
async function until(id: string, done: (s: State) => boolean, ms = 40_000): Promise<State> {
  const end = Date.now() + ms;
  for (;;) {
    const s = await stateOf(id);
    if (done(s) || Date.now() > end) return s;
    await sleep(200);
  }
}

async function watching(code: string, who: readonly Who[]): Promise<Record<string, Socket>> {
  const sockets: Record<string, Socket> = {};
  for (const w of who) {
    const s = kit.open(kit.clients[w].cookie);
    expect(await kit.connected(s)).toBe('ok');
    expect((await kit.send(s, 'match.watch', { code })).ok).toBe(true);
    sockets[w] = s;
  }
  return sockets;
}

// A started shared round with the shortest limit, open by the time this returns.
async function idleRound(code: string, s: Record<string, Socket>): Promise<string> {
  const r = await kit.clients.host.post(`/api/v1/matches/${code}/rounds`, {
    settings: {
      'round.cooldownS': 3,
      'round.countdownS': 3,
      'round.inactivityLimitS': 20,
      'round.inactivityWarnS': 5,
    },
    season: 'spring',
  });
  expect(r.statusCode).toBe(201);
  const id = r.json<{ id: string }>().id;
  expect((await kit.send(s.host as Socket, 'round.start', { roundId: id })).ok).toBe(true);
  const { opensAt } = await stateOf(id);
  await sleep(Math.max(0, opensAt - Date.now()) + 50);
  return id;
}

describe('the inactivity limit in a real round (O71)', () => {
  it('times idle players out by the round timer, refuses them, replays and ends', async () => {
    const code = await kit.openMatch(['player-1', 'player-2']);
    opened.push(code);
    const s = await watching(code, ['host', 'player-1', 'player-2']);
    const id = await idleRound(code, s);
    const open = await stateOf(id);
    for (const row of open.roster) {
      expect(row).toMatchObject({
        timedOut: false,
        inactivity: { warnAt: open.opensAt + 5_000, outAt: open.opensAt + 20_000 },
      });
    }
    // Player 1 guesses after 10 s: their clock starts again when the 3 s cooldown is over.
    await sleep(10_000);
    const secrets = await kit.secretsOf(id);
    const wrong = secrets.mode === 'shared' && secrets.value === 1 ? 2 : 1;
    const p1 = s['player-1'] as Socket;
    const guess = await kit.send(p1, 'guess', { roundId: id, value: wrong });
    expect(guess.ok).toBe(true);
    const p1Key = await kit.numberOf(code, 'player-1');
    const p1Row = (await stateOf(id)).roster.find((r) => r.playerKey === p1Key);
    expect(p1Row?.inactivity?.outAt).toBe((guess.cooldownEndsAt ?? 0) + 20_000);

    // Nobody sends anything: the round's own timer times the other two out at their limit.
    const out = await until(id, (st) => st.roster.filter((r) => r.timedOut).length === 2);
    expect(out.status).toBe('open');
    expect(out.roster.filter((r) => r.timedOut).map((r) => r.playerKey)).not.toContain(p1Key);
    const log = await kit.harness.built.runtime.store.log(id);
    const timedOut = log.filter((e) => e.type === 'PlayerTimedOut');
    expect(timedOut.map((e) => (e.event as { at: number }).at)).toEqual([
      open.opensAt + 20_000,
      open.opensAt + 20_000,
    ]);
    const late = await kit.send(s['player-2'] as Socket, 'guess', { roundId: id, value: wrong });
    expect(late).toMatchObject({ ok: false, code: 'TIMED_OUT' });

    await sameOnSecondServer(id, out);

    // The last player still in times out too: a shared round with nobody left ends.
    const end = await until(id, (st) => st.status === 'ended');
    expect(end).toMatchObject({ status: 'ended', endReason: 'noPlayers', winner: null });
    expect(end.results?.every((r) => r.timedOut && r.place === null)).toBe(true);
  }, 90_000);
});

// Recovery: a second server replays the log, PlayerTimedOut included, to the same view.
async function sameOnSecondServer(id: string, before: State): Promise<void> {
  const second = await buildOn(kit.harness.pool, kit.harness.container.getConnectionUri());
  try {
    const round = await second.runtime.rounds.get(id);
    const viewer = await kit.accountId('player-1');
    const numbers = await second.runtime.play.numbers.ready(round?.matchId ?? '');
    const after = toPublic(round?.view(viewer), numbers) as State;
    expect(after.roster).toEqual(before.roster);
  } finally {
    await second.fastify.close();
  }
}
