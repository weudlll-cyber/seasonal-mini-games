/**
 * @file   apps/server/src/match/publicIds.ts
 * @module server/match
 * @brief  Per-match player numbers: what every public view and frame shows instead of account ids.
 *
 * Responsibility: inside the server a player's key is their account id (or `bot-NN`,
 *                 DECISIONS T17); outside it, every public answer and frame names a player by
 *                 their number in the match, `p1`, `p2`, …, in join order over everyone who
 *                 ever joined it (left and kicked players keep theirs), so a number never
 *                 changes (DECISIONS T104). Bots keep their key: it is no account id. The
 *                 numbers of a match are held in memory, loaded when a player joins, when a
 *                 round starts and for the running rounds a server recovers, so a frame is
 *                 translated without waiting; forgotten when the match ends. `toPublic` replaces every account key it knows,
 *                 as a value and as an object key, anywhere in an answer; the game's own views
 *                 are translated the same way, without the game knowing.
 * Depends on:     ../db/pool
 * Used by:        ./play, ../http/routes/matches, ../http/routes/rounds, ../realtime/gateway
 * Spec:           docs/spec/05-security-threat-model.md §1; docs/spec/06-data-model-api-realtime.md §3.1, §4.4
 */
import type { DbPool } from '../db/pool.js';

export type Numbers = ReadonlyMap<string, string>;

const EMPTY: Numbers = new Map();

// Every account key of the value replaced by its number, as a value and as an object key.
export function toPublic<T>(value: T, numbers: Numbers): T {
  if (numbers.size === 0) return value;
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return numbers.get(v) ?? v;
    if (Array.isArray(v)) return v.map(walk);
    if (v !== null && typeof v === 'object') {
      return Object.fromEntries(
        Object.entries(v).map(([k, inner]) => [numbers.get(k) ?? k, walk(inner)]),
      );
    }
    return v;
  };
  return walk(value) as T;
}

// An answer for one viewer: translated, with `you`, the viewer's own number (or null).
export function forViewer<T extends object>(
  value: T,
  numbers: Numbers,
  viewer: string | null,
): T & { you: string | null } {
  return {
    ...toPublic(value, numbers),
    you: viewer === null ? null : (numbers.get(viewer) ?? null),
  };
}

export class PlayerNumbers {
  private readonly byMatch = new Map<string, Numbers>();

  constructor(private readonly pool: DbPool) {}

  // The numbers of a match as last loaded (none before the first load).
  of(matchId: string): Numbers {
    return this.byMatch.get(matchId) ?? EMPTY;
  }

  // Loads the match's numbers again (a player joined, a round starts).
  async load(matchId: string): Promise<Numbers> {
    const r = await this.pool.query<{ player_key: string }>(
      `SELECT player_key FROM smg.match_players WHERE match_id = $1 ORDER BY joined_at, player_key`,
      [matchId],
    );
    const numbers = new Map<string, string>();
    let n = 0;
    for (const row of r.rows) {
      if (row.player_key.startsWith('bot-')) continue;
      n += 1;
      numbers.set(row.player_key, `p${String(n)}`);
    }
    this.byMatch.set(matchId, numbers);
    return numbers;
  }

  // A closed match's numbers leave memory; a later answer loads them again (`ready`).
  forget(matchId: string): void {
    this.byMatch.delete(matchId);
  }

  // The numbers, loading them first when this server has none for the match yet.
  async ready(matchId: string): Promise<Numbers> {
    return this.byMatch.get(matchId) ?? this.load(matchId);
  }
}
