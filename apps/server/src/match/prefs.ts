/**
 * @file   apps/server/src/match/prefs.ts
 * @module server/match
 * @brief  A player's own value for a phased game's match (pre-picks), and its use at each round.
 *
 * Responsibility: 04 §4.8 rule 8. A match player reads and replaces their own value: checked
 *                 against the game's schema (PREFS_INVALID) and at most 2 KiB, at most once
 *                 every 2 s per account (RATE_LIMITED, 05 §5), only in a game with prefs
 *                 (PREFS_OFF); nobody else reads it (FORBIDDEN for anyone not in the match). It goes when the player leaves or is
 *                 removed. The keys a game keeps per account (O116) are stored with the account
 *                 instead and put back into the value wherever it is read (./accountPrefs), so
 *                 they hold in every match until the player changes them. At each opening of a phased round every active match player who has
 *                 a value, in join order, gets the action it makes for that round as their first
 *                 choice at the opening (../round/liveRound `prePick`); one the round refuses is
 *                 told to that player alone (`prefs.refused` with the round's index and the code).
 *                 A value is never logged: the logger redacts `prefs`.
 * Depends on:     ../auth/rateLimit, ../db/pool, ../round/* (types), ./accountPrefs, ./matches
 * Used by:        ../round/runtime, ./play, ../http/routes/prefs, ../realtime/*
 * Spec:           docs/spec/04-software-architecture.md §4.8 rule 8; docs/spec/06-data-model-api-realtime.md §2.2, §3.1, §4.3, §4.4
 */
import { RateLimiter } from '../auth/rateLimit.js';
import type { DbPool } from '../db/pool.js';
import type { LiveRound } from '../round/liveRound.js';
import type { Rounds } from '../round/rounds.js';
import { mergePrefs, saveAccountPrefs, splitPrefs } from './accountPrefs.js';
import { activePlayers, type MatchRow } from './matches.js';

const PREFS_MAX_BYTES = 2_048;

// FORBIDDEN: not a player of the match, who has no value there to read or write.
export type PrefsCode = 'PREFS_OFF' | 'PREFS_INVALID' | 'RATE_LIMITED' | 'FORBIDDEN';

interface Refused {
  readonly roundIndex: number;
  readonly code: string;
}

type RefusedListener = (matchId: string, playerKey: string, refused: Refused) => void;

export async function deletePrefs(pool: DbPool, matchId: string, playerKey: string): Promise<void> {
  await pool.query('DELETE FROM smg.match_player_prefs WHERE match_id = $1 AND player_key = $2', [
    matchId,
    playerKey,
  ]);
}

export class PlayerPrefs {
  private readonly limiter = new RateLimiter({ limit: 1, windowMs: 2_000 });
  private readonly listeners: RefusedListener[] = [];

  constructor(
    private readonly pool: DbPool,
    private readonly rounds: Rounds,
  ) {}

  // The player's own value with their account's keys in it, or null; only that player asks.
  async own(match: MatchRow, playerKey: string): Promise<unknown> {
    const r = await this.pool.query<{ prefs: unknown; account: unknown }>(
      `SELECT p.prefs, a.prefs AS account FROM smg.match_players mp
       LEFT JOIN smg.match_player_prefs p
         ON p.match_id = mp.match_id AND p.player_key = mp.player_key
       LEFT JOIN smg.account_game_prefs a ON a.account_id = mp.account_id AND a.game_id = $3
       WHERE mp.match_id = $1 AND mp.player_key = $2`,
      [match.id, playerKey, match.gameId],
    );
    const row = r.rows[0];
    return mergePrefs(row?.prefs, row?.account, this.rounds.accountKeys(match.gameId));
  }

  async save(match: MatchRow, playerKey: string, prefs: unknown): Promise<PrefsCode | null> {
    if (!(await this.isPlayer(match, playerKey))) return 'FORBIDDEN';
    if (!this.rounds.hasPrefs(match.gameId)) return 'PREFS_OFF';
    if (!this.limiter.take(playerKey).allowed) return 'RATE_LIMITED';
    const parsed = this.rounds.parsePrefs(match.gameId, prefs);
    if (parsed === undefined || JSON.stringify(parsed).length > PREFS_MAX_BYTES)
      return 'PREFS_INVALID';
    const keys = this.rounds.accountKeys(match.gameId);
    const parts = splitPrefs(parsed, keys);
    if (keys.length > 0) {
      const account = await this.accountOf(match, playerKey);
      if (account !== null) await saveAccountPrefs(this.pool, account, match.gameId, parts.account);
    }
    await this.pool.query(
      `INSERT INTO smg.match_player_prefs (match_id, player_key, prefs) VALUES ($1, $2, $3)
       ON CONFLICT (match_id, player_key) DO UPDATE SET prefs = EXCLUDED.prefs, updated_at = now()`,
      [match.id, playerKey, keys.length > 0 ? parts.match : parsed],
    );
    return null;
  }

  private async accountOf(match: MatchRow, playerKey: string): Promise<string | null> {
    const r = await this.pool.query<{ account_id: string }>(
      'SELECT account_id FROM smg.match_players WHERE match_id = $1 AND player_key = $2',
      [match.id, playerKey],
    );
    return r.rows[0]?.account_id ?? null;
  }

  async isPlayer(match: MatchRow, playerKey: string): Promise<boolean> {
    return (await activePlayers(this.pool, match.id)).some((p) => p.playerKey === playerKey);
  }

  onRefused(listener: RefusedListener): void {
    this.listeners.push(listener);
  }

  // A phased round opened: every active player's pre-pick for it, in join order.
  async apply(round: LiveRound): Promise<void> {
    const r = await this.pool.query<{
      player_key: string;
      prefs: unknown;
      account: unknown;
      round_index: number;
      game_id: string;
    }>(
      `SELECT p.player_key, p.prefs, a.prefs AS account, r.round_index, m.game_id
       FROM smg.match_player_prefs p
       JOIN smg.match_players mp ON mp.match_id = p.match_id AND mp.player_key = p.player_key
       JOIN smg.rounds r ON r.match_id = p.match_id AND r.id = $1
       JOIN smg.matches m ON m.id = p.match_id
       LEFT JOIN smg.account_game_prefs a ON a.account_id = mp.account_id AND a.game_id = m.game_id
       WHERE mp.state = 'active' ORDER BY mp.joined_at, mp.player_key`,
      [round.id],
    );
    for (const row of r.rows) {
      const prefs = mergePrefs(row.prefs, row.account, this.rounds.accountKeys(row.game_id));
      const reply = await round.prePick(row.player_key, prefs, row.round_index);
      if (reply === null || reply.ok) continue;
      const refused = { roundIndex: row.round_index, code: reply.code };
      for (const l of this.listeners) l(round.matchId, row.player_key, refused);
    }
  }
}
