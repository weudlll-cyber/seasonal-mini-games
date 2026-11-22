/**
 * @file   apps/server/src/match/accountPrefs.ts
 * @module server/match
 * @brief  The keys of a phased game's player value that hold per account, across matches.
 *
 * Responsibility: a game names the top-level keys of its value that belong to the player
 *                 rather than to one match (`PrefsHooks.accountKeys`, Seasonal Mind Games' "Hide
 *                 my switches", owner decision O116). A saved value is split: those keys go to
 *                 the account's row for the game (smg.account_game_prefs), the rest to the
 *                 match's (./prefs). Reading puts them together again: the match's value
 *                 without those keys, and the account's in their place, so a value a match
 *                 stored before the split never shadows the account's. A game without such keys
 *                 keeps its whole value per match, as before.
 * Depends on:     pg (types), ../db/pool
 * Used by:        ./prefs
 * Spec:           docs/spec/04-software-architecture.md §4.8 rule 8; docs/spec/06-data-model-api-realtime.md §2.2
 */
import type pg from 'pg';

import type { DbPool } from '../db/pool.js';

type Value = Readonly<Record<string, unknown>>;

const asRecord = (v: unknown): Value =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Value) : {};

const only = (v: Value, keys: readonly string[], keep: boolean): Value =>
  Object.fromEntries(Object.entries(v).filter(([k]) => keys.includes(k) === keep));

// A saved value in its two parts: the account's keys, and the match's rest.
export function splitPrefs(value: unknown, keys: readonly string[]) {
  const v = asRecord(value);
  return { account: only(v, keys, true), match: only(v, keys, false) };
}

// The value a player and the round see: the match's part with the account's keys over it;
// null when there is neither (no value at all).
export function mergePrefs(match: unknown, account: unknown, keys: readonly string[]): unknown {
  if (keys.length === 0) return match ?? null;
  if ((match ?? null) === null && (account ?? null) === null) return null;
  return { ...only(asRecord(match), keys, false), ...only(asRecord(account), keys, true) };
}

// The account's part for a game, written over the last one (in the caller's transaction).
export async function saveAccountPrefs(
  pool: DbPool | pg.PoolClient,
  accountId: string,
  gameId: string,
  part: Value,
): Promise<void> {
  await pool.query(
    `INSERT INTO smg.account_game_prefs (account_id, game_id, prefs) VALUES ($1, $2, $3)
     ON CONFLICT (account_id, game_id) DO UPDATE SET prefs = EXCLUDED.prefs, updated_at = now()`,
    [accountId, gameId, part],
  );
}
