/**
 * @file   apps/server/src/match/website.ts
 * @module server/match
 * @brief  The matches the website lists as open for sign-up, and the host's switch for it.
 *
 * Responsibility: owner decisions O124 and O125. The open-rounds list of the shared contract
 *                 (version 1, spec/07 §8): at most 20 matches open for joining now (in the
 *                 lobby or open, a seat free) that their host shows on the website, never a
 *                 Quick Test; each with its code, title, game, player counts and the next round's
 *                 opening (a round in its countdown, else a series' next start), soonest first;
 *                 no player names. The host switches the option while the match is open; a
 *                 Quick Test or an ended match refuses.
 * Depends on:     ../db/pool, ./matches (types)
 * Used by:        ../http/routes/openRounds, ../http/routes/matches
 * Spec:           docs/spec/07-integration.md §8; docs/spec/06-data-model-api-realtime.md §2.1
 */
import type { DbPool } from '../db/pool.js';
import type { MatchRow } from './matches.js';

export interface ListedMatch {
  readonly code: string;
  readonly title: string;
  readonly gameId: string;
  readonly players: number;
  readonly maxPlayers: number;
  readonly startsAt: Date | null;
}

// Open for joining now, shown on the website, no Quick Test, a seat free; soonest first.
const LISTED = `
  SELECT m.code, m.title, m.game_id, m.max_players, p.players,
         coalesce(
           (SELECT r.opens_at FROM smg.rounds r
             WHERE r.match_id = m.id AND r.status = 'countdown' ORDER BY r.round_index DESC LIMIT 1),
           (SELECT min(a.due_at) FROM smg.scheduled_actions a
             WHERE a.kind = 'match_autostart' AND a.done_at IS NULL
               AND a.payload->>'matchId' = m.id::text)
         ) AS starts_at
    FROM smg.matches m
    CROSS JOIN LATERAL (SELECT count(*)::int AS players FROM smg.match_players mp
                         WHERE mp.match_id = m.id AND mp.state = 'active') p
   WHERE m.status IN ('lobby', 'open') AND m.show_on_website AND NOT m.quick_test
     AND p.players < m.max_players
   ORDER BY starts_at NULLS LAST, m.created_at
   LIMIT 20`;

export async function listedMatches(pool: DbPool): Promise<ListedMatch[]> {
  const r = await pool.query<{
    code: string;
    title: string;
    game_id: string;
    max_players: number;
    players: number;
    starts_at: Date | null;
  }>(LISTED);
  return r.rows.map((row) => ({
    code: row.code,
    title: row.title,
    gameId: row.game_id,
    players: row.players,
    maxPlayers: row.max_players,
    startsAt: row.starts_at,
  }));
}

export type WebsiteSwitch = 'done' | 'QUICK_TEST' | 'MATCH_CLOSED';

// The host's "Show on the website" while the match is open (O125).
export async function setShowOnWebsite(
  pool: DbPool,
  match: MatchRow,
  show: boolean,
): Promise<WebsiteSwitch> {
  if (match.quickTest) return 'QUICK_TEST';
  if (match.status === 'closed' || match.status === 'aborted') return 'MATCH_CLOSED';
  await pool.query('UPDATE smg.matches SET show_on_website = $2 WHERE id = $1', [match.id, show]);
  return 'done';
}
