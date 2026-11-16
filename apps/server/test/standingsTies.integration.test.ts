/**
 * @file   apps/server/test/standingsTies.integration.test.ts
 * @module server/test
 * @brief  Equal match totals: shared and listed by name in Mind Games, ordered by wins elsewhere.
 *
 * Responsibility: owner decision O100. A Seasonal Mind Games series of three real rounds over
 *                 sockets: round 1 with All on, the host alone on All (+2); rounds 2 and 3
 *                 without All, player-1 and player-2 each alone on a season (+1 twice). Three
 *                 players end on 2 points, one from an All win and two from two wins: after the
 *                 last round and in the closed match's summary they share place 1, listed by
 *                 display name (dev-host, dev-player-1, dev-player-2), and player-3 is 4th. A
 *                 Guess The Number match with the same tie, two shared rounds won by player-2 and
 *                 then player-1, keeps today's order: the earlier win first, places 1 and 2.
 * Depends on:     vitest, socket.io-client, ./harness, ./socketKit
 * Spec:           docs/spec/02-game-guess-the-number.md §9; docs/spec/02e-game-mind-games.md §9
 */
import type { Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SUITE_TIMEOUT_MS } from './harness.js';
import { startSocketKit, type SocketKit, type Who } from './socketKit.js';

const WHO: readonly Who[] = ['host', 'player-1', 'player-2', 'player-3'];
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Details {
  readonly status: string;
  readonly round: { readonly id: string; readonly status: string } | null;
  readonly standings: readonly { rank: number; name: string; points: number; wins: number }[];
}

const details = async (code: string) =>
  (await kit.clients.host.get(`/api/v1/matches/${code}`)).json<Details>();

async function until<T>(read: () => Promise<T>, ok: (v: T) => boolean, ms: number): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await read();
    if (ok(v)) return v;
    if (Date.now() > end) throw new Error(`timed out: ${JSON.stringify(v)}`);
    // Once a second: the host's session may make 120 API requests a minute (05 §5).
    await sleep(1_000);
  }
}

// The four accounts in a new match of the game, each watching it over a socket.
async function match(gameId: string): Promise<{ code: string; sockets: Record<Who, Socket> }> {
  const r = await kit.clients.host.post('/api/v1/matches', {
    gameId,
    title: 'ties',
    maxPlayers: 10,
  });
  const code = r.json<{ code: string }>().code;
  opened.push(code);
  const sockets = {} as Record<Who, Socket>;
  for (const who of WHO) {
    if (who !== 'host') await kit.clients[who].post(`/api/v1/matches/${code}/join`, {});
    const s = kit.open(kit.clients[who].cookie);
    expect(await kit.connected(s)).toBe('ok');
    const watched = await kit.send(s, 'match.watch', { code });
    expect(watched, `${who} watches ${code} (${String(r.statusCode)})`).toMatchObject({ ok: true });
    sockets[who] = s;
  }
  return { code, sockets };
}

const rows = (d: Details) => d.standings.map((s) => [s.rank, s.name, s.points]);

// One Mind Games round: every player's choice sent once the round takes it, then its end.
async function mindRound(
  code: string,
  sockets: Record<Who, Socket>,
  after: string | null,
  choices: Readonly<Record<Who, string>>,
): Promise<string> {
  const d = await until(
    () => details(code),
    (x) => x.round !== null && x.round.id !== after,
    30_000,
  );
  const id = d.round?.id ?? '';
  for (const who of WHO) {
    const value = { choice: choices[who], hide: false };
    await until(
      () => kit.send(sockets[who], 'guess', { roundId: id, value }),
      (a) => a.ok,
      15_000,
    );
  }
  await until(
    () => details(code),
    (x) => x.round?.status === 'ended' || x.round?.id !== id,
    45_000,
  );
  return id;
}

describe('equal match totals (O100)', () => {
  it('share a place in Mind Games, listed by name, after a round and in the summary', async () => {
    const { code, sockets } = await match('mind-games');
    const timing = { 'mind.totalS': 30, 'mind.delayAuto': false, 'mind.delayS': 5 };
    const series = { ...timing, 'mind.rounds': 3, 'mind.pauseS': 5, 'round.countdownS': 3 };
    await kit.clients.host.post(`/api/v1/matches/${code}/rounds`, {
      settings: { ...series, 'mind.allOption': true },
      season: 'summer',
      startNow: true,
    });
    const all = { host: 'all', 'player-1': 'summer', 'player-2': 'summer', 'player-3': 'summer' };
    const r1 = await mindRound(code, sockets, null, all);
    await kit.clients.host.put(`/api/v1/matches/${code}/next-round`, {
      season: 'summer',
      settings: { ...series, 'mind.allOption': false },
    });
    // Spring and Autumn chosen once, the least: player-1 and player-2 win, twice.
    const two = {
      host: 'winter',
      'player-1': 'spring',
      'player-2': 'autumn',
      'player-3': 'winter',
    };
    const r2 = await mindRound(code, sockets, r1, two);
    const r3 = await mindRound(code, sockets, r2, two);
    const afterRound = await until(
      () => details(code),
      (x) => x.round?.id === r3 && x.standings.filter((s) => s.points === 2).length === 3,
      20_000,
    );
    const shared = [
      [1, 'dev-host', 2],
      [1, 'dev-player-1', 2],
      [1, 'dev-player-2', 2],
      [4, 'dev-player-3', 0],
    ];
    expect(rows(afterRound)).toEqual(shared);
    const closed = await until(
      () => details(code),
      (x) => x.status === 'closed',
      30_000,
    );
    expect(rows(closed)).toEqual(shared);
    for (const x of Object.values(sockets)) x.disconnect();
  }, 180_000);
});

describe('equal match totals in another game', () => {
  it('keep ordering by the earliest win', async () => {
    const { code, sockets } = await match('guess-the-number');
    for (const winner of ['player-2', 'player-1'] as const) {
      const round = await kit.clients.host.post(`/api/v1/matches/${code}/rounds`, {
        settings: {
          'round.countdownS': 3,
          'round.secretMode': 'shared',
          'round.inactivityLimitS': 0,
        },
        season: 'spring',
        startNow: true,
      });
      const id = round.json<{ id: string }>().id;
      const secrets = await kit.secretsOf(id);
      const value = secrets.mode === 'shared' ? secrets.value : 0;
      await until(
        () => kit.send(sockets[winner], 'guess', { roundId: id, value }),
        (a) => a.ok,
        15_000,
      );
      await until(
        () => details(code),
        (x) => x.round?.status === 'ended',
        15_000,
      );
    }
    for (const x of Object.values(sockets)) x.disconnect();
    const d = await details(code);
    // Equal points; player-2 won first, so it stays above player-1, on a place of its own.
    expect(rows(d).slice(0, 2)).toEqual([
      [1, 'dev-player-2', 10],
      [2, 'dev-player-1', 10],
    ]);
  }, 90_000);
});
