/**
 * @file   games/bomb-defusal/src/leafFall.ts
 * @module games/bomb-defusal
 * @brief  Which wires a Leaf Fall marks harmless: never a secret wire, never one already known.
 *
 * Responsibility: the candidate set of a fall (O37, 02c §8.3): the round's wires without the
 *                 ones already marked and without every wire of any secret of the round (all
 *                 players' in individual mode); with a shared secret and visibility `full`
 *                 also without every wire the delivered public answers prove harmless (Frost's
 *                 cut `releasedBefore`, DECISIONS T111); otherwise without every wire of any
 *                 accepted sequence. A fall marks `wiresPerFall` of them chosen uniformly, or
 *                 as many as are left. Every choice comes from the DRBG it is given, so the
 *                 same seed and the same sequences mark the same wires.
 * Depends on:     @smg/game-sdk (Drbg), @smg/guess-engine (public answers, guessed values,
 *                 the distinct draw, the secrets), ./state, ./wires
 * Used by:        ./specials, ./leafFall.test
 * Spec:           docs/spec/02c-game-bomb-defusal.md §8.3; docs/spec/05-security-threat-model.md §3.1
 */
import type { Drbg } from '@smg/game-sdk';
import {
  allSecrets,
  guessedValues,
  pickDistinct,
  publicGuesses,
  type Guess,
  type Secrets,
} from '@smg/guess-engine';

import type { BdState } from './state.js';
import type { Feedback, Sequence, Wire } from './wires.js';

type Answered = Guess<Sequence, Feedback>;

// Whether one answer rules `wire` out of position `j` (0-based): the position is known to hold
// another wire, or the answer shows that `wire` is not there.
const rulesOut = (g: Answered, wire: Wire, j: number): boolean =>
  (g.feedback.correct > j && g.value[j] !== wire) ||
  (g.feedback.correct === j && g.value[j] === wire);

// A wire proven harmless: every position ruled out by some delivered answer (02c §8.3 rule 3).
export function provenHarmless(answers: readonly Answered[], wire: Wire, cuts: number): boolean {
  for (let j = 0; j < cuts; j += 1) {
    if (!answers.some((g) => rulesOut(g, wire, j))) return false;
  }
  return true;
}

// The wires a fall may mark, in palette order.
function candidatesOf(state: BdState, secrets: Secrets<Sequence>, releasedBefore: number): Wire[] {
  const out = new Set<Wire>([...state.harmless, ...allSecrets(secrets).flat()]);
  if (state.mode === 'shared' && state.visibility === 'full') {
    const answers = publicGuesses(state, releasedBefore);
    for (const w of state.wires) if (provenHarmless(answers, w, state.cuts)) out.add(w);
  } else {
    for (const w of guessedValues(state).flat()) out.add(w);
  }
  return state.wires.filter((w) => !out.has(w));
}

// The wires one fall marks: `wiresPerFall` candidates, or as many as are left.
export function fallingWires(
  state: BdState,
  secrets: Secrets<Sequence>,
  releasedBefore: number,
  rng: Drbg,
): Wire[] {
  const pool = candidatesOf(state, secrets, releasedBefore);
  const n = Math.min(state.wiresPerFall, pool.length);
  return pickDistinct(pool, n, rng);
}
