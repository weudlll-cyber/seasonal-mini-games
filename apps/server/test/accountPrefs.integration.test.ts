/**
 * @file   apps/server/test/accountPrefs.integration.test.ts
 * @module server/test
 * @brief  A player's value across matches and during a round: the account's keys, later rounds.
 *
 * Responsibility: owner decisions O116 and O117 on the real server. Seasonal Mind Games' "Hide my
 *                 switches" is kept with the account: saved in one match it is the player's value
 *                 in a new match too, the match's own row holds the picks only, and a change in
 *                 either match shows in both. A pre-pick saved while a round runs (the phased
 *                 fixture's series) changes nothing in that round and plays at the later round's
 *                 opening. The matches are aborted and the account rows made here removed.
 * Depends on:     vitest, @smg-game/registry (and its testing entry), ./harness, ./socketKit
 * Spec:           docs/spec/04-software-architecture.md §4.8 rule 8; docs/spec/02e-game-mind-games.md §7
 */
import { GAMES } from '@smg-game/registry';
import { SIDES_FIXTURE, SIDES_PLAN } from '@smg-game/registry/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SUITE_TIMEOUT_MS } from './harness.js';
import { startSocketKit, type SocketKit, type Who } from './socketKit.js';

let kit: SocketKit;
const codes: string[] = [];

beforeAll(async () => {
  kit = await startSocketKit({}, [...GAMES, SIDES_FIXTURE]);
}, SUITE_TIMEOUT_MS);

afterAll(async () => {
  for (const code of codes)
    await kit.clients.host.post(`/api/v1/matches/${code}/abort`, { reason: 'test done' });
  await kit.harness.pool.query('DELETE FROM smg.account_game_prefs');
  await kit.close();
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, Math.max(0, ms)));

// A new match of the host's, joined by the players named.
async function match(gameId: string, players: readonly Who[]): Promise<string> {
  const r = await kit.clients.host.post('/api/v1/matches', {
    gameId,
    title: 'prefs',
    maxPlayers: 10,
  });
  const code = r.json<{ code: string }>().code;
  codes.push(code);
  for (const who of players) await kit.clients[who].post(`/api/v1/matches/${code}/join`, {});
  return code;
}

const mine = async (who: Who, code: string) =>
  (await kit.clients[who].get(`/api/v1/matches/${code}`)).json<{ myPrefs?: unknown }>().myPrefs;
const put = (who: Who, code: string, prefs: unknown) =>
  kit.clients[who].put(`/api/v1/matches/${code}/prefs`, { prefs });

describe('Hide my switches, kept with the account (O116)', () => {
  it('holds in a new match, is not stored with the match, and changes everywhere', async () => {
    const first = await match('mind-games', ['player-1']);
    expect(
      (await put('player-1', first, { picks: { '2': 'summer' }, hide: true })).statusCode,
    ).toBe(204);
    expect(await mine('player-1', first)).toEqual({ picks: { '2': 'summer' }, hide: true });
    const row = await kit.harness.pool.query<{ prefs: unknown }>(
      `SELECT p.prefs FROM smg.match_player_prefs p JOIN smg.matches m ON m.id = p.match_id
       WHERE m.code = $1`,
      [first],
    );
    expect(row.rows[0]?.prefs).toEqual({ picks: { '2': 'summer' } });
    // A new match: no picks there, the box as the player left it.
    const second = await match('mind-games', ['player-1']);
    expect(await mine('player-1', second)).toEqual({ hide: true });
    await sleep(2_100);
    expect((await put('player-1', second, { picks: {}, hide: false })).statusCode).toBe(204);
    expect(await mine('player-1', first)).toEqual({ picks: { '2': 'summer' }, hide: false });
  }, 60_000);
});

describe('pre-picks during a round (O117)', () => {
  it('leave the running round alone and play at the later round', async () => {
    const code = await match('sides-fixture', ['player-1', 'player-2']);
    // The host and player-1 are here; player-2 is away.
    for (const who of ['host', 'player-1'] as const) {
      const socket = kit.open(kit.clients[who].cookie);
      expect(await kit.connected(socket)).toBe('ok');
      await kit.send(socket, 'match.watch', { code });
    }
    const r = await kit.clients.host.post(`/api/v1/matches/${code}/rounds`, {
      settings: { 'round.countdownS': 3 },
      season: 'spring',
      startNow: true,
    });
    const first = r.json<{ id: string }>().id;
    const status = async () =>
      (await kit.clients.host.get(`/api/v1/matches/${code}`)).json<{
        round: { id: string; status: string } | null;
        series: { nextAt: number | null } | null;
      }>();
    while ((await status()).round?.status !== 'open') await sleep(200);
    // While round 1 runs, player-2 fixes a side for round 1 and for round 2.
    expect((await put('player-2', code, { picks: { '1': 'a', '2': 'c' } })).statusCode).toBe(204);
    await sleep(SIDES_PLAN.viewDelayMs + 1_500);
    const counts = async (id: string) =>
      (await kit.clients['player-1'].get(`/api/v1/rounds/${id}/state`)).json<{
        game: { counts: Record<string, number> };
      }>().game.counts;
    expect(await counts(first)).toEqual({ a: 0, b: 0, c: 0 });
    while ((await status()).series?.nextAt == null) await sleep(200);
    await kit.clients.host.post(`/api/v1/matches/${code}/next-round/start`, {});
    let second = (await status()).round;
    while (second?.id === first || second?.status !== 'open') {
      await sleep(200);
      second = (await status()).round;
    }
    await sleep(SIDES_PLAN.viewDelayMs + 1_500);
    expect(await counts(second.id)).toEqual({ a: 0, b: 0, c: 1 });
  }, 90_000);
});
