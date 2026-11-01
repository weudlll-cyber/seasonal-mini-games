/**
 * @file   games/safecracker/src/devBot.ts
 * @module games/safecracker
 * @brief  The development bot: tries codes that fit every answer it has had, like a player.
 *
 * Responsibility: from its player view only (never a secret), a code of the round's length
 *                 with digits in use and not fallen, the Spring Herald hint in its place, that
 *                 it has not tried, and that would have got every answer its own delivered
 *                 codes got — the classic Mastermind play. It walks the allowed codes from a
 *                 start chosen with `pick`, so bots do not all guess alike, at most `SCAN` of
 *                 them per move, and settles for the first untried one when none fits. Nothing
 *                 to do once solved. Used by the Quick Test.
 * Depends on:     @smg/game-sdk (DevBot), ./feedback, ./rules, ./views
 * Used by:        ./index, games/registry
 * Spec:           docs/spec/09-testing-strategy.md §5; docs/spec/02b-game-safecracker.md §5.1
 */
import type { DevBot } from '@smg/game-sdk';

import { feedbackFor } from './feedback.js';
import type { GuessAction } from './rules.js';
import type { PlayerView } from './views.js';

// Codes looked at per move: every code of a default round (10 000), a slice of a longer one.
const SCAN = 40_000;

// The allowed codes in a fixed order: the free positions (all but the hint's) count in base
// `allowed.length`; `index` picks one.
function codeAt(v: PlayerView, allowed: readonly number[], index: number): string {
  let rest = index;
  let out = '';
  for (let i = v.length - 1; i >= 0; i -= 1) {
    if (i === v.hint?.position) {
      out = String(v.hint.digit) + out;
      continue;
    }
    out = String(allowed[rest % allowed.length]) + out;
    rest = Math.floor(rest / allowed.length);
  }
  return out;
}

export const scDevBot: DevBot<GuessAction> = (view, pick) => {
  const v = view as PlayerView;
  if (v.guesses.some((g) => g.feedback?.solved === true)) return null;
  const allowed = Array.from({ length: v.digits }, (_, d) => d).filter(
    (d) => !v.fallen.includes(d),
  );
  if (allowed.length === 0) return null;
  const tried = new Set(v.guesses.map((g) => g.value));
  const answered = v.guesses.flatMap((g) =>
    g.feedback === null ? [] : [{ value: g.value, ...g.feedback }],
  );
  // A code fits when, were it the secret, every delivered code would have got its answer.
  const fits = (code: string) =>
    answered.every((g) => {
      const f = feedbackFor(g.value, code);
      return f.exact === g.exact && f.near === g.near;
    });
  const free = v.length - (v.hint === null ? 0 : 1);
  const size = allowed.length ** free;
  const start = pick(size);
  let fallback: string | null = null;
  for (let k = 0; k < Math.min(size, SCAN); k += 1) {
    const code = codeAt(v, allowed, (start + k) % size);
    if (tried.has(code)) continue;
    if (fits(code)) return { value: code };
    fallback ??= code;
  }
  return fallback === null ? null : { value: fallback };
};
