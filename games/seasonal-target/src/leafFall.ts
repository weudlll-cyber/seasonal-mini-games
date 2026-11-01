/**
 * @file   games/seasonal-target/src/leafFall.ts
 * @module games/seasonal-target
 * @brief  Which cells a Leaf Fall removes: only cells where the target can still be (O37).
 *
 * Responsibility: the candidate cells of a fall (02d §8.3): inside the current target area
 *                 (shared) or inside at least one player's area (individual), not fallen, no
 *                 secret, guessed by no one; with a shared target and visibility `full` also
 *                 giving every answer Frost has delivered the same answer the target gave (the
 *                 same rounded distance and direction, or the same tier). With `own`,
 *                 `numbers` and in individual mode no answer is public (T111). A fall removes
 *                 `count` candidates uniformly with the DRBG it is given, and only as many as
 *                 leave `minCellsLeft` candidates. The answer test stops at the first answer a
 *                 cell contradicts, so most cells cost one or two comparisons.
 * Depends on:     @smg/game-sdk (Drbg), @smg/guess-engine (public answers, guessed values, the
 *                 distinct draw, the secrets), ./geometry, ./secrets, ./state
 * Used by:        ./specials, ./leafFall.test
 * Spec:           docs/spec/02d-game-seasonal-target.md §8.3; docs/spec/05-security-threat-model.md §3.1
 */
import type { Drbg } from '@smg/game-sdk';
import { allSecrets, guessedValues, pickDistinct, publicGuesses } from '@smg/guess-engine';

import {
  answerOf,
  cellKey,
  cellsOf,
  inArea,
  sameAnswer,
  wholeMap,
  type AnswerRule,
  type Cell,
} from './geometry.js';
import { cellOf, type Secrets } from './secrets.js';
import type { StState } from './state.js';

// The areas a candidate may lie in: the shared one, or every player's own.
const areasOf = (state: StState) =>
  state.mode === 'shared' ? [state.area] : Object.values(state.players).map((p) => p.area);

// Every candidate cell of a fall, row by row (02d §8.3 rules 1–3).
export function candidatesOf(state: StState, secrets: Secrets, releasedBefore: number): Cell[] {
  const out = new Set(
    [...state.fallen, ...guessedValues(state), ...allSecrets(secrets).map(cellOf)].map(cellKey),
  );
  const rule: AnswerRule = { mode: state.feedbackMode, map: state.map };
  const answers = publicGuesses(state, releasedBefore);
  const areas = areasOf(state);
  // The whole map, row by row; a cell counts once even where individual areas overlap.
  return cellsOf(wholeMap(state.map)).filter(
    (c) =>
      !out.has(cellKey(c)) &&
      areas.some((a) => inArea(a, c)) &&
      answers.every((g) => sameAnswer(answerOf(g.value, c, rule), g.feedback)),
  );
}

// The cells one fall removes, row by row; none once the candidates are down to the minimum.
export function fallingCells(
  state: StState,
  secrets: Secrets,
  fall: { readonly count: number; readonly releasedBefore: number },
  rng: Drbg,
): Cell[] {
  const pool = candidatesOf(state, secrets, fall.releasedBefore);
  const n = Math.min(fall.count, pool.length - state.specials.minCellsLeft);
  if (n <= 0) return [];
  return pickDistinct(pool, n, rng).sort((a, b) => cellKey(a) - cellKey(b));
}
