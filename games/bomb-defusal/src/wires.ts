/**
 * @file   games/bomb-defusal/src/wires.ts
 * @module games/bomb-defusal
 * @brief  The wire palette, a cutting sequence, and the feedback rule with its closeness tier.
 *
 * Responsibility: the eight wire colours in palette order (a round uses the first `bomb.wires`
 *                 of them, 02c §3); the zod schema of one sequence (palette names only, at most
 *                 six, 05 §3.1); the answer to a sequence, the longest correct start
 *                 `{ correct: k }` with `defused` when every cut was right (02c §5.1); and the
 *                 fixed tier rule of 02c §7 (k = 0 way off, k = 1 … cuts − 2 spread over cold
 *                 … burning, k = cuts − 1 just missed).
 * Depends on:     zod, @smg/guess-engine (Tier)
 * Used by:        ./settings, ./state, ./rules, ./leafFall, ./specials, ./views, ./devBot,
 *                 ./conformance, ./index
 * Spec:           docs/spec/02c-game-bomb-defusal.md §3, §5.1, §7
 */
import type { Tier } from '@smg/guess-engine';
import { z } from 'zod';

export const PALETTE = [
  'red',
  'blue',
  'yellow',
  'green',
  'white',
  'black',
  'orange',
  'purple',
] as const;
export type Wire = (typeof PALETTE)[number];
export type Sequence = readonly Wire[];

// The most cuts a round can have (`bomb.cuts` max, 08 §3.2): the input never takes more.
const MAX_CUTS = 6;

export const wireSchema = z.enum(PALETTE);
export const sequenceSchema = z.array(wireSchema).max(MAX_CUTS).readonly();

// The answer to one sequence: how many cuts from the start were right, and whether all were.
// `defused` is carried because the engine's `solved` sees only the answer, not the round.
export interface Feedback {
  readonly correct: number;
  readonly defused: boolean;
}

export const feedbackSchema = z
  .object({ correct: z.number().int().min(0).max(MAX_CUTS), defused: z.boolean() })
  .strict();

// The round's wires: the first `count` colours of the palette.
export const wiresOf = (count: number): Wire[] => PALETTE.slice(0, count);

// Wires in palette order, so marks and lists read the same everywhere.
export const inPaletteOrder = (wires: Iterable<Wire>): Wire[] => {
  const set = new Set(wires);
  return PALETTE.filter((w) => set.has(w));
};

// The longest start the two sequences share.
function correctStart(guess: Sequence, secret: Sequence): number {
  let k = 0;
  while (k < guess.length && k < secret.length && guess[k] === secret[k]) k += 1;
  return k;
}

export function answerOf(guess: Sequence, secret: Sequence): Feedback {
  const correct = correctStart(guess, secret);
  return { correct, defused: correct === secret.length };
}

export const sameSequence = (a: Sequence, b: Sequence): boolean =>
  a.length === b.length && a.every((w, i) => w === b[i]);

const MIDDLE: readonly Tier[] = ['cold', 'cool', 'warm', 'hot', 'burning'];

// 02c §7: the fixed tier of `k` right cuts out of `cuts`.
export function tierOf(k: number, cuts: number): Tier {
  if (k >= cuts) return 'correct';
  if (k === cuts - 1) return 'justMissed';
  if (k === 0) return 'wayOff';
  // With three cuts only k = 1 is in the middle, and it is cold.
  if (cuts === 3) return 'cold';
  return MIDDLE[Math.round((4 * (k - 1)) / (cuts - 3))] as Tier;
}

// A sequence in words, for the chat, the list and the result: "red → blue → yellow".
export const sequenceText = (s: Sequence): string => s.join(' → ');
