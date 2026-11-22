/**
 * @file   apps/server/test/accountPrefs.integration.test.ts
 * @module server/test
 * @brief  A player's value across matches and during a round: the account's keys, later rounds.
 *
 * Responsibility: owner decisions O116 and O117 on the real server. Seasonal Mind Games' "Hide my
 *                 switches" is kept with the account: saved in one match it is the player's value
 *                 in a new match too, the match's own row holds the picks only, and a change in
 *                 either match shows in both. A pre-pick saved once the round's opening has
 *                 committed (the phased fixture's series) changes nothing in that round and plays at
 *                 the later round's opening; one whose save commits while the opening is on its
 *                 way to its commit (the test's own save, written under the match's prefs lock as
 *                 the server's are, holds the opening until it commits) plays in that round. Both
 *                 wait on the database, not on timing. The matches are aborted and the account
 *                 rows made here removed.
 * Depends on:     vitest, @smg-game/registry (and its testing entry), ../src/match/prefs,
 *                 ./harness, ./socketKit
 * Spec:           docs/spec/04-software-architecture.md §4.8 rule 8; docs/spec/02e-game-mind-games.md §7
 */
import { GAMES } from '@smg-game/registry';
import { SIDES_FIXTURE, SIDES_PLAN } from '@smg-game/registry/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PREFS_LOCK_SHARED_SQL } from '../src/match/prefs.js';
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

// A sides-fixture match with the host and player-1 watching; `away` has joined but is away.
async function watchedMatch(away: Who): Promise<string> {
  const code = await match('sides-fixture', ['player-1', away]);
  for (const who of ['host', 'player-1'] as const) {
    const socket = kit.open(kit.clients[who].cookie);
    expect(await kit.connected(socket)).toBe('ok');
    await kit.send(socket, 'match.watch', { code });
  }
  return code;
}

// The match's first round, opening after a 3 s countdown; its id.
const firstRound = async (code: string) =>
  (
    await kit.clients.host.post(`/api/v1/matches/${code}/rounds`, {
      settings: { 'round.countdownS': 3 },
      season: 'spring',
      startNow: true,
    })
  ).json<{ id: string }>().id;

const status = async (code: string) =>
  (await kit.clients.host.get(`/api/v1/matches/${code}`)).json<{
    round: { id: string; status: string } | null;
    series: { nextAt: number | null } | null;
  }>();

// The round's status as committed (the round row is written in the batch's transaction).
async function committed(id: string): Promise<string | undefined> {
  const r = await kit.harness.pool.query<{ status: string }>(
    'SELECT status FROM smg.rounds WHERE id = $1',
    [id],
  );
  return r.rows[0]?.status;
}

// The side counts the round shows once its delayed view has caught up.
async function counts(id: string): Promise<Record<string, number>> {
  await sleep(SIDES_PLAN.viewDelayMs + 1_500);
  const r = await kit.clients['player-1'].get(`/api/v1/rounds/${id}/state`);
  return r.json<{ game: { counts: Record<string, number> } }>().game.counts;
}

describe('pre-picks during a round (O117)', () => {
  it('leave the running round alone and play at the later round', async () => {
    const code = await watchedMatch('player-2');
    const first = await firstRound(code);
    // Round 1's opening has committed: a save from now on is for the later rounds.
    while ((await committed(first)) !== 'open') await sleep(100);
    // While round 1 runs, player-2 fixes a side for round 1 and for round 2.
    expect((await put('player-2', code, { picks: { '1': 'a', '2': 'c' } })).statusCode).toBe(204);
    expect(await counts(first)).toEqual({ a: 0, b: 0, c: 0 });
    while ((await status(code)).series?.nextAt == null) await sleep(200);
    await kit.clients.host.post(`/api/v1/matches/${code}/next-round/start`, {});
    let second = (await status(code)).round;
    while (second?.id === first || second?.status !== 'open') {
      await sleep(200);
      second = (await status(code)).round;
    }
    expect(await counts(second.id)).toEqual({ a: 0, b: 0, c: 1 });
  }, 90_000);

  it('play in the round when saved before its opening committed', async () => {
    const code = await watchedMatch('player-3');
    const ids = await kit.harness.pool.query<{ match_id: string; player_key: string }>(
      `SELECT mp.match_id, mp.player_key FROM smg.match_players mp
       JOIN smg.matches m ON m.id = mp.match_id WHERE m.code = $1 AND mp.account_id = $2`,
      [code, await kit.accountId('player-3')],
    );
    const { match_id: matchId, player_key: playerKey } = ids.rows[0] ?? {};
    // A save in progress, as the server writes one (../src/match/prefs `save`): the match's
    // prefs lock shared, then the row. The opening cannot read the pre-picks, and so cannot
    // commit, until this save has committed. (A request for the lock queued behind the
    // opening's would wait for the opening instead, so the save is the test's own.)
    const save = await kit.harness.pool.connect();
    try {
      await save.query('BEGIN');
      await save.query(`SELECT ${PREFS_LOCK_SHARED_SQL}`, [matchId]);
      const first = await firstRound(code);
      // The round has opened on the server; its opening waits for the save.
      while ((await status(code)).round?.status !== 'open') await sleep(100);
      await save.query(
        'INSERT INTO smg.match_player_prefs (match_id, player_key, prefs) VALUES ($1, $2, $3)',
        [matchId, playerKey, { picks: { '1': 'b' } }],
      );
      expect(await committed(first)).not.toBe('open');
      await save.query('COMMIT');
      while ((await committed(first)) !== 'open') await sleep(100);
      expect(await counts(first)).toEqual({ a: 0, b: 1, c: 0 });
    } finally {
      save.release();
    }
  }, 90_000);
});
