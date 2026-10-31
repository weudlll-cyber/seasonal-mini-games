/**
 * @file   games/guess-the-number/src/comments.ts
 * @module games/guess-the-number
 * @brief  Choosing a guess's closeness comment, reproducibly and without early repeats (O21).
 *
 * Responsibility: the lines a round may use from a pool (the general ones and those of its
 *                 season); the pick, made with the round's DRBG under the label
 *                 `comment/<receiveSeq>`, so seeded rounds and the Quick Test replay the same
 *                 lines; a line of a pool comes back in a round only after every line of that
 *                 pool was used (DECISIONS T72). With a previous guess of the player in another
 *                 tier, a trend line comes instead in `trendPercent` % of the picks (T71).
 * Depends on:     @smg/game-sdk (Drbg, Season), ./closeness, ./commentLines
 * Used by:        ./rules, ./state
 * Spec:           docs/spec/02-game-guess-the-number.md §6.3
 */
import type { Drbg, Season } from '@smg/game-sdk';

import { trendOf, type Tier } from './closeness.js';
import { COMMENT_LINES, type Pool } from './commentLines.js';

// The comment a guess got: its tier, the line, and where the line came from.
export interface Comment {
  readonly tier: Tier;
  readonly text: string;
  readonly pool: Pool;
  readonly index: number;
}

// Per pool, the indexes of the lines this round has used since the pool was last full.
export type UsedLines = Readonly<Partial<Record<Pool, readonly number[]>>>;

export function linesOf(pool: Pool, season: Season): readonly string[] {
  return COMMENT_LINES[pool].flatMap((line) => {
    if (typeof line === 'string') return [line];
    return line.season === season ? [line.text] : [];
  });
}

export function pickComment(
  tier: Tier,
  previous: Tier | null,
  round: { readonly used: UsedLines; readonly season: Season; readonly trendPercent: number },
  rng: Drbg,
): Comment {
  const trend = tier === 'correct' || previous === null ? null : trendOf(previous, tier);
  const pool: Pool = trend !== null && rng.nextInt(100) < round.trendPercent ? trend : tier;
  const lines = linesOf(pool, round.season);
  const taken = round.used[pool] ?? [];
  // Every line used: the pool starts over (`noteUsed` clears it the same way).
  const fresh = lines.flatMap((_, i) =>
    taken.length >= lines.length || !taken.includes(i) ? [i] : [],
  );
  const index = fresh[rng.nextInt(fresh.length)] ?? 0;
  return { tier, text: lines[index] ?? '', pool, index };
}

export function noteUsed(used: UsedLines, comment: Comment, season: Season): UsedLines {
  const before = used[comment.pool] ?? [];
  const full = before.length >= linesOf(comment.pool, season).length;
  return { ...used, [comment.pool]: full ? [comment.index] : [...before, comment.index] };
}
