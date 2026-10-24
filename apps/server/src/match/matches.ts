/**
 * @file   apps/server/src/match/matches.ts
 * @module server/match
 * @brief  Matches and their players in PostgreSQL: open, find, list, join, leave, teams, close.
 *
 * Responsibility: the match lobby of 02 §2: a host opens a match for a registered game with
 *                 a six-character code without look-alikes; players join up to its limit
 *                 and leave; a player picks a season team; the match is `open` once a round
 *                 was created, and ends `closed` or `aborted`. Display names for player keys
 *                 (bots keep their key). Matches are never deleted (06 §2.3).
 * Depends on:     node:crypto, ../db/pool
 * Used by:        ./play, ../http/routes/matches, ../realtime/*, ../dev/quickTest
 * Spec:           docs/spec/02-game-guess-the-number.md §2; docs/spec/06-data-model-api-realtime.md §2.1, §2.2, §3.1
 */
import { randomInt } from 'node:crypto';

import type { DbPool } from '../db/pool.js';

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export type MatchStatus = 'lobby' | 'open' | 'closed' | 'aborted';
export type Team = 'spring' | 'summer' | 'autumn' | 'winter';

export interface MatchRow {
  readonly id: string;
  readonly code: string;
  readonly gameId: string;
  readonly title: string;
  readonly status: MatchStatus;
  readonly visibility: 'public' | 'unlisted';
  readonly maxPlayers: number;
  readonly countsForLeaderboard: boolean;
  readonly hostId: string | null;
  readonly createdAt: number;
}

export interface PlayerRow {
  readonly playerKey: string;
  readonly accountId: string | null;
  readonly state: 'active' | 'left' | 'kicked';
  readonly team: Team | null;
}

interface Row {
  id: string;
  code: string;
  game_id: string;
  title: string;
  status: MatchStatus;
  visibility: 'public' | 'unlisted';
  max_players: number;
  counts_for_leaderboard: boolean;
  created_by: string | null;
  created_at: Date;
}

const COLUMNS = `id::text, code, game_id, title, status, visibility, max_players,
  counts_for_leaderboard, created_by::text, created_at`;

const toMatch = (r: Row): MatchRow => ({
  id: r.id,
  code: r.code,
  gameId: r.game_id,
  title: r.title,
  status: r.status,
  visibility: r.visibility,
  maxPlayers: r.max_players,
  countsForLeaderboard: r.counts_for_leaderboard,
  hostId: r.created_by,
  createdAt: r.created_at.getTime(),
});

export interface NewMatch {
  readonly gameId: string;
  readonly title: string;
  readonly visibility: 'public' | 'unlisted';
  readonly maxPlayers: number;
  readonly countsForLeaderboard: boolean;
  readonly hostId: string;
}

export async function openMatch(pool: DbPool, m: NewMatch): Promise<MatchRow> {
  // A clash of two random codes is rare; the unique index catches it and we draw again.
  for (let attempt = 0; ; attempt += 1) {
    const code = Array.from(
      { length: 6 },
      () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)],
    ).join('');
    try {
      const r = await pool.query<Row>(
        `INSERT INTO smg.matches (code, game_id, title, visibility, max_players, counts_for_leaderboard, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${COLUMNS}`,
        [code, m.gameId, m.title, m.visibility, m.maxPlayers, m.countsForLeaderboard, m.hostId],
      );
      const row = r.rows[0];
      if (row !== undefined) return toMatch(row);
    } catch (error) {
      if (attempt >= 5 || (error as { code?: string }).code !== '23505') throw error;
    }
  }
}

export async function findMatch(pool: DbPool, code: string): Promise<MatchRow | null> {
  const r = await pool.query<Row>(`SELECT ${COLUMNS} FROM smg.matches WHERE code = $1`, [code]);
  return r.rows[0] === undefined ? null : toMatch(r.rows[0]);
}

export async function matchById(pool: DbPool, id: string): Promise<MatchRow | null> {
  const r = await pool.query<Row>(`SELECT ${COLUMNS} FROM smg.matches WHERE id = $1`, [id]);
  return r.rows[0] === undefined ? null : toMatch(r.rows[0]);
}

// Public matches in the lobby or open, and those ended in the last day (06 §3.1).
export async function listMatches(
  pool: DbPool,
  filter: { status?: MatchStatus | undefined; game?: string | undefined },
): Promise<MatchRow[]> {
  const r = await pool.query<Row>(
    `SELECT ${COLUMNS} FROM smg.matches
     WHERE visibility = 'public' AND ($1::text IS NULL OR status = $1) AND ($2::text IS NULL OR game_id = $2)
       AND (status IN ('lobby', 'open') OR closed_at > now() - interval '1 day')
     ORDER BY created_at DESC LIMIT 100`,
    [filter.status ?? null, filter.game ?? null],
  );
  return r.rows.map(toMatch);
}

export async function myMatches(pool: DbPool, accountId: string): Promise<MatchRow[]> {
  const r = await pool.query<Row>(
    `SELECT ${COLUMNS} FROM smg.matches m WHERE created_by = $1
       OR EXISTS (SELECT 1 FROM smg.match_players p WHERE p.match_id = m.id AND p.account_id = $1)
     ORDER BY created_at DESC LIMIT 100`,
    [accountId],
  );
  return r.rows.map(toMatch);
}

// Active players in join order.
export async function activePlayers(pool: DbPool, matchId: string): Promise<PlayerRow[]> {
  const r = await pool.query<{
    player_key: string;
    account_id: string | null;
    state: PlayerRow['state'];
    team: Team | null;
  }>(
    `SELECT player_key, account_id::text, state, team FROM smg.match_players
     WHERE match_id = $1 AND state = 'active' ORDER BY joined_at, player_key`,
    [matchId],
  );
  return r.rows.map((p) => ({
    playerKey: p.player_key,
    accountId: p.account_id,
    state: p.state,
    team: p.team,
  }));
}

export type JoinResult = 'joined' | 'MATCH_FULL' | 'MATCH_CLOSED';

export async function joinMatch(
  pool: DbPool,
  match: MatchRow,
  player: { key: string; accountId: string | null },
): Promise<JoinResult> {
  if (match.status === 'closed' || match.status === 'aborted') return 'MATCH_CLOSED';
  // The count and the insert in one statement, so two last joins cannot both fit.
  const r = await pool.query(
    `INSERT INTO smg.match_players (match_id, player_key, account_id)
     SELECT $1, $2, $3 WHERE (SELECT count(*) FROM smg.match_players
                              WHERE match_id = $1 AND state = 'active' AND player_key <> $2) < $4
     ON CONFLICT (match_id, player_key) DO UPDATE SET state = 'active', left_at = NULL
       WHERE smg.match_players.state = 'left'`,
    [match.id, player.key, player.accountId, match.maxPlayers],
  );
  if (r.rowCount === 1) return 'joined';
  const already = await pool.query(
    `SELECT 1 FROM smg.match_players WHERE match_id = $1 AND player_key = $2 AND state = 'active'`,
    [match.id, player.key],
  );
  return already.rowCount === 1 ? 'joined' : 'MATCH_FULL';
}

export async function leaveMatch(pool: DbPool, matchId: string, playerKey: string): Promise<void> {
  await pool.query(
    `UPDATE smg.match_players SET state = 'left', left_at = now()
     WHERE match_id = $1 AND player_key = $2 AND state = 'active'`,
    [matchId, playerKey],
  );
}

export async function setTeam(
  pool: DbPool,
  matchId: string,
  playerKey: string,
  team: Team,
): Promise<boolean> {
  const r = await pool.query(
    `UPDATE smg.match_players SET team = $3, team_chosen_at = now()
     WHERE match_id = $1 AND player_key = $2 AND state = 'active'`,
    [matchId, playerKey, team],
  );
  return r.rowCount === 1;
}

export async function setMatchStatus(
  pool: DbPool,
  matchId: string,
  status: MatchStatus,
  abort?: { reason: string; by: 'host' | 'system' },
): Promise<void> {
  await pool.query(
    `UPDATE smg.matches SET status = $2, version = version + 1,
       closed_at = CASE WHEN $2 IN ('closed', 'aborted') THEN now() ELSE closed_at END,
       aborted_reason = $3, aborted_by = $4
     WHERE id = $1`,
    [matchId, status, abort?.reason ?? null, abort?.by ?? null],
  );
}

// The match's running round, else its latest one.
export async function currentRoundId(pool: DbPool, matchId: string): Promise<string | null> {
  const r = await pool.query<{ id: string }>(
    `SELECT id::text FROM smg.rounds WHERE match_id = $1 ORDER BY round_index DESC LIMIT 1`,
    [matchId],
  );
  return r.rows[0]?.id ?? null;
}

// Display names for player keys; a bot's key is its name.
export async function displayNames(
  pool: DbPool,
  keys: readonly string[],
): Promise<Record<string, string>> {
  const accounts = keys.filter((k) => !k.startsWith('bot-'));
  const r = await pool.query<{ id: string; display_name: string }>(
    'SELECT id::text, display_name FROM smg.accounts WHERE id::text = ANY($1)',
    [accounts],
  );
  const names: Record<string, string> = Object.fromEntries(keys.map((k) => [k, k]));
  for (const row of r.rows) names[row.id] = row.display_name;
  return names;
}
