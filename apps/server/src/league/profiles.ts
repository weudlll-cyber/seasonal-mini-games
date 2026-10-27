/**
 * @file   apps/server/src/league/profiles.ts
 * @module server/league
 * @brief  A player's public profile: their numbers, their place on every board, recent rounds.
 *
 * Responsibility: found by display name (unique, case-insensitive). Every number comes from
 *                 the all-time board's awards, so a profile agrees with the boards: matches
 *                 that count for the leaderboard and were not taken back (DECISIONS T70).
 *                 The boards list the player's rank and points on each board they are on, the
 *                 recent list their last ten rounds of such matches, and staff adjustments are
 *                 shown with their reason (Bingo 03 §11). No e-mail and no account id leave the
 *                 server (Bingo 01 §10).
 * Depends on:     @smg/contracts (view), ../db/pool, ./boards
 * Used by:        ../http/routes/leaderboards
 * Spec:           Bingo 01 §10, Bingo 05 §2.2; docs/spec/06-data-model-api-realtime.md §3.1
 */
import type { PlayerProfileView } from '@smg/contracts';

import type { DbPool } from '../db/pool.js';
import { periodView } from './boards.js';

const ALL_TIME = `(SELECT id FROM smg.leaderboard_periods WHERE kind = 'all_time')`;

async function totals(pool: DbPool, accountId: string) {
  const r = await pool.query<{
    matches: string;
    wins: string;
    solves: string;
    best: number | null;
  }>(
    `SELECT count(*) AS matches, coalesce(sum(wins), 0) AS wins, coalesce(sum(solves), 0) AS solves,
            min(place) AS best
     FROM smg.league_awards WHERE account_id = $1 AND period_id = ${ALL_TIME}`,
    [accountId],
  );
  const rounds = await pool.query<{ n: string }>(
    `SELECT count(*) AS n FROM smg.round_results rr JOIN smg.rounds r ON r.id = rr.round_id
     JOIN smg.league_awards la ON la.match_id = r.match_id AND la.account_id = $1
       AND la.period_id = ${ALL_TIME}
     WHERE rr.player_key = $1::text`,
    [accountId],
  );
  const t = r.rows[0];
  return {
    matchesPlayed: Number(t?.matches ?? 0),
    roundsPlayed: Number(rounds.rows[0]?.n ?? 0),
    wins: Number(t?.wins ?? 0),
    solves: Number(t?.solves ?? 0),
    bestPlace: t?.best ?? null,
  };
}

async function boards(pool: DbPool, accountId: string): Promise<PlayerProfileView['boards']> {
  const r = await pool.query<{
    id: string;
    kind: 'season' | 'all_time';
    name: string;
    starts_at: Date;
    ends_at: Date | null;
    status: 'active' | 'closed';
    rank: string;
    points: number;
  }>(
    `SELECT p.id::text, p.kind, p.name, p.starts_at, p.ends_at, p.status, x.rank, x.points
     FROM smg.leaderboard_periods p JOIN (
       SELECT period_id, account_id, points,
              rank() OVER (PARTITION BY period_id ORDER BY points DESC, wins DESC, solves DESC) AS rank
       FROM smg.league_entries) x ON x.period_id = p.id
     WHERE x.account_id = $1 ORDER BY p.kind = 'all_time' DESC, p.starts_at DESC`,
    [accountId],
  );
  return r.rows.map((b) => ({ period: periodView(b), rank: Number(b.rank), points: b.points }));
}

async function recent(pool: DbPool, accountId: string): Promise<PlayerProfileView['recent']> {
  const r = await pool.query<{
    code: string;
    title: string;
    round_id: string;
    ended_at: Date;
    secret_mode: 'shared' | 'individual';
    place: number | null;
    solved: boolean;
    points: number;
  }>(
    `SELECT m.code, m.title, r.id::text AS round_id, r.ended_at, r.secret_mode, rr.place, rr.solved, rr.points
     FROM smg.round_results rr JOIN smg.rounds r ON r.id = rr.round_id
     JOIN smg.matches m ON m.id = r.match_id
     JOIN smg.league_awards la ON la.match_id = m.id AND la.account_id = $1
       AND la.period_id = ${ALL_TIME}
     WHERE rr.player_key = $1::text ORDER BY r.ended_at DESC LIMIT 10`,
    [accountId],
  );
  return r.rows.map((x) => ({
    matchCode: x.code,
    matchTitle: x.title,
    roundId: x.round_id,
    endedAt: x.ended_at.getTime(),
    secretMode: x.secret_mode,
    place: x.place,
    solved: x.solved,
    points: x.points,
  }));
}

async function adjustments(pool: DbPool, accountId: string) {
  const r = await pool.query<{ name: string; delta: number; reason: string; created_at: Date }>(
    `SELECT p.name, a.delta, a.reason, a.created_at FROM smg.leaderboard_adjustments a
     JOIN smg.leaderboard_periods p ON p.id = a.period_id
     WHERE a.account_id = $1 ORDER BY a.created_at DESC`,
    [accountId],
  );
  return r.rows.map((x) => ({
    periodName: x.name,
    delta: x.delta,
    reason: x.reason,
    at: x.created_at.getTime(),
  }));
}

export async function profile(
  pool: DbPool,
  displayName: string,
): Promise<PlayerProfileView | null> {
  const a = await pool.query<{ id: string; display_name: string; created_at: Date }>(
    `SELECT id::text, display_name, created_at FROM smg.accounts
     WHERE display_name_key = $1 AND status <> 'deleted'`,
    [displayName],
  );
  const account = a.rows[0];
  if (account === undefined) return null;
  return {
    displayName: account.display_name,
    memberSince: account.created_at.getTime(),
    ...(await totals(pool, account.id)),
    boards: await boards(pool, account.id),
    recent: await recent(pool, account.id),
    adjustments: await adjustments(pool, account.id),
  };
}
