/**
 * @file   games/guess-the-number/src/feedback.ts
 * @module games/guess-the-number
 * @brief  The feedback rule: higher, lower or correct.
 *
 * Responsibility: 02 §6.1 as code (kept apart from secrets and state, DECISIONS T21). The
 *                 server computes no narrowed range from the answers: each player sees their
 *                 own guesses with their answers and nothing derived from them (O17).
 * Depends on:     nothing
 * Used by:        ./rules, ./state
 * Spec:           docs/spec/02-game-guess-the-number.md §6.1
 */

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
