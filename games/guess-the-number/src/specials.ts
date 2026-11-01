/**
 * @file   games/guess-the-number/src/specials.ts
 * @module games/guess-the-number
 * @brief  What Spring Herald, Leaf Fall and halving do in Guess The Number.
 *
 * Responsibility: Spring Herald gives one true hint (odd or even, or which half) about the
 *                 shared secret to everyone, or about each player's own number to that player
 *                 (03 §2.1). Leaf Fall removes `count` numbers chosen uniformly from the
 *                 numbers still possible, never a secret (./leafFall, O37). Halving replaces a
 *                 range by a window of half its size, rounded up, placed uniformly among the
 *                 positions that hold the secret, until the range has `minRangeSize` numbers
 *                 or fewer (03 §4). Every choice comes from the round randomness under the
 *                 labels `leafFall/<k>` and `halving/<k>/<playerId|shared>` (04 §5.4).
 * Depends on:     @smg/game-sdk (hooks, ranges), ./leafFall, ./secrets, ./state
 * Used by:        ./module
 * Spec:           docs/spec/03-seasonal-specials.md §2.1, §2.3, §4
 */
import { rangeSize, type Drbg, type Emitted, type Range, type SpecialHooks } from '@smg/game-sdk';

import { fallingNumbers } from './leafFall.js';
import { secretOf, type Secrets } from './secrets.js';
import type { GtnEvent, GtnState, Hint } from './state.js';

function hintFor(state: GtnState, secret: number, range: Range): Hint {
  if (state.specials.hintType === 'parity') return { kind: 'parity', odd: secret % 2 !== 0 };
  const mid = Math.floor((range.low + range.high) / 2);
  return secret <= mid
    ? { kind: 'half', low: range.low, high: mid }
    : { kind: 'half', low: mid + 1, high: range.high };
}

// A window of half the size, rounded up, holding `secret`, placed uniformly inside `range`.
function window(range: Range, secret: number, rng: Drbg): Range {
  const size = Math.ceil(rangeSize(range) / 2);
  const low = rng.intBetween(
    Math.max(range.low, secret - size + 1),
    Math.min(secret, range.high - size + 1),
  );
  return { low, high: low + size - 1 };
}

export const gtnSpecials: SpecialHooks<GtnState, GtnEvent, Secrets> = {
  springHerald: (state, ctx) => {
    if (state.mode === 'shared') {
      const hint = hintFor(state, secretOf(ctx.secrets, ''), state.range);
      return [{ audience: 'room', event: { type: 'HintGiven', playerId: null, hint } }];
    }
    return Object.keys(state.players).map((id): Emitted<GtnEvent> => ({
      audience: `player:${id}`,
      event: {
        type: 'HintGiven',
        playerId: id,
        hint: hintFor(state, secretOf(ctx.secrets, id), state.range),
      },
    }));
  },
  leafFall: (state, ctx, fall) => {
    const numbers = fallingNumbers(
      state,
      ctx.secrets,
      fall,
      ctx.rng.child('leafFall', String(fall.index)),
    );
    if (numbers.length === 0) return [];
    return [{ audience: 'room', event: { type: 'NumbersRemoved', index: fall.index, numbers } }];
  },
  halving: (state, ctx, index) => {
    const k = String(index);
    if (state.mode === 'shared') {
      if (rangeSize(state.range) <= state.specials.minRangeSize) return [];
      const range = window(
        state.range,
        secretOf(ctx.secrets, ''),
        ctx.rng.child('halving', k, 'shared'),
      );
      return [
        {
          audience: 'room',
          event: { type: 'RangeHalved', index, playerId: null, range, size: rangeSize(range) },
        },
      ];
    }
    // Every individual range has the same size at every moment, so one check decides for all.
    const first = Object.values(state.players)[0];
    if (first === undefined || rangeSize(first.range) <= state.specials.minRangeSize) return [];
    const size = Math.ceil(rangeSize(first.range) / 2);
    const own = Object.entries(state.players).map(([id, p]): Emitted<GtnEvent> => {
      const range = window(p.range, secretOf(ctx.secrets, id), ctx.rng.child('halving', k, id));
      return {
        audience: `player:${id}`,
        event: { type: 'RangeHalved', index, playerId: id, range, size },
      };
    });
    return [
      ...own,
      {
        audience: 'room',
        event: { type: 'RangeHalved', index, playerId: null, range: null, size },
      },
    ];
  },
};
