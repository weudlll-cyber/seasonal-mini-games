/**
 * @file   games/safecracker/src/specials.ts
 * @module games/safecracker
 * @brief  What Spring Herald and Leaf Fall do in Seasonal Safecracker; there is no halving.
 *
 * Responsibility: Spring Herald reveals one position's digit: of the shared code to the room,
 *                 or of each player's own code to that player alone, with the room told only
 *                 that everyone got a hint (02b §7.1). Leaf Fall drops `perFall` digits that
 *                 are in no secret (./leafFall, O37), the same for everyone. Every choice comes
 *                 from the round randomness under `springHerald/<shared|playerId>` and
 *                 `leafFall/<k>` (04 §5.4). No `halving` hook (02b §7.4).
 * Depends on:     @smg/game-sdk (hooks), @smg/guess-engine (secrets), ./leafFall, ./state
 * Used by:        ./module
 * Spec:           docs/spec/02b-game-safecracker.md §7; docs/spec/03-seasonal-specials.md §2.1, §2.3
 */
import type { Drbg, Emitted, SpecialHooks } from '@smg/game-sdk';
import { secretOf, type Secrets } from '@smg/guess-engine';

import { fallingDigits } from './leafFall.js';
import type { Hint, ScEvent, ScState } from './state.js';

// One position of `code`, uniformly, and its digit.
function hintFor(code: string, rng: Drbg): Hint {
  const position = rng.nextInt(code.length);
  return { position, digit: Number(code[position]) };
}

export const scSpecials: Pick<
  SpecialHooks<ScState, ScEvent, Secrets<string>>,
  'springHerald' | 'leafFall'
> = {
  springHerald: (state, ctx) => {
    if (state.mode === 'shared') {
      const hint = hintFor(secretOf(ctx.secrets, ''), ctx.rng.child('springHerald', 'shared'));
      return [{ audience: 'room', event: { type: 'HintGiven', playerId: null, hint } }];
    }
    const own = Object.keys(state.players).map((id): Emitted<ScEvent> => ({
      audience: `player:${id}`,
      event: {
        type: 'HintGiven',
        playerId: id,
        hint: hintFor(secretOf(ctx.secrets, id), ctx.rng.child('springHerald', id)),
      },
    }));
    // Spectators and the room learn only that everyone got a hint (02b §7.1).
    return [...own, { audience: 'room', event: { type: 'HintGiven', playerId: null, hint: null } }];
  },
  // The platform's `count` does not apply: the game's own `autumn.digitsPerFall` does.
  leafFall: (state, ctx, fall) => {
    const rng = ctx.rng.child('leafFall', String(fall.index));
    const digits = fallingDigits(state, ctx.secrets, fall.releasedBefore, rng);
    if (digits.length === 0) return [];
    return [{ audience: 'room', event: { type: 'DigitsFallen', index: fall.index, digits } }];
  },
};
