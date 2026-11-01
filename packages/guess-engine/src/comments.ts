/**
 * @file   packages/guess-engine/src/comments.ts
 * @module guess-engine
 * @brief  Choosing a guess's closeness comment from a game's catalogue, reproducibly (O21).
 *
 * Responsibility: the lines a round may use from a pool (the general ones and those of its
 *                 season); the pick, made with the DRBG it is given (the round's under the label
 *                 `comment/<receiveSeq>`), so seeded rounds and the Quick Test replay the same
 *                 lines; a line of a pool comes back in a round only after every line of that
 *                 pool was used (DECISIONS T72). With a previous guess of the player in another
 *                 tier, a trend line comes instead in `trendPercent` % of the picks (T71). Each
 *                 game binds its own catalogue with `commentPicker`.
 * Depends on:     @smg/game-sdk (Drbg, Season), ./tiers
 * Used by:        ./rules, ./state, ./index, games/*
 * Spec:           docs/spec/02-game-guess-the-number.md §6.3; docs/spec/04-software-architecture.md §4.7
 */
import type { Drbg, Season } from '@smg/game-sdk';

import { trendOf, type Tier } from './tiers.js';

// A tier's lines, or the trend lines for a guess closer or farther than the player's last.
export type Pool = Tier | 'closer' | 'farther';
// A line for every round, or one only a round of its season uses.
export type Line = string | { readonly text: string; readonly season: Season };
export type CommentLines = Readonly<Record<Pool, readonly Line[]>>;

// The comment a guess got: its tier, the line, and where the line came from.
export interface Comment {
  readonly tier: Tier;
  readonly text: string;
  readonly pool: Pool;
  readonly index: number;
}

// Per pool, the indexes of the lines this round has used since the pool was last full.
export type UsedLines = Readonly<Partial<Record<Pool, readonly number[]>>>;

export interface CommentRound {
  readonly used: UsedLines;
  readonly season: Season;
  readonly trendPercent: number;
}

export interface CommentPicker {
  readonly linesOf: (pool: Pool, season: Season) => readonly string[];
  readonly pickComment: (
    tier: Tier,
    previous: Tier | null,
    round: CommentRound,
    rng: Drbg,
  ) => Comment;
  readonly noteUsed: (used: UsedLines, comment: Comment, season: Season) => UsedLines;
}

export function commentPicker(catalogue: CommentLines): CommentPicker {
  const linesOf = (pool: Pool, season: Season): readonly string[] =>
    catalogue[pool].flatMap((line) => {
      if (typeof line === 'string') return [line];
      return line.season === season ? [line.text] : [];
    });

  const pickComment = (
    tier: Tier,
    previous: Tier | null,
    round: CommentRound,
    rng: Drbg,
  ): Comment => {
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
  };

  const noteUsed = (used: UsedLines, comment: Comment, season: Season): UsedLines => {
    const before = used[comment.pool] ?? [];
    const full = before.length >= linesOf(comment.pool, season).length;
    return { ...used, [comment.pool]: full ? [comment.index] : [...before, comment.index] };
  };

  return { linesOf, pickComment, noteUsed };
}
