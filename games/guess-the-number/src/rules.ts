/**
 * @file   games/guess-the-number/src/rules.ts
 * @module games/guess-the-number
 * @brief  The game's own acceptance checks and answer, plugged into the guess engine.
 *
 * Responsibility: checks 4–5 of 02 §5.1 (inside the player's current range when the range is
 *                 shown, not removed); with a hidden range any whole number is accepted and
 *                 answered, because refusing one outside the range would tell where the range is
 *                 (DECISIONS T53). The engine adds the repeat check (6) and decides an accepted
 *                 guess: the answer higher, lower or correct (./feedback), its closeness tier
 *                 against the round's range (./closeness), the room's line and `Solved` (04 §4.7).
 * Depends on:     @smg/game-sdk (inRange), @smg/guess-engine (GuessRules, GuessAction),
 *                 ./closeness, ./feedback, ./secrets, ./state
 * Used by:        ./module, ./index
 * Spec:           docs/spec/02-game-guess-the-number.md §5.1, §6, §8; docs/spec/04-software-architecture.md §4.7
 */
import { inRange } from '@smg/game-sdk';
import type { GuessAction as EngineAction, GuessRules } from '@smg/guess-engine';

import { tierOf } from './closeness.js';
import { feedbackFor, type Feedback } from './feedback.js';
import type { GtnState } from './state.js';

export type GuessAction = EngineAction<number>;

export type GtnCode = 'OUT_OF_RANGE' | 'NUMBER_REMOVED' | 'ALREADY_GUESSED';

// The input takes any whole number from −1 000 000 000 to 1 000 000 000 (T53).
export const GUESS_LIMIT = 1_000_000_000;

export const gtnRules: GuessRules<GtnState, number, Feedback, number> = {
  unknownPlayer: 'OUT_OF_RANGE',
  check: (state, playerId, value) => {
    const player = state.players[playerId];
    if (state.rangeVisible && player !== undefined && !inRange(player.range, value)) {
      return 'OUT_OF_RANGE';
    }
    return state.removed.includes(value) ? 'NUMBER_REMOVED' : null;
  },
  same: (a, b) => a === b,
  answer: feedbackFor,
  solved: (feedback) => feedback === 'correct',
  tier: (state, value, secret) => tierOf(value, secret, state.initial, state.comments.thresholds),
};
