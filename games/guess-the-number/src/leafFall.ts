/**
 * @file   games/guess-the-number/src/leafFall.ts
 * @module games/guess-the-number
 * @brief  Which numbers a Leaf Fall removes: only numbers still possible from the public answers.
 *
 * Responsibility: the candidate set of a fall (O37). With a shared number and visibility `full`
 *                 every answer is public, so the candidates are the round's range (shown or
 *                 hidden), cut by every higher/lower answer Frost has delivered, without the
 *                 numbers guessed or fallen. With `own` or `numbers`, and in individual mode,
 *                 no answer is public: the candidates are the whole range without the numbers
 *                 guessed or fallen (DECISIONS T111). A fall removes `count` candidates chosen
 *                 uniformly, never a secret, and stops when the candidates would drop below
 *                 `minRemaining` (03 §2.3). Every choice comes from the DRBG it is given, so the
 *                 same seed and the same guesses remove the same numbers.
 * Depends on:     @smg/game-sdk (ranges, Drbg), ./secrets, ./state
 * Used by:        ./specials
 * Spec:           docs/spec/03-seasonal-specials.md §2.3; docs/spec/05-security-threat-model.md §3
 */
import { inRange, rangeSize, type Drbg, type Range } from '@smg/game-sdk';

import type { Secrets } from './secrets.js';
import type { GtnState } from './state.js';

// The range cut by the answers every player can see; the whole range where none are public.
export function publicBounds(state: GtnState, releasedBefore: number): Range {
  if (state.mode !== 'shared' || state.visibility !== 'full') return state.range;
  let { low, high } = state.range;
  for (const p of Object.values(state.players)) {
    for (const g of p.guesses) {
      // A held answer counts once Frost delivers it, the same cut as the views' (T111).
      if (g.receivedAt >= releasedBefore) continue;
      if (g.feedback === 'higher') low = Math.max(low, g.value + 1);
      if (g.feedback === 'lower') high = Math.min(high, g.value - 1);
    }
  }
  return { low, high };
}

export interface Candidates {
  readonly bounds: Range;
  // Numbers inside `bounds` that are not candidates: guessed or fallen.
  readonly out: ReadonlySet<number>;
  // How many candidates there are, the secrets among them included.
  readonly size: number;
}

// Every number still possible: inside the public bounds, not guessed, not fallen.
export function candidatesOf(state: GtnState, releasedBefore: number): Candidates {
  const bounds = publicBounds(state, releasedBefore);
  const guessed = Object.values(state.players).flatMap((p) => p.guesses.map((g) => g.value));
  const out = new Set([...state.removed, ...guessed].filter((v) => inRange(bounds, v)));
  return { bounds, out, size: Math.max(0, rangeSize(bounds) - out.size) };
}

const allSecrets = (s: Secrets): number[] =>
  s.mode === 'shared' ? [s.value] : Object.values(s.byPlayer);

// `n` distinct values from `pool`, uniformly: a partial Fisher–Yates shuffle.
function pickFrom(pool: number[], n: number, rng: Drbg): number[] {
  for (let i = 0; i < n; i += 1) {
    const j = i + rng.nextInt(pool.length - i);
    [pool[i], pool[j]] = [pool[j] ?? 0, pool[i] ?? 0];
  }
  return pool.slice(0, n);
}

// `n` distinct values of `range` that `allowed` accepts, uniformly, by rejection (large ranges).
function rejectFrom(range: Range, n: number, allowed: (v: number) => boolean, rng: Drbg): number[] {
  const chosen = new Set<number>();
  while (chosen.size < n) {
    const v = rng.intBetween(range.low, range.high);
    if (allowed(v)) chosen.add(v);
  }
  return [...chosen];
}

// Below this many numbers in the bounds the candidates are listed; above it they are drawn by
// rejection, which stays fast because a fall never takes the candidates below `minRemaining`.
const LIST_LIMIT = 20_000;

// The numbers one fall removes, ascending; none once the candidates are down to the minimum.
export function fallingNumbers(
  state: GtnState,
  secrets: Secrets,
  fall: { readonly count: number; readonly releasedBefore: number },
  rng: Drbg,
): number[] {
  const { bounds, out, size } = candidatesOf(state, fall.releasedBefore);
  const secret = new Set(allSecrets(secrets).filter((v) => inRange(bounds, v) && !out.has(v)));
  const allowed = (v: number) => !out.has(v) && !secret.has(v);
  const removable = size - secret.size;
  const n = Math.min(fall.count, size - state.specials.minRemaining, removable);
  if (n <= 0) return [];
  if (rangeSize(bounds) <= LIST_LIMIT || removable < 4 * n) {
    const pool: number[] = [];
    for (let v = bounds.low; v <= bounds.high; v += 1) if (allowed(v)) pool.push(v);
    return pickFrom(pool, n, rng).sort((a, b) => a - b);
  }
  return rejectFrom(bounds, n, allowed, rng).sort((a, b) => a - b);
}
