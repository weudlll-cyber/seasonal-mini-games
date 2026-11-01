/**
 * @file   games/bomb-defusal/src/specials.ts
 * @module games/bomb-defusal
 * @brief  What Spring Herald and Leaf Fall do in Seasonal Bomb Defusal (no halving, 02c §8.5).
 *
 * Responsibility: Spring Herald names the first cut's colour: of the shared bomb to everyone,
 *                 or of each player's own bomb to that player alone (02c §8.1, 03 §2.1). Leaf
 *                 Fall marks wires harmless from the candidates of ./leafFall, one set for
 *                 everyone; it ignores the platform's `count` and uses `autumn.wiresPerFall`.
 *                 When a fall is due and no candidate is left, one room event says so; the
 *                 next call returns nothing, which stops the timer (04 §4.4). Every choice
 *                 comes from the round randomness under `leafFall/<k>` (04 §5.4).
 * Depends on:     @smg/game-sdk (hooks), @smg/guess-engine (secrets), ./leafFall, ./state, ./wires
 * Used by:        ./module
 * Spec:           docs/spec/02c-game-bomb-defusal.md §8; docs/spec/03-seasonal-specials.md §2.1, §2.3
 */
import type { Emitted, SpecialHooks } from '@smg/game-sdk';
import { secretOf, type Secrets } from '@smg/guess-engine';

import { fallingWires } from './leafFall.js';
import type { BdEvent, BdState } from './state.js';
import { inPaletteOrder, type Sequence, type Wire } from './wires.js';

const firstOf = (secrets: Secrets<Sequence>, playerId: string): Wire =>
  secretOf(secrets, playerId)[0] as Wire;

export const bdSpecials: Partial<SpecialHooks<BdState, BdEvent, Secrets<Sequence>>> = {
  springHerald: (state, ctx) => {
    if (state.mode === 'shared') {
      const wire = firstOf(ctx.secrets, '');
      return [{ audience: 'room', event: { type: 'HintGiven', playerId: null, wire } }];
    }
    return Object.keys(state.players).map((id): Emitted<BdEvent> => ({
      audience: `player:${id}`,
      event: { type: 'HintGiven', playerId: id, wire: firstOf(ctx.secrets, id) },
    }));
  },
  leafFall: (state, ctx, fall) => {
    if (state.fallsOver) return [];
    const { index } = fall;
    const rng = ctx.rng.child('leafFall', String(index));
    const wires = inPaletteOrder(fallingWires(state, ctx.secrets, fall.releasedBefore, rng));
    const event: BdEvent =
      wires.length === 0
        ? { type: 'HarmlessOver', index }
        : { type: 'WiresHarmless', index, wires };
    return [{ audience: 'room', event }];
  },
};
