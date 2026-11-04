/**
 * @file   games/seasonal-target/src/spring.test.ts
 * @module games/seasonal-target
 * @brief  Spring Herald's two quarters (O61).
 *
 * Responsibility: the quarter for even and odd map sizes; the shared pair to the room and each
 *                 player's own pair to that player with only a line to the room; every pair
 *                 holds its target's quarter and one other, always in the fixed quarter order
 *                 (the target's first and second about as often), the decoy from the round's
 *                 randomness under `spring/<shared|playerId>`, each of the three others
 *                 drawn, the same for the same seed.
 * Depends on:     vitest, @smg/game-sdk (crypto), ./fakes, ./module, ./specials, ./state
 * Spec:           docs/spec/02d-game-seasonal-target.md §8.1; docs/spec/05-security-threat-model.md §3
 */
import { roundRng, SEED_BYTES } from '@smg/game-sdk/crypto';
import { describe, expect, it } from 'vitest';

import { input, Table, targets } from './fakes.js';
import { seasonalTarget } from './module.js';
import { quarterOf, quarterPair } from './specials.js';
import { QUARTER_NAMES, type QuarterPair } from './state.js';

const hooks = seasonalTarget.specials;
const PLAYERS = ['a', 'b', 'c'];
const MAP = { width: 20, height: 20 };
const names = (pair: QuarterPair | null | undefined) => pair?.map((q) => q.name);
const seed = (k: number) => roundRng(new Uint8Array(SEED_BYTES).fill(k));

describe('the quarters', () => {
  it('are the west and north halves rounded up', () => {
    const odd = { width: 21, height: 21 };
    expect(quarterOf(odd, { x: 11, y: 11 })).toEqual({
      name: 'north-west',
      left: 1,
      right: 11,
      top: 1,
      bottom: 11,
    });
    expect(quarterOf(odd, { x: 12, y: 12 })).toEqual({
      name: 'south-east',
      left: 12,
      right: 21,
      top: 12,
      bottom: 21,
    });
    const even = { width: 50, height: 20 };
    expect(quarterOf(even, { x: 26, y: 10 }).name).toBe('north-east');
    expect(quarterOf(even, { x: 25, y: 11 })).toMatchObject({ name: 'south-west', right: 25 });
  });
});

describe('Spring Herald', () => {
  it("gives the room the shared pair, the target's quarter in it", () => {
    const inp = input('shared', PLAYERS);
    const t = new Table(targets(inp, [{ x: 15, y: 5 }]), inp);
    const events = t.fold(hooks?.springHerald?.(t.state, t.ctx) ?? []);
    expect(events.map((e) => e.audience)).toEqual(['room']);
    expect(names(t.state.hint)).toContain('north-east');
    expect(t.state.hint).toEqual(
      quarterPair(MAP, { x: 15, y: 5 }, t.rng.child('spring', 'shared')),
    );
  });

  it('gives each player their own pair, and the room only a line', () => {
    const inp = input('individual', PLAYERS);
    const cells = [
      { x: 1, y: 1 },
      { x: 20, y: 20 },
      { x: 1, y: 20 },
    ];
    const t = new Table(targets(inp, cells), inp);
    const events = t.fold(hooks?.springHerald?.(t.state, t.ctx) ?? []);
    expect(events.map((e) => e.audience)).toEqual(['player:a', 'player:b', 'player:c', 'room']);
    expect(events[3]?.event).toEqual({ type: 'HintGiven', playerId: null, quarters: null });
    expect(t.state.hint).toBeNull();
    expect(names(t.state.players['b']?.hint)).toContain('south-east');
    expect(names(t.state.players['c']?.hint)).toContain('south-west');
    expect(t.state.players['b']?.hint).toEqual(
      quarterPair(MAP, { x: 20, y: 20 }, t.rng.child('spring', 'b')),
    );
  });
});

describe('the pair never tells the target (O61)', () => {
  const pairs = Array.from({ length: 300 }, (_, k) => ({
    target: quarterOf(MAP, { x: 3, y: 17 }).name,
    pair: quarterPair(MAP, { x: 3, y: 17 }, seed(k % 256).child('spring', String(k))),
  }));

  it('holds the target and one other, always in the fixed order', () => {
    for (const { target, pair } of pairs) {
      const [one, two] = names(pair) ?? [];
      expect([one, two]).toContain(target);
      expect(one).not.toBe(two);
      expect(QUARTER_NAMES.indexOf(one ?? 'north-west')).toBeLessThan(
        QUARTER_NAMES.indexOf(two ?? 'north-west'),
      );
    }
  });

  it("draws each other quarter as the decoy, so the target's place varies", () => {
    const decoys = new Set(
      pairs.flatMap(({ target, pair }) => names(pair)?.filter((n) => n !== target)),
    );
    expect([...decoys].sort()).toEqual(['north-east', 'north-west', 'south-east']);
    // South-west is third in the order: before the south-east decoy, after the other two.
    const first = pairs.filter(({ target, pair }) => pair[0].name === target).length;
    expect(first).toBeGreaterThan(50);
    expect(first).toBeLessThan(150);
  });

  it('is the same for the same seed', () => {
    const one = quarterPair(MAP, { x: 9, y: 9 }, seed(5).child('spring', 'shared'));
    expect(quarterPair(MAP, { x: 9, y: 9 }, seed(5).child('spring', 'shared'))).toEqual(one);
  });
});
