/**
 * @file   apps/server/src/admin/liveRounds.ts
 * @module server/admin
 * @brief  What staff see of running rounds, and the removal of one round result.
 *
 * Responsibility: the live list (06 §3.2): every running round with its match, host, mode and
 *                 counts — roster, connected players, guesses, times — never a secret or a
 *                 seed; the removed results of a round; removing a result (reason required):
 *                 one row in smg.round_result_removals, then the match and team standings
 *                 recomputed without it and the league awards of the match replaced, all in
 *                 one transaction. A match whose points were withdrawn when it was aborted
 *                 stays withdrawn.
 * Depends on:     @smg/contracts (LiveRoundView), ../db/pool, ../league/*, ../match/play,
 *                 ../round/pgResults
 * Used by:        ../http/routes/adminRounds
 * Spec:           docs/spec/06-data-model-api-realtime.md §2.5, §2.6, §3.2; Bingo 11 §3.2
 */
import type { LiveRoundView } from '@smg/contracts';

import { inTransaction, type DbPool } from '../db/pool.js';
import { awardMatch } from '../league/awards.js';
import type { LeagueSettings } from '../league/rules.js';
import type { Play } from '../match/play.js';
import { refreshMatch } from '../round/pgResults.js';

interface LiveRow {
  round_id: string;
  match_id: string;
  code: string;
  title: string;
  host: string | null;
  season: string;
  secret_mode: 'shared' | 'individual';
  halving: boolean;
}

interface CountsView {
  readonly status: string;
  readonly opensAt: number | null;
  readonly endsAt: number | null;
  readonly roster: readonly { readonly guesses: number }[];
}

const RUNNING = new Set(['created', 'countdown', 'open']);

export async function liveRounds(pool: DbPool, play: Play): Promise<LiveRoundView[]> {
  const r = await pool.query<LiveRow>(
    `SELECT r.id::text AS round_id, m.id::text AS match_id, m.code, m.title,
            a.display_name AS host, r.season, r.secret_mode, r.halving
     FROM smg.rounds r JOIN smg.matches m ON m.id = r.match_id
     LEFT JOIN smg.accounts a ON a.id = m.created_by
     WHERE r.status IN ('created', 'countdown', 'open') ORDER BY r.created_at`,
  );
  const out: LiveRoundView[] = [];
  for (const row of r.rows) {
    const round = await play.rounds.get(row.round_id);
    // The spectator's platform part: counts and times only.
    const v = round?.view(null) as CountsView | undefined;
    if (v === undefined || !RUNNING.has(v.status)) continue;
    out.push({
      roundId: row.round_id,
      matchId: row.match_id,
      matchCode: row.code,
      matchTitle: row.title,
      host: row.host,
      status: v.status as LiveRoundView['status'],
      season: row.season,
      secretMode: row.secret_mode,
      halving: row.halving,
      roster: v.roster.length,
      connected: play.presence.connected(row.match_id).size,
      guesses: v.roster.reduce((n, p) => n + p.guesses, 0),
      opensAt: v.opensAt,
      endsAt: v.endsAt,
    });
  }
  return out;
}

export async function removedKeys(pool: DbPool, roundId: string): Promise<string[]> {
  const r = await pool.query<{ player_key: string }>(
    'SELECT player_key FROM smg.round_result_removals WHERE round_id = $1 ORDER BY player_key',
    [roundId],
  );
  return r.rows.map((x) => x.player_key);
}

export type RemoveResult = 'removed' | 'RESULT_NOT_FOUND' | 'ALREADY_REMOVED';

export async function removeResult(
  pool: DbPool,
  input: {
    readonly roundId: string;
    readonly playerKey: string;
    readonly reason: string;
    readonly by: string;
    readonly rules: LeagueSettings;
  },
): Promise<RemoveResult> {
  return inTransaction(pool, async (c) => {
    // Results exist only once the round ended (./../round/pgResults).
    const found = await c.query<{ match_id: string; match_status: string }>(
      `SELECT r.match_id::text, m.status AS match_status FROM smg.round_results rr
       JOIN smg.rounds r ON r.id = rr.round_id JOIN smg.matches m ON m.id = r.match_id
       WHERE rr.round_id = $1 AND rr.player_key = $2`,
      [input.roundId, input.playerKey],
    );
    const row = found.rows[0];
    if (row === undefined) return 'RESULT_NOT_FOUND';
    const added = await c.query(
      `INSERT INTO smg.round_result_removals (round_id, player_key, reason, removed_by)
       VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [input.roundId, input.playerKey, input.reason, input.by],
    );
    if (added.rowCount !== 1) return 'ALREADY_REMOVED';
    await refreshMatch(c, row.match_id);
    // An aborted match's points were withdrawn (T70) unless the setting keeps them.
    if (row.match_status !== 'aborted' || input.rules.abortedMatchesCount) {
      await awardMatch(c, row.match_id, input.rules);
    }
    return 'removed';
  });
}
