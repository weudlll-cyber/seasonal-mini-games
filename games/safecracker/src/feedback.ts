/**
 * @file   games/safecracker/src/feedback.ts
 * @module games/safecracker
 * @brief  The answer to a code (right place, wrong place) and its closeness tier.
 *
 * Responsibility: the feedback rule of 02b §5.1 — `exact` digits in the right place and `near`
 *                 digits in the code but in another place, each digit counted at most as often
 *                 as it occurs in the code — and the fixed tier table of 02b §6 from the score
 *                 t = (2·exact + near) / (2·L), compared in whole numbers so no rounding moves a
 *                 boundary. Runs on the server only: it needs the secret. The work is a fixed
 *                 count over at most 6 positions, whatever the closeness (05 §3.1).
 * Depends on:     @smg/guess-engine (Tier)
 * Used by:        ./rules, ./views, ./leafFall, ./devBot
 * Spec:           docs/spec/02b-game-safecracker.md §5.1, §6
 */
import type { Tier } from '@smg/guess-engine';

export interface Feedback {
  readonly exact: number;
  readonly near: number;
  // `exact` = the length: the engine's `solved` and the closest miss see only the answer, not
  // the round's length, so the answer says it (true only for the correct code).
  readonly solved: boolean;
}

export function feedbackFor(guess: string, secret: string): Feedback {
  let exact = 0;
  for (let i = 0; i < guess.length; i += 1) if (guess[i] === secret[i]) exact += 1;
  // Per digit, Σ min(count in guess, count in secret) over the positions that are not exact:
  // the same as the 02b §5.1 rule, whose common count includes the exact ones and then
  // subtracts them. A fixed 10 × L count, whatever the closeness.
  let near = 0;
  for (const d of '0123456789') {
    let inGuess = 0;
    let inSecret = 0;
    for (let i = 0; i < guess.length; i += 1) {
      if (guess[i] === secret[i]) continue;
      if (guess[i] === d) inGuess += 1;
      if (secret[i] === d) inSecret += 1;
    }
    near += Math.min(inGuess, inSecret);
  }
  return { exact, near, solved: exact === secret.length };
}

// The upper bounds of cold … hot in percent of the score (02b §6, a fixed table, not settings).
const BOUNDS: readonly (readonly [Tier, number])[] = [
  ['cold', 25],
  ['cool', 45],
  ['warm', 60],
  ['hot', 75],
];

export function tierOf(f: Feedback, length: number): Tier {
  if (f.exact === length) return 'correct';
  if (f.exact === length - 1) return 'justMissed';
  const score = 2 * f.exact + f.near;
  if (score === 0) return 'wayOff';
  // t < p %  ⇔  score · 100 < p · 2L, exact in integers.
  for (const [tier, percent] of BOUNDS) if (score * 100 < percent * 2 * length) return tier;
  return 'burning';
}
