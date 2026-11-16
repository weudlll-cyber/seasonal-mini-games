/**
 * @file   apps/server/test/resultWon.integration.test.ts
 * @module server/test
 * @brief  Migration 0016 (`round_results.won`) keeps every standing and board of the guess games.
 *
 * Responsibility: DECISIONS T287 and the night's rule that the four existing games behave as
 *                 before. Guess The Number rounds are played for real (a shared win, an
 *                 individual round with two solvers); every row's `won` is its place 1. The
 *                 rows are then set back to what the added column gave them (false), migration
 *                 0016 runs again, and the match standings, the team standings and the boards,
 *                 recomputed from the rows, are exactly what they were.
 * Depends on:     vitest, ../src/db/pool, ../src/league/*, ../src/round/pgResults, ./*
 * Spec:           docs/spec/06-data-model-api-realtime.md §2.4, §2.6; docs/spec/04-software-architecture.md §4.8 rule 6
 */
import { readFileSync } from 'node:fs';

import type { Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { inTransaction } from '../src/db/pool.js';
import { awardMatch } from '../src/league/awards.js';
import { leagueRules } from '../src/league/rules.js';
import { refreshMatch } from '../src/round/pgResults.js';
import { SUITE_TIMEOUT_MS } from './harness.js';
import { startSocketKit, type SocketKit, type Who } from './socketKit.js';

const MIGRATION = new URL('../src/db/migrations/0016_result_won.sql', import.meta.url);
const PLAYERS: readonly Who[] = ['player-1', 'player-2', 'player-3'];
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

// Sends the guess until the round takes it (the countdown, then the cooldown).
async function guessUntil(s: Socket, roundId: string, value: number): Promise<void> {
  for (let tries = 0; tries < 80; tries += 1) {
    if ((await kit.send(s, 'guess', { roundId, value })).ok) return;
    await sleep(100);
  }
}

// A match of the host and the players, one round in `mode`; `solvers` find their secret in turn.
async function playedMatch(
  mode: 'shared' | 'individual',
  solvers: readonly Who[],
): Promise<string> {
  const r = await kit.clients.host.post('/api/v1/matches', {
    gameId: 'guess-the-number',
    title: 'won',
    maxPlayers: 10,
  });
  const code = r.json<{ code: string }>().code;
  opened.push(code);
  const sockets: Partial<Record<Who, Socket>> = {};
  for (const who of ['host', ...PLAYERS] as Who[]) {
    if (who !== 'host') await kit.clients[who].post(`/api/v1/matches/${code}/join`, {});
    const s = kit.open(kit.clients[who].cookie);
    expect(await kit.connected(s)).toBe('ok');
    await kit.send(s, 'match.watch', { code });
    sockets[who] = s;
  }
  const round = await kit.clients.host.post(`/api/v1/matches/${code}/rounds`, {
    settings: { 'round.countdownS': 3, 'round.secretMode': mode, 'round.inactivityLimitS': 0 },
    season: 'spring',
    startNow: true,
  });
  const id = round.json<{ id: string }>().id;
  const secrets = await kit.secretsOf(id);
  for (const who of solvers) {
    const key = await kit.accountId(who);
    const value = secrets.mode === 'shared' ? secrets.value : (secrets.byPlayer[key] ?? 0);
    await guessUntil(sockets[who] as Socket, id, value);
  }
  if (mode === 'individual') await kit.clients.host.post(`/api/v1/rounds/${id}/end`, {});
  for (let tries = 0; tries < 50; tries += 1) {
    const st = await kit.clients.host.get(`/api/v1/rounds/${id}/state`);
    if (st.json<{ status: string }>().status === 'ended') break;
    await sleep(100);
  }
  for (const s of Object.values(sockets)) s.disconnect();
  return code;
}

// Everything computed from the results: match and team standings, awards and board entries.
async function computed() {
  const q = async (sql: string): Promise<unknown[]> =>
    (await kit.harness.pool.query<Record<string, unknown>>(sql)).rows;
  return {
    standings: await q(
      'SELECT match_id, player_key, points, wins, first_win_at, rank FROM smg.match_standings ORDER BY 1, 2',
    ),
    teams: await q(
      'SELECT match_id, team, points, wins, first_win_at, rank FROM smg.match_team_standings ORDER BY 1, 2',
    ),
    awards: await q(
      'SELECT period_id, account_id, match_id, points, wins, solves, place FROM smg.league_awards ORDER BY 1, 2, 3',
    ),
    entries: await q(
      'SELECT period_id, account_id, points, wins, solves, matches FROM smg.league_entries ORDER BY 1, 2',
    ),
  };
}

async function recompute(): Promise<void> {
  const rules = await leagueRules(kit.harness.built.settings);
  const matches = await kit.harness.pool.query<{ id: string }>('SELECT id::text FROM smg.matches');
  for (const m of matches.rows) {
    await inTransaction(kit.harness.pool, async (c) => {
      await refreshMatch(c, m.id);
      await awardMatch(c, m.id, rules);
    });
  }
}

describe('migration 0016: round_results.won', () => {
  it('gives the rows of the guess games their place-1 win and keeps every standing and board', async () => {
    await playedMatch('shared', ['player-1']);
    await playedMatch('individual', ['player-2', 'player-3']);
    const rows = await kit.harness.pool.query<{ place: number | null; won: boolean }>(
      'SELECT place, won FROM smg.round_results',
    );
    expect(rows.rows.length).toBeGreaterThan(0);
    for (const r of rows.rows) expect(r.won).toBe(r.place === 1);
    await recompute();
    const before = await computed();
    expect(before.standings.some((s) => (s as { wins: number }).wins > 0)).toBe(true);
    // The rows as the added column left them before its update: no win anywhere.
    await kit.harness.pool.query('UPDATE smg.round_results SET won = false');
    await kit.harness.pool.query(readFileSync(MIGRATION, 'utf8'));
    await recompute();
    expect(await computed()).toEqual(before);
  }, 120_000);
});
