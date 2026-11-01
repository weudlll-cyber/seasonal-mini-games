/**
 * @file   games/safecracker/src/leafFall.ts
 * @module games/safecracker
 * @brief  Which digits a Leaf Fall drops: only digits in no secret, by the candidate rule of O37.
 *
 * Responsibility: the candidates of a fall, steps 1–4 of 02b §7.3: the digits in use without
 *                 those fallen; without every digit of any secret of the round; with a shared
 *                 code and visibility `full`, without every digit of a public guess answered
 *                 0 right places, 0 wrong places before the Frost cut (the only deduction used);
 *                 otherwise without every digit of any accepted guess (DECISIONS T111). A fall
 *                 takes `perFall` candidates chosen uniformly, or all of them when fewer are
 *                 left, and none once the candidates are gone. The platform's `count` and
 *                 `minRemaining` do not apply. Every choice comes from the DRBG it is given.
 * Depends on:     @smg/game-sdk (Drbg), @smg/guess-engine (public answers, guessed values, the
 *                 distinct draw, the secrets), ./state
 * Used by:        ./specials
 * Spec:           docs/spec/02b-game-safecracker.md §7.3; docs/spec/05-security-threat-model.md §3.1
 */
import type { Drbg } from '@smg/game-sdk';
import {
  allSecrets,
  guessedValues,
  pickDistinct,
  publicGuesses,
  type Secrets,
} from '@smg/guess-engine';

import { digitsOf, type ScState } from './state.js';

// The codes whose digits are out of the candidates: the public 0/0 answers (shared `full`) or
// every accepted guess (every other case).
function ruledOut(state: ScState, releasedBefore: number): string[] {
  if (state.mode === 'shared' && state.visibility === 'full') {
    return publicGuesses(state, releasedBefore)
      .filter((g) => g.feedback.exact === 0 && g.feedback.near === 0)
      .map((g) => g.value);
  }
  return guessedValues(state);
}

// Every digit a fall may drop now, ascending.
export function candidatesOf(
  state: ScState,
  secrets: Secrets<string>,
  releasedBefore: number,
): number[] {
  const out = new Set(state.fallen);
  for (const code of [...allSecrets(secrets), ...ruledOut(state, releasedBefore)]) {
    for (const d of digitsOf(code)) out.add(d);
  }
  return Array.from({ length: state.digits }, (_, d) => d).filter((d) => !out.has(d));
}

// The digits one fall drops, ascending; none once no candidate is left.
export function fallingDigits(
  state: ScState,
  secrets: Secrets<string>,
  releasedBefore: number,
  rng: Drbg,
): number[] {
  const pool = candidatesOf(state, secrets, releasedBefore);
  return pickDistinct(pool, Math.min(state.perFall, pool.length), rng).sort((a, b) => a - b);
}
