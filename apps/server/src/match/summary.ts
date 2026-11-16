/**
 * @file   apps/server/src/match/summary.ts
 * @module server/match
 * @brief  How a closed or aborted match ended, for its summary (O27).
 *
 * Responsibility: the number of ended rounds; who ended the match and why; for the idle
 *                 close the minutes without a round, measured as the close measured them
 *                 (./idleClose). The players' totals and the teams are the match standings
 *                 the details already carry. A phased match's rounds with what won in the
 *                 game's words, recorded at each round's end (`recordWords`, 02e §9, T333).
 *                 Null while the match runs.
 * Depends on:     @smg/contracts (MatchEndView), ../db/pool, ./matches, ./idleClose
 * Used by:        ../http/routes/matches, ../round/runtime
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

// A phased round's outcome in its game's words, once it has ended ('' when nobody won); the
// summary lists it (02e §9, T333). A guess round keeps NULL.
export async function recordWords(
  pool: DbPool,
  roundId: string,
  words: string | null,
): Promise<void> {
  await pool.query('UPDATE smg.rounds SET outcome_words = $2 WHERE id = $1', [
    roundId,
    words ?? '',
  ]);
}

// A phased match's ended rounds with their words; undefined for a guess game's match.
async function roundWords(pool: DbPool, matchId: string): Promise<MatchEndView['rounds']> {
  const r = await pool.query<{ round_index: number; outcome_words: string }>(
    `SELECT round_index, outcome_words FROM smg.rounds
     WHERE match_id = $1 AND status = 'ended' AND outcome_words IS NOT NULL ORDER BY round_index`,
    [matchId],
  );
  if (r.rows.length === 0) return undefined;
  return r.rows.map((x) => ({
    index: x.round_index,
    words: x.outcome_words === '' ? null : x.outcome_words,
  }));
}

function endView(row: EndRow | undefined, match: MatchRow): MatchEndView {
  return {
    roundsPlayed: row?.rounds ?? 0,
    by: row?.by ?? null,
    reason: row?.reason ?? null,
    idleMinutes: row?.reason === 'idle' && match.status === 'closed' ? row.idle_minutes : null,
  };
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
  const view = endView(end.rows[0], match);
  const rounds = await roundWords(pool, match.id);
  return rounds === undefined ? view : { ...view, rounds };
}
