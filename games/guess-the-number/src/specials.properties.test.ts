/**
 * @file   games/guess-the-number/src/specials.properties.test.ts
 * @module games/guess-the-number
 * @brief  Spring Herald, Leaf Fall and halving: true, equal for everyone, from the seed.
 *
 * Responsibility: S1 every roster player gets exactly one true hint, of one type for all;
 *                 S3 no fall removes a secret, there is one removed set for everyone, each fall
 *                 removes `count` numbers or fewer only at the `minRemaining` stop, and the same
 *                 seed removes the same numbers; S5 every window holds its secret, has half the
 *                 size rounded up, lies inside the range, every individual range has the same
 *                 size, and halving stops at `minRangeSize`; P6 the effect is the same for all.
 * Depends on:     vitest, fast-check, @smg/game-sdk/crypto, ./fakes, ./module, ./secrets, ./state
 * Spec:           docs/spec/03-seasonal-specials.md §2.1, §2.3, §4; docs/spec/09-testing-strategy.md §3 P6, S1, S3, S5
 */
import { roundRng } from '@smg/game-sdk/crypto';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { input } from './fakes.js';
import { guessTheNumber } from './module.js';
import { deriveSecrets, secretOf, type Secrets } from './secrets.js';
import type { GtnEvent, GtnState } from './state.js';

const hooks = guessTheNumber.specials;
const PLAYERS = ['a', 'b', 'c', 'd'];

const round = fc.record({
  mode: fc.constantFrom('shared' as const, 'individual' as const),
  seed: fc.uint8Array({ minLength: 32, maxLength: 32 }),
  low: fc.integer({ min: 0, max: 100 }),
  width: fc.integer({ min: 9, max: 400 }),
  hintType: fc.constantFrom('parity' as const, 'half' as const),
});

type Round = typeof round extends fc.Arbitrary<infer T> ? T : never;

function setUp(r: Round) {
  const config = {
    rangeLow: r.low,
    rangeHigh: r.low + r.width,
    springHintType: r.hintType,
    autumnMinRemaining: 10,
    halvingMinRangeSize: 8,
  };
  const inp = input(r.mode, PLAYERS, config);
  const rng = roundRng(r.seed);
  const secrets = deriveSecrets(inp, rng);
  const state = guessTheNumber.createRound(inp);
  const ctx = { now: 0, cooldownMs: 3_000, secrets, rng };
  return { state, secrets, ctx };
}

const fold = (state: GtnState, events: readonly { event: GtnEvent }[]) =>
  events.reduce((s, e) => guessTheNumber.evolve(s, e.event), state);

function hintHolds(
  hint: Extract<GtnEvent, { type: 'HintGiven' }>['hint'],
  secret: number,
): boolean {
  if (hint.kind === 'parity') return hint.odd === (secret % 2 !== 0);
  return secret >= hint.low && secret <= hint.high;
}

describe('Spring Herald (S1)', () => {
  it('gives every player exactly one true hint of one type', () => {
    fc.assert(
      fc.property(round, (r) => {
        const { state, secrets, ctx } = setUp(r);
        const events = hooks?.springHerald?.(state, ctx) ?? [];
        const after = fold(state, events);
        for (const id of PLAYERS) {
          const hint = r.mode === 'shared' ? after.hint : (after.players[id]?.hint ?? null);
          expect(hint?.kind).toBe(r.hintType);
          if (hint !== null) expect(hintHolds(hint, secretOf(secrets, id))).toBe(true);
        }
        // P6: one room event in shared mode; one own event per player in individual mode.
        const audiences = events.map((e) => e.audience);
        expect(audiences).toEqual(
          r.mode === 'shared' ? ['room'] : PLAYERS.map((id) => `player:${id}`),
        );
      }),
      { numRuns: 1_000 },
    );
  });
});

function allSecrets(s: Secrets): number[] {
  return s.mode === 'shared' ? [s.value] : Object.values(s.byPlayer);
}

describe('Leaf Fall (S3)', () => {
  it('never removes a secret, removes one set for all, and stops at minRemaining', () => {
    fc.assert(
      fc.property(round, fc.integer({ min: 1, max: 60 }), (r, count) => {
        const { state, secrets, ctx } = setUp(r);
        let s = state;
        const size = r.width + 1;
        for (let k = 1; k <= 40; k += 1) {
          const events = hooks?.leafFall?.(s, ctx, { index: k, count }) ?? [];
          if (events.length === 0) break;
          expect(events.map((e) => e.audience)).toEqual(['room']);
          const fell = events[0]?.event.type === 'NumbersRemoved' ? events[0].event.numbers : [];
          const leftBefore = size - s.removed.length;
          expect(fell.length).toBe(Math.min(count, leftBefore - 10));
          s = fold(s, events);
        }
        for (const secret of allSecrets(secrets)) expect(s.removed).not.toContain(secret);
        expect(new Set(s.removed).size).toBe(s.removed.length);
        expect(size - s.removed.length).toBeGreaterThanOrEqual(Math.min(size, 10));
      }),
      { numRuns: 100 },
    );
  });

  it('removes the same numbers from the same seed', () => {
    const r = {
      mode: 'shared' as const,
      seed: new Uint8Array(32).fill(9),
      low: 1,
      width: 999,
      hintType: 'parity' as const,
    };
    const one = setUp(r);
    const two = setUp(r);
    expect(hooks?.leafFall?.(one.state, one.ctx, { index: 1, count: 10 })).toEqual(
      hooks?.leafFall?.(two.state, two.ctx, { index: 1, count: 10 }),
    );
  });

  it('draws by rejection in a large range and still spares every secret', () => {
    const r = {
      mode: 'individual' as const,
      seed: new Uint8Array(32).fill(4),
      low: 1,
      width: 999_999,
      hintType: 'parity' as const,
    };
    const { state, secrets, ctx } = setUp(r);
    const events = hooks?.leafFall?.(state, ctx, { index: 1, count: 100 }) ?? [];
    const fell = events[0]?.event.type === 'NumbersRemoved' ? events[0].event.numbers : [];
    expect(fell).toHaveLength(100);
    for (const secret of allSecrets(secrets)) expect(fell).not.toContain(secret);
  });
});

// Every player's range has `size` numbers, holds their secret and lies inside the round's.
function checkWindows(s: GtnState, secrets: Secrets, r: Round, size: number): void {
  for (const id of PLAYERS) {
    const own = s.players[id]?.range ?? { low: 0, high: -2 };
    expect(own.high - own.low + 1).toBe(size);
    const secret = secretOf(secrets, id);
    expect(secret >= own.low && secret <= own.high).toBe(true);
    expect(own.low >= r.low && own.high <= r.low + r.width).toBe(true);
  }
}

describe('halving (S5)', () => {
  it('keeps every secret in a window of half the size, the same size for all', () => {
    fc.assert(
      fc.property(round, (r) => {
        const { state, secrets, ctx } = setUp(r);
        let s = state;
        let size = r.width + 1;
        for (let k = 1; k <= 20; k += 1) {
          const events = hooks?.halving?.(s, ctx, k) ?? [];
          if (events.length === 0) break;
          s = fold(s, events);
          size = Math.ceil(size / 2);
          checkWindows(s, secrets, r, size);
        }
        expect(size).toBeLessThanOrEqual(8);
      }),
      { numRuns: 100 },
    );
  });
});
