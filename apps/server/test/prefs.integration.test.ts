/**
 * @file   apps/server/test/prefs.integration.test.ts
 * @module server/test
 * @brief  Pre-picks end to end, with the phased fixture: saved, private, played, refused, gone.
 *
 * Responsibility: 04 §4.8 rule 8 and 05 §3.2 on the real server. A player saves their own value
 *                 (a value outside the game's schema is 422, a second save within 2 s 429);
 *                 only they read it (`myPrefs`, `GET …/prefs`), never the host. At a round's
 *                 opening their pick enters as their first choice, received at the opening,
 *                 while they are away; one the round refuses comes to their own socket as
 *                 `prefs.refused` with the round and the code. Leaving the match takes the value
 *                 with it. A Quick Test of a phased game (09 §4.2) has no teams, and its seed
 *                 decides which bots pre-pick, with which picks; those bots are not connected.
 * Depends on:     vitest, socket.io-client, @smg-game/registry (and its testing entry), ./*
 * Spec:           docs/spec/04-software-architecture.md §4.8 rule 8; docs/spec/06-data-model-api-realtime.md §3.1, §4.4
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

interface Details {
  readonly round: { readonly id: string; readonly status: string } | null;
  readonly myPrefs?: unknown;
  readonly series: { nextAt: number | null } | null;
}

const details = async (who: Who) =>
  (await kit.clients[who].get(`/api/v1/matches/${code}`)).json<Details>();

async function until(test: (d: Details) => boolean, ms = 30_000): Promise<Details> {
  const end = Date.now() + ms;
  for (;;) {
    const d = await details('host');
    if (test(d)) return d;
    if (Date.now() > end) throw new Error(`timed out: ${JSON.stringify(d)}`);
    await sleep(200);
  }
}

async function watch(who: Who): Promise<Socket> {
  const s = kit.open(kit.clients[who].cookie);
  expect(await kit.connected(s)).toBe('ok');
  await kit.send(s, 'match.watch', { code });
  return s;
}

// player-2 fixes side b for round 1 and the refused side x for round 2; the value is theirs alone.
async function savedPrefs(): Promise<void> {
  const put = (prefs: unknown) =>
    kit.clients['player-2'].put(`/api/v1/matches/${code}/prefs`, { prefs });
  expect((await put({ picks: { '1': 'q' } })).statusCode).toBe(422);
  await sleep(2_100);
  const prefs = { picks: { '1': 'b', '2': 'x' } };
  expect((await put(prefs)).statusCode).toBe(204);
  expect((await put(prefs)).statusCode).toBe(429);
  expect((await details('player-2')).myPrefs).toEqual(prefs);
  expect((await details('host')).myPrefs ?? null).toBeNull();
  const own = await kit.clients.host.get(`/api/v1/matches/${code}/prefs`);
  expect(own.json<{ prefs: unknown }>().prefs).toBeNull();
  expect((await kit.clients['player-3'].get(`/api/v1/matches/${code}/prefs`)).statusCode).toBe(403);
}

describe('pre-picks (04 §4.8 rule 8)', () => {
  it('play for an away player, stay private, tell a refusal to its owner, go on leaving', async () => {
    const open = await kit.clients.host.post('/api/v1/matches', {
      gameId: 'sides-fixture',
      title: 'prefs',
      maxPlayers: 10,
    });
    code = open.json<{ code: string }>().code;
    await kit.clients['player-1'].post(`/api/v1/matches/${code}/join`, {});
    await kit.clients['player-2'].post(`/api/v1/matches/${code}/join`, {});
    await savedPrefs();
    await watch('host');
    await watch('player-1');
    const r = await kit.clients.host.post(`/api/v1/matches/${code}/rounds`, {
      settings: { 'round.countdownS': 3 },
      season: 'spring',
      startNow: true,
    });
    const id = r.json<{ id: string }>().id;
    // Round 1: player-2 is away and plays side b from the opening on.
    await until((d) => d.round?.status === 'open');
    await sleep(SIDES_PLAN.viewDelayMs + 1_500);
    const state = await kit.clients['player-1'].get(`/api/v1/rounds/${id}/state`);
    const view = state.json<{ opensAt: number; game: { counts: Record<string, number> } }>();
    expect(view.game.counts).toEqual({ a: 0, b: 1, c: 0 });
    const log = await kit.harness.built.runtime.store.log(id);
    const two = await kit.accountId('player-2');
    const entered = log.find(
      (e) => e.type === 'PlayerEntered' && (e.event as { playerId: string }).playerId === two,
    );
    expect((entered?.event as { at: number } | undefined)?.at).toBe(view.opensAt);
    // Round 2: player-2 watches now; the round refuses x, and only player-2 hears it.
    const own = await watch('player-2');
    const refused = new Promise<unknown>((resolve) => own.once('prefs.refused', resolve));
    await until((d) => d.series?.nextAt != null);
    expect(
      (await kit.clients.host.post(`/api/v1/matches/${code}/next-round/start`, {})).statusCode,
    ).toBe(204);
    expect(await refused).toEqual({ roundIndex: 2, code: 'CHOICE_UNAVAILABLE' });
    // Leaving takes the value with it.
    await kit.clients['player-2'].post(`/api/v1/matches/${code}/leave`, {});
    const rows = await kit.harness.pool.query(
      'SELECT 1 FROM smg.match_player_prefs WHERE player_key = $1',
      [two],
    );
    expect(rows.rowCount).toBe(0);
  }, 90_000);
});

describe('the Quick Test of a phased game (09 §4.2)', () => {
  it('lets the seed decide which bots pre-pick and their picks; those stay away', async () => {
    const quick = async () => {
      const r = await kit.clients.host.post('/api/v1/dev/quicktest', {
        gameId: 'sides-fixture',
        bots: 7,
        // With 7 bots the seed `frost` lets bot-05 and bot-06 pre-pick.
        seedText: 'frost',
        countdownS: 3,
        settings: { 'round.inactivityLimitS': 60 },
      });
      expect(r.statusCode).toBe(201);
      const started = r.json<{ matchCode: string }>().matchCode;
      const rows = await kit.harness.pool.query<{ player_key: string; prefs: unknown }>(
        `SELECT p.player_key, p.prefs FROM smg.match_player_prefs p JOIN smg.matches m ON m.id = p.match_id
         WHERE m.code = $1 ORDER BY p.player_key`,
        [started],
      );
      const d = (await kit.clients.host.get(`/api/v1/matches/${started}`)).json<{
        connected: string[];
        teamMatch: boolean;
      }>();
      await kit.clients.host.post(`/api/v1/matches/${started}/abort`, { reason: 'test done' });
      return { rows: rows.rows, connected: d.connected, teamMatch: d.teamMatch };
    };
    const first = await quick();
    // The same bot keys again: past the 2 s between two saves of one account.
    await sleep(2_100);
    const second = await quick();
    expect(first.teamMatch).toBe(false);
    expect(first.rows.map((r) => r.player_key)).toEqual(['bot-05', 'bot-06']);
    expect(second.rows).toEqual(first.rows);
    for (const row of first.rows) expect(first.connected).not.toContain(row.player_key);
  }, 60_000);
});

describe('the seats of a Quick Test match (DECISIONS T336)', () => {
  it('lets a person join beside the bots, in a guess game and a phased one', async () => {
    for (const gameId of ['guess-the-number', 'sides-fixture']) {
      const r = await kit.clients.host.post('/api/v1/dev/quicktest', {
        gameId,
        bots: 3,
        countdownS: 3,
      });
      expect(r.statusCode).toBe(201);
      const code = r.json<{ matchCode: string }>().matchCode;
      const d = (await kit.clients.host.get(`/api/v1/matches/${code}`)).json<{
        maxPlayers: number;
      }>();
      expect(d.maxPlayers).toBeGreaterThan(4);
      expect(
        (await kit.clients['player-3'].post(`/api/v1/matches/${code}/join`, {})).statusCode,
      ).toBe(204);
      await kit.clients.host.post(`/api/v1/matches/${code}/abort`, { reason: 'test done' });
    }
  }, 60_000);
});
