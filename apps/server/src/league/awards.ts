/**
 * @file   apps/server/src/league/awards.ts
 * @module server/league
 * @brief  League points: a match's awards to the season and all-time boards, and their sums.
 *
 * Responsibility: called in the transaction that appends a round's RoundEnded, after the
 *                 match standings were refreshed (./../round/pgResults). A match that counts
 *                 for the leaderboard and has at least `leaderboard.minPlayersForPoints`
 *                 distinct accounts over its ended rounds (development bots are no accounts,
 *                 O11) awards each account its match standing — points, round wins, solves and
 *                 its rank — to the season board of the quarter its first round ended in and to
 *                 the all-time board (DECISIONS T69); its teams award their match team
 *                 standing the same way. Awards are replaced as later rounds end, so a match
 *                 awards once per board. Withdrawing removes a match's awards (an aborted
 *                 match, T70). Every change recomputes the affected entries as the sum of
 *                 awards and staff adjustments. A result staff removed counts for nothing here
 *                 (no account, no solve; the standings leave it out already, ../round/pgResults).
 *                 Only this module writes league tables (Bingo 03 §11).
 * Depends on:     pg, @smg/domain (quarterPeriod), @smg/game-sdk (Season)
 * Used by:        ../round/pgRoundStore, ../match/play, ./adjustments, ../admin/liveRounds
 * Spec:           docs/spec/02-game-guess-the-number.md §9; docs/spec/06-data-model-api-realtime.md §2.6
 */
import { quarterPeriod } from '@smg/domain';
import type { Season } from '@smg/game-sdk';
import type pg from 'pg';

export interface LeagueRules {
  readonly minPlayers: number;
  readonly firstQuarterSeason: Season;
}

type Db = Pick<pg.PoolClient, 'query'>;

// The all-time board and the season board of the quarter holding `at` (created on first use).
async function periodsFor(c: Db, at: Date, first: Season): Promise<string[]> {
  const q = quarterPeriod(at.getTime(), first);
  await c.query(
    `INSERT INTO smg.leaderboard_periods (kind, name, starts_at, ends_at)
     VALUES ('season', $1, $2, $3) ON CONFLICT (kind, starts_at) DO NOTHING`,
    [q.name, new Date(q.startsAt), new Date(q.endsAt)],
  );
  const r = await c.query<{ id: string }>(
    `SELECT id::text FROM smg.leaderboard_periods
     WHERE kind = 'all_time' OR (kind = 'season' AND starts_at = $1)`,
    [new Date(q.startsAt)],
  );
  return r.rows.map((x) => x.id);
}

// The match's accounts over its ended rounds, and when its first round ended.
async function eligible(c: Db, matchId: string) {
  const r = await c.query<{ accounts: string; first_end: Date | null; counts: boolean }>(
    `SELECT count(DISTINCT a.id)::text AS accounts, min(r.ended_at) AS first_end,
            bool_and(m.counts_for_leaderboard) AS counts
     FROM smg.matches m
     LEFT JOIN smg.rounds r ON r.match_id = m.id AND r.status = 'ended'
     LEFT JOIN smg.round_results rr ON rr.round_id = r.id AND NOT EXISTS (
       SELECT 1 FROM smg.round_result_removals x
       WHERE x.round_id = rr.round_id AND x.player_key = rr.player_key)
     LEFT JOIN smg.accounts a ON a.id::text = rr.player_key
     WHERE m.id = $1`,
    [matchId],
  );
  const row = r.rows[0];
  return {
    accounts: Number(row?.accounts ?? 0),
    firstEnd: row?.first_end ?? null,
    counts: row?.counts === true,
  };
}

export async function awardMatch(c: Db, matchId: string, rules: LeagueRules): Promise<void> {
  const touched = await withdrawAwards(c, matchId);
  const e = await eligible(c, matchId);
  if (!e.counts || e.firstEnd === null || e.accounts < rules.minPlayers) {
    await refreshEntries(c, touched);
    return;
  }
  for (const periodId of await periodsFor(c, e.firstEnd, rules.firstQuarterSeason)) {
    await c.query(
      `INSERT INTO smg.league_awards (period_id, account_id, match_id, points, wins, solves, place)
       SELECT $1, a.id, $2, s.points, s.wins,
              (SELECT count(*) FROM smg.round_results rr JOIN smg.rounds r ON r.id = rr.round_id
               WHERE r.match_id = $2 AND rr.player_key = s.player_key AND rr.solved
                 AND NOT EXISTS (SELECT 1 FROM smg.round_result_removals x
                                 WHERE x.round_id = rr.round_id AND x.player_key = rr.player_key)),
              s.rank
       FROM smg.match_standings s JOIN smg.accounts a ON a.id::text = s.player_key
       WHERE s.match_id = $2`,
      [periodId, matchId],
    );
    await c.query(
      `INSERT INTO smg.team_league_awards (period_id, team, match_id, points, wins)
       SELECT $1, team, $2, points, wins FROM smg.match_team_standings WHERE match_id = $2`,
      [periodId, matchId],
    );
    touched.periods.add(periodId);
  }
  const accounts = await c.query<{ account_id: string }>(
    'SELECT DISTINCT account_id::text FROM smg.league_awards WHERE match_id = $1',
    [matchId],
  );
  for (const a of accounts.rows) touched.accounts.add(a.account_id);
  await refreshEntries(c, touched);
}

export async function withdrawMatch(c: Db, matchId: string): Promise<void> {
  await refreshEntries(c, await withdrawAwards(c, matchId));
}

interface Touched {
  readonly periods: Set<string>;
  readonly accounts: Set<string>;
}

async function withdrawAwards(c: Db, matchId: string): Promise<Touched> {
  const gone = await c.query<{ period_id: string; account_id: string }>(
    'DELETE FROM smg.league_awards WHERE match_id = $1 RETURNING period_id::text, account_id::text',
    [matchId],
  );
  const teams = await c.query<{ period_id: string }>(
    'DELETE FROM smg.team_league_awards WHERE match_id = $1 RETURNING period_id::text',
    [matchId],
  );
  return {
    periods: new Set([...gone.rows, ...teams.rows].map((r) => r.period_id)),
    accounts: new Set(gone.rows.map((r) => r.account_id)),
  };
}

// Entries are the sums of awards and adjustments, for the touched accounts and all teams.
export async function refreshEntries(c: Db, t: Touched): Promise<void> {
  const periods = [...t.periods];
  const accounts = [...t.accounts];
  if (periods.length === 0) return;
  await c.query(
    `DELETE FROM smg.league_entries WHERE period_id = ANY($1::uuid[]) AND account_id = ANY($2::uuid[])`,
    [periods, accounts],
  );
  await c.query(
    `INSERT INTO smg.league_entries (period_id, account_id, points, wins, solves, matches)
     SELECT period_id, account_id, sum(points), sum(wins), sum(solves), sum(matches) FROM (
       SELECT period_id, account_id, points, wins, solves, 1 AS matches FROM smg.league_awards
       UNION ALL
       SELECT period_id, account_id, delta, 0, 0, 0 FROM smg.leaderboard_adjustments
     ) x WHERE period_id = ANY($1::uuid[]) AND account_id = ANY($2::uuid[])
     GROUP BY period_id, account_id`,
    [periods, accounts],
  );
  await c.query('DELETE FROM smg.team_league_entries WHERE period_id = ANY($1::uuid[])', [periods]);
  await c.query(
    `INSERT INTO smg.team_league_entries (period_id, team, points, wins)
     SELECT period_id, team, sum(points), sum(wins) FROM smg.team_league_awards
     WHERE period_id = ANY($1::uuid[]) GROUP BY period_id, team`,
    [periods],
  );
}
