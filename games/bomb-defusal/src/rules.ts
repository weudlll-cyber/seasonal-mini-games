/**
 * @file   games/bomb-defusal/src/rules.ts
 * @module games/bomb-defusal
 * @brief  The game's own acceptance checks, answer, tier and explosion, plugged into the guess engine.
 *
 * Responsibility: checks 4–5 of 02c §4: exactly `cuts` wires of this round, none twice
 *                 (`SEQUENCE_INVALID`), and no wire Leaf Fall marked harmless (`WIRE_HARMLESS`);
 *                 the engine adds the repeat check (6, only the identical order) and the
 *                 platform the cooldown (7). The answer is the longest correct start (./wires),
 *                 solved when every cut was right, its tier by the fixed rule of 02c §7. A wrong
 *                 first cut explodes: the decision carries the round's penalty as
 *                 `extraCooldownMs`, the same for every player and decided by the answer alone
 *                 (O40, DECISIONS T120). No check depends on the secret.
 * Depends on:     @smg/guess-engine (GuessRules, GuessAction), ./state, ./wires
 * Used by:        ./module, ./index
 * Spec:           docs/spec/02c-game-bomb-defusal.md §4, §5, §7; docs/spec/04-software-architecture.md §4.2, §4.7
 */
import type { GuessAction as EngineAction, GuessRules } from '@smg/guess-engine';

import type { BdState } from './state.js';
import { answerOf, sameSequence, tierOf, type Feedback, type Sequence } from './wires.js';

export type GuessAction = EngineAction<Sequence>;

// Exactly `cuts` entries, each a wire of this round, none twice (check 4).
const wellFormed = (state: BdState, value: Sequence): boolean =>
  value.length === state.cuts &&
  new Set(value).size === value.length &&
  value.every((w) => state.wires.includes(w));

export const bdRules: GuessRules<BdState, Sequence, Feedback, Sequence> = {
  // The platform refuses a player off the roster before the game is asked.
  unknownPlayer: 'NOT_IN_ROUND',
  check: (state, _playerId, value) => {
    if (!wellFormed(state, value)) return 'SEQUENCE_INVALID';
    return value.some((w) => state.harmless.includes(w)) ? 'WIRE_HARMLESS' : null;
  },
  same: sameSequence,
  answer: answerOf,
  solved: (feedback) => feedback.defused,
  tier: (state, _value, _secret, feedback) => tierOf(feedback.correct, state.cuts),
  // The explosion (O40): the penalty on a wrong first cut, nothing otherwise.
  extraCooldownMs: (state, feedback) => (feedback.correct === 0 ? state.penaltyMs : 0),
};
