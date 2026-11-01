/**
 * @file   games/seasonal-target/src/devBot.ts
 * @module games/seasonal-target
 * @brief  The development bot: guesses a cell its own answers still allow.
 *
 * Responsibility: from its player view only (never a secret), every cell of its target area
 *                 that is not fallen, not tried, and gives each of its own answered guesses the
 *                 answer it got — the reasoning a player does with the arrows or tiers on the
 *                 map (the server sends nothing narrowed, O17). It picks one of them at random,
 *                 so bots do not all guess alike and a round ends within a few guesses in
 *                 `direction` mode. Used by the Quick Test.
 * Depends on:     @smg/game-sdk (DevBot), ./geometry, ./rules, ./views
 * Used by:        ./index, games/registry
 * Spec:           docs/spec/09-testing-strategy.md §5; docs/spec/02d-game-seasonal-target.md §5
 */
import type { DevBot } from '@smg/game-sdk';

import { answerOf, cellKey, cellsOf, sameAnswer, type AnswerRule } from './geometry.js';
import type { GuessAction } from './rules.js';
import type { PlayerView } from './views.js';

export const stDevBot: DevBot<GuessAction> = (view, pick) => {
  const v = view as PlayerView;
  if (v.guesses.some((g) => g.feedback?.kind === 'correct')) return null;
  const rule: AnswerRule = { mode: v.feedbackMode, map: v.map };
  const tried = new Set([...v.guesses.map((g) => g.value), ...v.fallen].map(cellKey));
  // Answers Frost still holds say nothing yet.
  const answered = v.guesses.flatMap((g) =>
    g.feedback === null ? [] : [{ value: g.value, feedback: g.feedback }],
  );
  const open = cellsOf(v.area).filter(
    (c) =>
      !tried.has(cellKey(c)) &&
      answered.every((g) => sameAnswer(answerOf(g.value, c, rule), g.feedback)),
  );
  if (open.length === 0) return null;
  const cell = open[pick(open.length)];
  return cell === undefined ? null : { value: cell };
};
