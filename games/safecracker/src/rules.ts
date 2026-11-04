/**
 * @file   games/safecracker/src/rules.ts
 * @module games/safecracker
 * @brief  The game's own acceptance checks and answer, plugged into the guess engine.
 *
 * Responsibility: checks 4–5 of 02b §4 — exactly `length` characters, each a digit below
 *                 `digits` (`CODE_INVALID`), and no fallen digit (`DIGIT_REMOVED`) — decided
 *                 from the settings and the fallen digits only, never from the secret (05 §3.1).
 *                 The engine adds the repeat check (6, `ALREADY_GUESSED`) and decides an
 *                 accepted code: the answer `{ exact, near }` (./feedback), its tier, the room's
 *                 line and `Solved` at `exact = length` (04 §4.7).
 * Depends on:     @smg/guess-engine (GuessRules, GuessAction), ./feedback, ./state
 * Used by:        ./module, ./index
 * Spec:           docs/spec/02b-game-safecracker.md §4, §5, §6; docs/spec/04-software-architecture.md §4.7
 */
import type { GuessAction as EngineAction, GuessRules } from '@smg/guess-engine';

import { feedbackFor, tierOf, type Feedback } from './feedback.js';
import { digitsOf, type ScState } from './state.js';

export type GuessAction = EngineAction<string>;

export type ScCode = 'CODE_INVALID' | 'DIGIT_REMOVED' | 'ALREADY_GUESSED';

// What the input takes before the game's checks: 3–6 digits, leading zeros kept (05 §3.1).
export const CODE_PATTERN = /^[0-9]{3,6}$/;

// Check 4: the code's form against the round's length and digits in use.
export function wellFormed(code: string, length: number, digits: number): boolean {
  return /^[0-9]*$/.test(code) && code.length === length && digitsOf(code).every((d) => d < digits);
}

export const scRules: GuessRules<ScState, string, Feedback, string> = {
  unknownPlayer: 'NOT_IN_ROUND',
  check: (state, _playerId, value) => {
    if (!wellFormed(value, state.length, state.digits)) return 'CODE_INVALID';
    return digitsOf(value).some((d) => state.fallen.includes(d)) ? 'DIGIT_REMOVED' : null;
  },
  same: (a, b) => a === b,
  answer: feedbackFor,
  solved: (f) => f.solved,
  tier: (state, _value, _secret, f) => tierOf(f, state.length),
};
