/**
 * @file   games/bomb-defusal/src/devBot.ts
 * @module games/bomb-defusal
 * @brief  The development bot: cuts one of the sequences still consistent with its own answers.
 *
 * Responsibility: from its player view only (never a secret), every order of `cuts` different
 *                 wires of the bomb that no harmless wire is in, that starts with the free hint
 *                 when there is one, that it has not tried, and that gives each of its answered
 *                 sequences exactly the answer it got (02c §2); it sends one of them chosen with
 *                 `pick`. Nothing to do once defused. Used by the Quick Test (09 §5).
 * Depends on:     @smg/game-sdk (DevBot), ./rules, ./views, ./wires
 * Used by:        ./index, games/registry
 * Spec:           docs/spec/02c-game-bomb-defusal.md §2; docs/spec/09-testing-strategy.md §5
 */
import type { DevBot } from '@smg/game-sdk';

import type { GuessAction } from './rules.js';
import type { PlayerView } from './views.js';
import { sameSequence, type Sequence, type Wire } from './wires.js';

type Answered = { readonly value: Sequence; readonly correct: number };

// Whether `wire` may stand at place `j` given every answer: the first `correct` places of an
// answered sequence are known, and its place `correct` is known not to hold its wire.
const fits = (answers: readonly Answered[], wire: Wire, j: number): boolean =>
  answers.every((a) =>
    j < a.correct ? a.value[j] === wire : j > a.correct || a.value[j] !== wire,
  );

// Every order of `n` different wires of `pool` that fits the answers place by place.
function orders(
  pool: readonly Wire[],
  n: number,
  answers: readonly Answered[],
  start: Sequence = [],
): Sequence[] {
  if (start.length === n) return [start];
  return pool
    .filter((w) => !start.includes(w) && fits(answers, w, start.length))
    .flatMap((w) => orders(pool, n, answers, [...start, w]));
}

export const bombDefusalDevBot: DevBot<GuessAction> = (view, pick) => {
  const v = view as PlayerView;
  if (v.guesses.some((g) => g.feedback?.defused === true)) return null;
  const pool = v.wires.filter((w) => !v.harmless.includes(w));
  const answers = v.guesses.flatMap((g) =>
    g.feedback === null ? [] : [{ value: g.value, correct: g.feedback.correct }],
  );
  // A sequence whose answer Frost still holds is not sent again.
  const held = v.guesses.filter((g) => g.feedback === null).map((g) => g.value);
  const fitting = orders(pool, v.cuts, answers, v.hint === null ? [] : [v.hint]).filter(
    (s) => !held.some((h) => sameSequence(h, s)),
  );
  const value = fitting[pick(fitting.length)];
  return value === undefined ? null : { value };
};
