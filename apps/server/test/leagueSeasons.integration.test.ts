/**
 * @file   apps/server/test/leagueSeasons.integration.test.ts
 * @module server/test
 * @brief  The move to meteorological seasons with Postgres (migration 0011).
 *
 * Responsibility: the season board is the meteorological season (O30), and migration 0011
 *                 moves a quarter board's awards to their season, keeping a quarter board that
 *                 holds adjustments closed under a quarter name (T107). Its match is aborted at
 *                 the end, which also removes its points.
 * Depends on:     node:fs, vitest, ./leagueKit
 * Spec:           docs/spec/02-game-guess-the-number.md §9; docs/spec/06-data-model-api-realtime.md §2.6;
 *                 docs/spec/09-testing-strategy.md §2
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { boards, byName, rows, useLeague, wonMatch } from './leagueKit.js';

const MIGRATION = new URL('../src/db/migrations/0011_meteorological_seasons.sql', import.meta.url);

const l = useLeague();

// A season board as a server before O30 made it: one calendar quarter of 2020.
async function quarterBoard(start: string, name: string): Promise<string> {
  const r = await l.kit.harness.pool.query<{ id: string }>(
    `INSERT INTO smg.leaderboard_periods (kind, name, starts_at, ends_at)
     VALUES ('season', $1, $2::timestamptz, $2::timestamptz + interval '3 months')
     RETURNING id::text`,
    [name, start],
  );
  return r.rows[0]?.id ?? '';
}

describe('the move to meteorological seasons (migration 0011)', () => {
  it('moves quarter awards to their season and keeps a quarter holding adjustments', async () => {
    const pool = l.kit.harness.pool;
    const code = await wonMatch(l, ['player-1', 'player-2', 'player-3'], 'player-1');
    const { season } = await boards(l);
    const before = await rows(l, season?.id ?? '');
    const old = await quarterBoard('2020-01-01T00:00:00Z', 'Winter 2020');
    const kept = await quarterBoard('2020-04-01T00:00:00Z', 'Spring 2020');
    for (const table of ['league_awards', 'team_league_awards']) {
      await pool.query(
        `UPDATE smg.${table} a SET period_id = $1 FROM smg.matches m
         WHERE m.id = a.match_id AND m.code = $2 AND a.period_id = $3`,
        [old, code, season?.id],
      );
    }
    await pool.query(
      `INSERT INTO smg.leaderboard_adjustments (period_id, account_id, delta, reason)
       SELECT $1, id, 3, 'before O30' FROM smg.accounts WHERE display_name = 'dev-player-2'`,
      [kept],
    );
    await pool.query(readFileSync(MIGRATION, 'utf8'));
    const after = await boards(l);
    expect(after.season?.id).toBe(season?.id);
    expect(await rows(l, season?.id ?? '')).toEqual(before);
    const names = after.list.map((p) => p.name);
    expect(names).toContain('Q2 2020 (quarter)');
    expect(names).not.toContain('Winter 2020');
    expect(byName(await rows(l, kept), 'dev-player-2')?.points).toBe(3);
  }, 120_000);
});
