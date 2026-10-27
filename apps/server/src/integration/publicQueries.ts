/**
 * @file   apps/server/src/integration/publicQueries.ts
 * @module server/integration
 * @brief  What host widgets and webhooks may know: open matches, a match's current round, a
 *         round's placings, by display name only.
 *
 * Responsibility: read-only queries of the public read API (07 §1): public matches in the lobby
 *                 or open with their player count and current round; a match's latest round with
 *                 its times and roster size; the placings of an ended round. Players are named by
 *                 display name (bots by their name); a deleted account is "a former player" and
 *                 no account id ever leaves (Bingo 07 §7).
 * Depends on:     @smg/contracts (views), ../db/pool, ../match/matches (displayNames)
 * Used by:        ../http/routes/publicApi, ./webhookEvents
 * Spec:           docs/spec/07-integration.md §1, §3.2; Bingo 07 §7
 */
import type { PublicCurrentRoundView, PublicMatchView, SeasonName } from '@smg/contracts';

import type { DbPool } from '../db/pool.js';
import { displayNames } from '../match/matches.js';

const FORMER = 'a former player';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Display names for player keys; a key that is still an account id (deleted) is never shown.
async function publicNames(pool: DbPool, keys: readonly string[]): Promise<Record<string, string>> {
  const names = await displayNames(pool, keys);
  for (const key of keys) if (UUID.test(names[key] ?? key)) names[key] = FORMER;
  return names;
}

export async function openMatches(pool: DbPool): Promise<PublicMatchView[]> {
  const r = await pool.query<{
    code: string;
    title: string;
    players: number;
    status: string | null;
    season: SeasonName | null;
  }>(
    `SELECT m.code, m.title,
       (SELECT count(*)::int FROM smg.match_players p WHERE p.match_id = m.id AND p.state = 'active') AS players,
       r.status, r.season
     FROM smg.matches m
     LEFT JOIN LATERAL (SELECT status, season FROM smg.rounds WHERE match_id = m.id
       ORDER BY round_index DESC LIMIT 1) r ON true
     WHERE m.visibility = 'public' AND m.status IN ('lobby', 'open')
     ORDER BY m.created_at DESC LIMIT 50`,
  );
  return r.rows.map((m) => ({
    code: m.code,
    title: m.title,
    players: m.players,
    round: m.status === null || m.season === null ? null : { status: m.status, season: m.season },
  }));
}

interface RoundRow {
  match_code: string;
  round_id: string;
  status: string;
  season: SeasonName;
  secret_mode: 'shared' | 'individual';
  halving: boolean;
  countdown: { opensAt?: number; endsAt?: number; roster?: unknown[] } | null;
}

// The latest round of a public match (running or not), or null.
export async function currentRound(
  pool: DbPool,
  code: string,
): Promise<PublicCurrentRoundView | null> {
  const r = await pool.query<RoundRow>(
    `SELECT m.code AS match_code, r.id::text AS round_id, r.status, r.season, r.secret_mode,
       r.halving, e.payload AS countdown
     FROM smg.matches m JOIN smg.rounds r ON r.match_id = m.id
     LEFT JOIN smg.round_events e ON e.round_id = r.id AND e.type = 'CountdownStarted'
     WHERE m.code = $1 AND m.visibility = 'public'
     ORDER BY r.round_index DESC LIMIT 1`,
    [code],
  );
  const row = r.rows[0];
  if (row === undefined) return null;
  return {
    matchCode: row.match_code,
    roundId: row.round_id,
    status: row.status,
    season: row.season,
    secretMode: row.secret_mode,
    halving: row.halving,
    opensAt: row.countdown?.opensAt ?? null,
    endsAt: row.countdown?.endsAt ?? null,
    players: row.countdown?.roster?.length ?? 0,
  };
}

interface Placing {
  readonly place: number;
  readonly name: string;
  readonly points: number;
}

// The placed players of an ended round, by place.
export async function placings(pool: DbPool, roundId: string): Promise<Placing[]> {
  const r = await pool.query<{ player_key: string; place: number; points: number }>(
    `SELECT player_key, place, points FROM smg.round_results
     WHERE round_id = $1 AND place IS NOT NULL ORDER BY place`,
    [roundId],
  );
  const names = await publicNames(
    pool,
    r.rows.map((x) => x.player_key),
  );
  return r.rows.map((x) => ({
    place: x.place,
    name: names[x.player_key] ?? FORMER,
    points: x.points,
  }));
}
