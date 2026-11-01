/**
 * @file   apps/server/src/match/summary.ts
 * @module server/match
 * @brief  The summary of a closed or aborted match, as every viewer reads it (O27).
 *
 * Responsibility: the number of ended rounds; each player's total points and wins from the
 *                 match standings in rank order, with name and team; the team standings;
 *                 who ended the match and why; for the idle close the minutes without a
 *                 round, measured as the close measured them (./idleClose). Names only, no
 *                 player keys. Null while the match runs.
 * Depends on:     @smg/contracts (MatchEndView), ../db/pool, ./matches, ./idleClose
 * Used by:        ../http/routes/matches
 * Spec:           docs/spec/02-game-guess-the-number.md §2; docs/spec/06-data-model-api-realtime.md §3.1
 */
import type { MatchEndView, TeamName } from '@smg/contracts';

import type { DbPool } from '../db/pool.js';
import { LAST_ACTIVITY } from './idleClose.js';
import { displayNames, teamStandings, type MatchRow } from './matches.js';

interface EndRow {
  rounds: number;
  by: 'host' | 'system' | null;
  reason: string | null;
  idle_minutes: number | null;
}

export async function matchEnd(pool: DbPool, match: MatchRow): Promise<MatchEndView | null> {
  if (match.status !== 'closed' && match.status !== 'aborted') return null;
  const end = await pool.query<EndRow>(
    `SELECT (SELECT count(*)::int FROM smg.rounds r WHERE r.match_id = m.id AND r.status = 'ended') AS rounds,
            m.aborted_by AS by, m.aborted_reason AS reason,
            floor(extract(epoch FROM m.closed_at - ${LAST_ACTIVITY}) / 60)::int AS idle_minutes
     FROM smg.matches m WHERE m.id = $1`,
    [match.id],
  );
  const row = end.rows[0];
  const standings = await pool.query<{
    player_key: string;
    points: number;
    wins: number;
    team: TeamName | null;
  }>(
    `SELECT s.player_key, s.points, s.wins, p.team FROM smg.match_standings s
     LEFT JOIN smg.match_players p ON p.match_id = s.match_id AND p.player_key = s.player_key
     WHERE s.match_id = $1 ORDER BY s.rank, s.player_key`,
    [match.id],
  );
  const names = await displayNames(
    pool,
    standings.rows.map((s) => s.player_key),
  );
  return {
    roundsPlayed: row?.rounds ?? 0,
    players: standings.rows.map((s) => ({
      name: names[s.player_key] ?? s.player_key,
      team: s.team,
      points: s.points,
      wins: s.wins,
    })),
    teams: await teamStandings(pool, match.id),
    by: row?.by ?? null,
    reason: row?.reason ?? null,
    idleMinutes: row?.reason === 'idle' && match.status === 'closed' ? row.idle_minutes : null,
  };
}
