/**
 * @file   apps/server/src/league/boards.ts
 * @module server/league
 * @brief  Reading the boards: match standings, periods, a board's page, the viewer's
 *         neighbourhood, the team board.
 *
 * Responsibility: queries only; ./awards writes. A board ranks by points, then round wins,
 *                 then solves; equal rows share a rank (SQL `rank()`), and within a rank rows
 *                 are listed by display name so a page is stable. Players are shown by display
 *                 name only; deleted accounts are left out. Pages are offsets of `PAGE` rows.
 * Depends on:     @smg/contracts (views), ../db/pool, ../match/matches (displayNames)
 * Used by:        ../http/routes/matches, ../http/routes/leaderboards, ./profiles
 * Spec:           docs/spec/06-data-model-api-realtime.md §2.6, §3.1; Bingo 05 §2.4
 */
import type {
  LeaderboardPeriodView,
  LeaderboardRowView,
  MatchStandingView,
  TeamLeagueRowView,
  TeamName,
} from '@smg/contracts';

import type { DbPool } from '../db/pool.js';
import { displayNames } from '../match/matches.js';

export const PAGE = 50;

export async function matchStandings(pool: DbPool, matchId: string): Promise<MatchStandingView[]> {
  const r = await pool.query<{ player_key: string; points: number; wins: number; rank: number }>(
    'SELECT player_key, points, wins, rank FROM smg.match_standings WHERE match_id = $1 ORDER BY rank, player_key',
    [matchId],
  );
  const names = await displayNames(
    pool,
    r.rows.map((x) => x.player_key),
  );
  return r.rows.map((x) => ({
    rank: x.rank,
    playerKey: x.player_key,
    name: names[x.player_key] ?? x.player_key,
    points: x.points,
    wins: x.wins,
  }));
}

interface PeriodRow {
  id: string;
  kind: 'season' | 'all_time';
  name: string;
  starts_at: Date;
  ends_at: Date | null;
  status: 'active' | 'closed';
}

export const periodView = (p: PeriodRow): LeaderboardPeriodView => ({
  id: p.id,
  kind: p.kind,
  name: p.name,
  startsAt: p.starts_at.getTime(),
  endsAt: p.ends_at?.getTime() ?? null,
  status: p.status,
});

const PERIOD_COLUMNS = 'id::text, kind, name, starts_at, ends_at, status';

// The all-time board first, then the season boards, newest first.
export async function periods(pool: DbPool): Promise<LeaderboardPeriodView[]> {
  const r = await pool.query<PeriodRow>(
    `SELECT ${PERIOD_COLUMNS} FROM smg.leaderboard_periods
     ORDER BY kind = 'all_time' DESC, starts_at DESC`,
  );
  return r.rows.map(periodView);
}

export async function period(pool: DbPool, id: string): Promise<LeaderboardPeriodView | null> {
  const r = await pool.query<PeriodRow>(
    `SELECT ${PERIOD_COLUMNS} FROM smg.leaderboard_periods WHERE id = $1`,
    [id],
  );
  const row = r.rows[0];
  return row === undefined ? null : periodView(row);
}

interface EntryRow {
  // rank() and row_number() are bigint, which pg hands over as text.
  rank: string;
  pos: string;
  account_id: string;
  display_name: string;
  points: number;
  wins: number;
  solves: number;
  matches: number;
}

// Every entry of a board with its rank and its position in the listing order.
const RANKED = `SELECT rank() OVER (ORDER BY e.points DESC, e.wins DESC, e.solves DESC) AS rank,
    row_number() OVER (ORDER BY e.points DESC, e.wins DESC, e.solves DESC, a.display_name_key) AS pos,
    e.account_id::text, a.display_name, e.points, e.wins, e.solves, e.matches
  FROM smg.league_entries e JOIN smg.accounts a ON a.id = e.account_id
  WHERE e.period_id = $1 AND a.status <> 'deleted'`;

const rowView =
  (viewer: string | null) =>
  (e: EntryRow): LeaderboardRowView => ({
    rank: Number(e.rank),
    displayName: e.display_name,
    points: e.points,
    wins: e.wins,
    solves: e.solves,
    matches: e.matches,
    you: e.account_id === viewer,
  });

export async function boardPage(
  pool: DbPool,
  periodId: string,
  offset: number,
  viewer: string | null,
): Promise<{ rows: LeaderboardRowView[]; next: number | null }> {
  const r = await pool.query<EntryRow>(
    `SELECT * FROM (${RANKED}) x ORDER BY pos OFFSET $2 LIMIT $3`,
    [periodId, offset, PAGE + 1],
  );
  const more = r.rows.length > PAGE;
  return { rows: r.rows.slice(0, PAGE).map(rowView(viewer)), next: more ? offset + PAGE : null };
}

// The viewer's row with five rows above and below it (Bingo 05 §2.4); empty without a row.
export async function boardAround(
  pool: DbPool,
  periodId: string,
  viewer: string,
): Promise<LeaderboardRowView[]> {
  const r = await pool.query<EntryRow>(
    `WITH ranked AS (${RANKED})
     SELECT ranked.* FROM ranked, (SELECT pos FROM ranked WHERE account_id = $2) me
     WHERE ranked.pos BETWEEN me.pos - 5 AND me.pos + 5 ORDER BY ranked.pos`,
    [periodId, viewer],
  );
  return r.rows.map(rowView(viewer));
}

export async function teamBoard(pool: DbPool, periodId: string): Promise<TeamLeagueRowView[]> {
  const r = await pool.query<{ rank: string; team: TeamName; points: number; wins: number }>(
    `SELECT rank() OVER (ORDER BY points DESC, wins DESC) AS rank, team, points, wins
     FROM smg.team_league_entries WHERE period_id = $1 ORDER BY rank, team`,
    [periodId],
  );
  return r.rows.map((t) => ({
    rank: Number(t.rank),
    team: t.team,
    points: t.points,
    wins: t.wins,
  }));
}
