/**
 * @file   apps/server/test/league.integration.test.ts
 * @module server/test
 * @brief  League points with Postgres: two matches add up on the season and all-time boards
 *         with the team board beside, profiles, adjustments, and points taken back.
 *
 * Responsibility: shared rounds of four accounts award each player their match standing to
 *                 both boards, and two matches add up; the team board sums the teams' round
 *                 wins; `/me` finds the viewer; the profile agrees with the boards; a staff
 *                 adjustment needs a reason, is audited, append-only and public on the profile;
 *                 a match with fewer accounts than `leaderboard.minPlayersForPoints` or one that
 *                 does not count awards nothing; aborting a match takes its points back (T88).
 *                 Every match is aborted at the end, which also removes its points (the move
 *                 to meteorological seasons: ./leagueSeasons.integration.test).
 * Depends on:     @smg/domain, vitest, ./leagueKit
 * Spec:           docs/spec/02-game-guess-the-number.md §9; docs/spec/06-data-model-api-realtime.md §2.6, §3.1;
 *                 docs/spec/09-testing-strategy.md §2
 */
import { seasonPeriod } from '@smg/domain';
import { describe, expect, it } from 'vitest';

import { boards, byName, EVERYONE, rows, useLeague, wonMatch, type Row } from './leagueKit.js';

const l = useLeague();

// After the two won matches: both boards give each winner 10 points and the teams 2 wins.
async function expectTwoMatches(periodId: string): Promise<void> {
  const board = await rows(l, periodId);
  expect(byName(board, 'dev-player-1')).toMatchObject({
    points: 10,
    wins: 1,
    solves: 1,
    matches: 2,
    rank: 1,
    you: true,
  });
  expect(byName(board, 'dev-player-2')).toMatchObject({ points: 10, wins: 1, rank: 1, you: false });
  expect(byName(board, 'dev-host')).toMatchObject({ points: 0, matches: 2, rank: 3 });
  const teams = (await l.kit.clients.host.get(`/api/v1/leaderboards/${periodId}/teams`)).json<{
    rows: { points: number }[];
  }>().rows;
  // One point per round win for the winner's team (O12): two rounds, two points.
  expect(teams.reduce((sum, t) => sum + t.points, 0)).toBe(2);
}

// The profile agrees with the boards and carries no e-mail.
async function expectProfile(): Promise<void> {
  const profile = (await l.kit.clients['player-3'].get('/api/v1/players/DEV-PLAYER-1')).json<{
    displayName: string;
    matchesPlayed: number;
    wins: number;
    bestPlace: number;
    recent: { secretMode: string }[];
    boards: { rank: number; points: number }[];
  }>();
  expect(profile).toMatchObject({
    displayName: 'dev-player-1',
    matchesPlayed: 2,
    wins: 1,
    bestPlace: 1,
  });
  expect(profile.recent).toEqual([
    expect.objectContaining({ secretMode: 'shared' }),
    expect.objectContaining({ secretMode: 'shared' }),
  ]);
  expect(profile.boards).toEqual([
    expect.objectContaining({ rank: 1, points: 10 }),
    expect.objectContaining({ rank: 1, points: 10 }),
  ]);
  expect(JSON.stringify(profile)).not.toMatch(/@|example/);
}

describe('league points', () => {
  it('add up over two matches on the season and all-time boards, teams beside', async () => {
    await wonMatch(l, ['player-1', 'player-2', 'player-3'], 'player-1');
    await wonMatch(l, ['player-1', 'player-2', 'player-3'], 'player-2');
    const { list, allTime, season } = await boards(l);
    expect(list[0]?.kind).toBe('all_time');
    expect(season?.name).toBe(seasonPeriod(Date.now()).name);
    for (const p of [allTime, season]) await expectTwoMatches(p?.id ?? '');
    const me = (
      await l.kit.clients['player-3'].get(`/api/v1/leaderboards/${allTime?.id ?? ''}/me`)
    ).json<{
      rows: Row[];
    }>().rows;
    expect(me.find((r) => r.you)?.displayName).toBe('dev-player-3');
    await expectProfile();
    const bad = await l.kit.clients.host.get(`/api/v1/leaderboards/${allTime?.id ?? ''}?offset=-1`);
    expect(bad.statusCode).toBe(400);
  }, 120_000);

  it('award nothing below the minimum of accounts or when a match does not count', async () => {
    const { allTime } = await boards(l);
    const periodId = allTime?.id ?? '';
    const before = await rows(l, periodId);
    await wonMatch(l, ['player-1', 'player-2'], 'player-1');
    await wonMatch(l, ['player-1', 'player-2', 'player-3'], 'player-1', false);
    expect(await rows(l, periodId)).toEqual(before);
  }, 120_000);

  it('take an aborted match’s points back', async () => {
    const { allTime } = await boards(l);
    const periodId = allTime?.id ?? '';
    const code = await wonMatch(l, EVERYONE.slice(1), 'player-3');
    expect(byName(await rows(l, periodId), 'dev-player-3')?.wins).toBe(1);
    await l.kit.clients.host.post(`/api/v1/matches/${code}/abort`, { reason: 'test' });
    expect(byName(await rows(l, periodId), 'dev-player-3')?.wins).toBe(0);
  }, 120_000);
});

// After the league points above: the two counting matches of the first test remain.
describe('boards per game', () => {
  it('show the total over every game and each game on its own (O44)', async () => {
    const { allTime } = await boards(l);
    const periodId = allTime?.id ?? '';
    // The first match, player 1's win, becomes a Safecracker match for this check.
    const pool = l.kit.harness.pool;
    await pool.query(`UPDATE smg.matches SET game_id = 'safecracker' WHERE code = $1`, [
      l.opened[0],
    ]);
    try {
      const of = async (game: string) => {
        const page = await l.kit.clients['player-1'].get(
          `/api/v1/leaderboards/${periodId}?game=${game}`,
        );
        const teams = await l.kit.clients.host.get(
          `/api/v1/leaderboards/${periodId}/teams?game=${game}`,
        );
        return {
          rows: page.json<{ rows: Row[] }>().rows,
          teamPoints: teams
            .json<{ rows: { points: number }[] }>()
            .rows.reduce((s, t) => s + t.points, 0),
        };
      };
      await expectTwoMatches(periodId);
      const safe = await of('safecracker');
      expect(byName(safe.rows, 'dev-player-1')).toMatchObject({ points: 10, wins: 1, matches: 1 });
      expect(byName(safe.rows, 'dev-player-2')).toMatchObject({ points: 0, matches: 1 });
      expect(safe.teamPoints).toBe(1);
      const gtn = await of('guess-the-number');
      expect(byName(gtn.rows, 'dev-player-2')).toMatchObject({ points: 10, wins: 1, matches: 1 });
      expect(byName(gtn.rows, 'dev-player-1')).toMatchObject({ points: 0, matches: 1 });
      expect(gtn.teamPoints).toBe(1);
      expect((await of('seasonal-target')).rows).toEqual([]);
      const bad = await l.kit.clients.host.get(
        `/api/v1/leaderboards/${periodId}?game=DROP%20TABLE`,
      );
      expect(bad.statusCode).toBe(400);
    } finally {
      await pool.query(`UPDATE smg.matches SET game_id = 'guess-the-number' WHERE code = $1`, [
        l.opened[0],
      ]);
    }
  }, 60_000);
});

describe('leaderboard adjustments', () => {
  it('show a staff adjustment with its reason; it cannot be changed', async () => {
    const { allTime } = await boards(l);
    const periodId = allTime?.id ?? '';
    const refused = await l.kit.clients['player-1'].post('/api/v1/admin/leaderboard-adjustments', {
      periodId,
      displayName: 'dev-player-1',
      delta: 100,
      reason: 'my own',
    });
    expect(refused.statusCode).toBe(403);
    const before = byName(await rows(l, periodId), 'dev-player-3')?.points ?? 0;
    const made = await l.admin.post('/api/v1/admin/leaderboard-adjustments', {
      periodId,
      displayName: 'dev-player-3',
      delta: 5,
      reason: 'Make-up for a lost round',
    });
    expect(made.statusCode).toBe(201);
    expect(byName(await rows(l, periodId), 'dev-player-3')?.points).toBe(before + 5);
    const profile = (await l.kit.clients.host.get('/api/v1/players/dev-player-3')).json<{
      adjustments: { delta: number; reason: string }[];
    }>();
    expect(profile.adjustments[0]).toMatchObject({ delta: 5, reason: 'Make-up for a lost round' });
    await expect(
      l.kit.harness.pool.query('UPDATE smg.leaderboard_adjustments SET delta = 50'),
    ).rejects.toThrow(/append-only/);
    const audit = await l.kit.harness.pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM smg.audit_log WHERE action = 'leaderboard.adjust'`,
    );
    expect(Number(audit.rows[0]?.n)).toBe(1);
  });

  it('refuse a body that is not an adjustment', async () => {
    const r = await l.admin.post('/api/v1/admin/leaderboard-adjustments', { delta: 0 });
    expect(r.statusCode).toBe(400);
  });
});
