/**
 * @file   games/seasonal-target/src/rules.ts
 * @module games/seasonal-target
 * @brief  The game's own acceptance checks and answer, plugged into the guess engine.
 *
 * Responsibility: checks 4–5 of 02d §4: the cell on the map and inside the player's current
 *                 target area (`OUT_OF_MAP`), not fallen (`CELL_REMOVED`); none depends on the
 *                 secret. The engine adds the repeat check (6, `ALREADY_GUESSED`) and decides
 *                 an accepted guess: the answer (./geometry), its tier for the comment, the
 *                 room's line and `Solved` (04 §4.7).
 * Depends on:     @smg/guess-engine (GuessRules, GuessAction), ./geometry, ./secrets, ./state
 * Used by:        ./module, ./index
 * Spec:           docs/spec/02d-game-seasonal-target.md §4, §5, §7
 */
import type { GuessAction as EngineAction, GuessRules } from '@smg/guess-engine';

import { answerOf, inArea, sameCell, tierOf, type Cell, type Feedback } from './geometry.js';
import type { Target } from './secrets.js';
import type { StState } from './state.js';

export type GuessAction = EngineAction<Cell>;

export type StCode = 'OUT_OF_MAP' | 'CELL_REMOVED' | 'ALREADY_GUESSED';

// The largest map side (08 §3.3): the input takes nothing beyond it.
export const MAP_LIMIT = 100;

export const stRules: GuessRules<StState, Cell, Feedback, Target> = {
  // The platform refuses an action of a player outside the roster first (02 §5.1, check 2).
  unknownPlayer: 'NOT_IN_ROUND',
  check: (state, playerId, value) => {
    const player = state.players[playerId];
    // The player's own area: the map, or the current halving window (02d §8.4).
    if (player === undefined || !inArea(player.area, value)) return 'OUT_OF_MAP';
    return state.fallen.some((c) => sameCell(c, value)) ? 'CELL_REMOVED' : null;
  },
  same: sameCell,
  answer: (value, target) => answerOf(value, target, target.rule),
  solved: (feedback) => feedback.kind === 'correct',
  tier: (state, value, target) => tierOf(value, target, state.map),
};
