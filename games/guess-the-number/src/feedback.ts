/**
 * @file   games/guess-the-number/src/feedback.ts
 * @module games/guess-the-number
 * @brief  The feedback rule and the band it leaves: higher, lower or correct.
 *
 * Responsibility: 02 §6.1 as code (kept apart from secrets and state, DECISIONS T21), and
 *                 the band a list of answers leaves inside a range: the exact intersection of
 *                 every answer with the range (invariant G5).
 * Depends on:     @smg/game-sdk (Range, intersect)
 * Used by:        ./rules, ./views
 * Spec:           docs/spec/02-game-guess-the-number.md §6.1
 */
import { intersect, type Range } from '@smg/game-sdk';

export type Feedback = 'higher' | 'lower' | 'correct';

export interface Answer {
  readonly value: number;
  readonly feedback: Feedback;
}

export function feedbackFor(guess: number, secret: number): Feedback {
  if (guess < secret) return 'higher';
  if (guess > secret) return 'lower';
  return 'correct';
}

// The values one answer allows.
function allowed(a: Answer): Range {
  if (a.feedback === 'higher') return { low: a.value + 1, high: Number.MAX_SAFE_INTEGER };
  if (a.feedback === 'lower') return { low: Number.MIN_SAFE_INTEGER, high: a.value - 1 };
  return { low: a.value, high: a.value };
}

// Truthful answers always leave the secret inside, so the band is never empty; a band that
// would be (answers about different secrets) stays at the last non-empty one.
export function band(range: Range, answers: readonly Answer[]): Range {
  let current = range;
  for (const a of answers) current = intersect(current, allowed(a)) ?? current;
  return current;
}
