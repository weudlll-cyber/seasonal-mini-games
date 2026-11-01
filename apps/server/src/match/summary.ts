/**
 * @file   apps/server/src/match/summary.ts
 * @module server/match
 * @brief  How a closed or aborted match ended, for its summary (O27).
 *
 * Responsibility: the number of ended rounds; who ended the match and why; for the idle
 *                 close the minutes without a round, measured as the close measured them
 *                 (./idleClose). The players' totals and the teams are the match standings
 *                 the details already carry. Null while the match runs.
 * Depends on:     @smg/contracts (MatchEndView), ../db/pool, ./matches, ./idleClose
 * Used by:        ../http/routes/matches
 * Spec:           docs/spec/02-game-guess-the-number.md §2; docs/spec/06-data-model-api-realtime.md §3.1
 */
import type { MatchEndView } from '@smg/contracts';

import type { DbPool } from '../db/pool.js';
import { LAST_ACTIVITY } from './idleClose.js';
import type { MatchRow } from './matches.js';

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
  return {
    roundsPlayed: row?.rounds ?? 0,
    by: row?.by ?? null,
    reason: row?.reason ?? null,
    idleMinutes: row?.reason === 'idle' && match.status === 'closed' ? row.idle_minutes : null,
  };
}
