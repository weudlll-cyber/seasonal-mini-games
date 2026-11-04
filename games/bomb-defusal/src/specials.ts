/**
 * @file   games/bomb-defusal/src/specials.ts
 * @module games/bomb-defusal
 * @brief  What Spring Herald and Leaf Fall do in Seasonal Bomb Defusal (no halving, 02c §8.5).
 *
 * Responsibility: Spring Herald names the first cut's colour: of the shared bomb to everyone,
 *                 or of each player's own bomb to that player alone (02c §8.1, 03 §2.1). Leaf
 *                 Fall marks ONE wire harmless per fall (O42), one set for everyone; it ignores
 *                 the platform's `count`. The candidates are the round's wires minus the ones
 *                 already marked and minus every wire of any secret of the round (all players'
 *                 in individual mode); guesses and public answers play no part. The fall that
 *                 marks the last candidate also says that every harmless wire is marked; the
 *                 next call returns nothing, which stops the timer (04 §4.4). With no candidate
 *                 from the start a fall adds nothing and the timer stops without a line. Every
 *                 choice comes from the round randomness under `leafFall/<k>` (04 §5.4).
 * Depends on:     @smg/game-sdk (hooks), @smg/guess-engine (secrets, the distinct draw),
 *                 ./state, ./wires
 * Used by:        ./module
 * Spec:           docs/spec/02c-game-bomb-defusal.md §8; docs/spec/03-seasonal-specials.md §2.1, §2.3
 */
import type { Emitted, SpecialHooks } from '@smg/game-sdk';
import { allSecrets, pickDistinct, secretOf, type Secrets } from '@smg/guess-engine';

import type { BdEvent, BdState } from './state.js';
import type { Sequence, Wire } from './wires.js';

const firstOf = (secrets: Secrets<Sequence>, playerId: string): Wire =>
  secretOf(secrets, playerId)[0] as Wire;

// The wires a fall may mark (O42), in palette order: in no secret and not yet marked.
function candidatesOf(state: BdState, secrets: Secrets<Sequence>): Wire[] {
  const out = new Set<Wire>([...state.harmless, ...allSecrets(secrets).flat()]);
  return state.wires.filter((w) => !out.has(w));
}

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
    const pool = candidatesOf(state, ctx.secrets);
    if (state.fallsOver || pool.length === 0) return [];
    const { index } = fall;
    const wires = pickDistinct(pool, 1, ctx.rng.child('leafFall', String(index)));
    const marked: Emitted<BdEvent> = {
      audience: 'room',
      event: { type: 'WiresHarmless', index, wires },
    };
    // The last candidate: "every harmless wire is marked" with the same fall.
    if (pool.length > 1) return [marked];
    return [marked, { audience: 'room', event: { type: 'HarmlessOver', index } }];
  },
};
