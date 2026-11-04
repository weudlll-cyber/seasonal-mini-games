/**
 * @file   games/bomb-defusal/src/specials.test.ts
 * @module games/bomb-defusal
 * @brief  Spring Herald's true first wire, and Leaf Fall's harmless wires by owner decision 42.
 *
 * Responsibility: the hint is the true first wire (one for all in shared mode, each player's
 *                 own in individual mode, to that player only); Leaf Fall marks exactly one
 *                 wire per fall, never a secret wire (in individual mode never one of any
 *                 player's), whether or not anyone cut it, one set for everyone, until every
 *                 such wire is marked; that fall also says that every harmless wire is marked,
 *                 once, and the timer stops; with no such wire nothing is said; the same seed
 *                 marks the same wires.
 * Depends on:     vitest, fast-check, @smg/game-sdk/crypto, @smg/guess-engine, ./fakes,
 *                 ./module, ./state, ./wires
 * Spec:           docs/spec/02c-game-bomb-defusal.md §8.1, §8.3; docs/spec/09-testing-strategy.md §4.1
 */
import type { Emitted } from '@smg/game-sdk';
import { roundRng } from '@smg/game-sdk/crypto';
import { allSecrets } from '@smg/guess-engine';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { input, Table } from './fakes.js';
import { bombDefusal } from './module.js';
import type { BdEvent } from './state.js';
import type { Sequence, Wire } from './wires.js';

const hooks = bombDefusal.specials ?? {};
const PLAYERS = ['a', 'b', 'c'];
const seedOf = (byte: number) => roundRng(new Uint8Array(32).fill(byte));

function fall(t: Table, index: number, releasedBefore = Infinity, seed = t.rng) {
  const ctx = { now: 0, cooldownMs: 3_000, secrets: t.secrets, rng: seed };
  return hooks.leafFall?.(t.state, ctx, { index, count: 10, releasedBefore }) ?? [];
}

describe('Spring Herald (02c §8.1)', () => {
  it('names the shared first wire to the room', () => {
    const t = new Table(
      { mode: 'shared', value: ['blue', 'red', 'green'] },
      input('shared', PLAYERS, { cuts: 3 }),
    );
    const ctx = { now: 0, cooldownMs: 3_000, secrets: t.secrets, rng: t.rng };
    const events = hooks.springHerald?.(t.state, ctx) ?? [];
    expect(events).toEqual([
      { audience: 'room', event: { type: 'HintGiven', playerId: null, wire: 'blue' } },
    ]);
    t.fold(events);
    expect(t.state.hint).toBe('blue');
  });

  it('names each player their own first wire, to that player only', () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 32, maxLength: 32 }), (seed) => {
        const inp = input('individual', PLAYERS);
        const secrets = bombDefusal.deriveSecrets(inp, roundRng(seed));
        const t = new Table(secrets, inp);
        const ctx = { now: 0, cooldownMs: 3_000, secrets, rng: t.rng };
        const events = hooks.springHerald?.(t.state, ctx) ?? [];
        expect(events.map((e) => e.audience)).toEqual(PLAYERS.map((p) => `player:${p}`));
        t.fold(events);
        for (const p of PLAYERS) {
          const own = secrets.mode === 'individual' ? secrets.byPlayer[p] : undefined;
          expect(t.state.players[p]?.hint).toBe(own?.[0]);
        }
        expect(t.state.hint).toBeNull();
      }),
      { numRuns: 200 },
    );
  });
});

const marksOf = (events: readonly Emitted<BdEvent>[]): Wire[] =>
  events.flatMap((e) => (e.event.type === 'WiresHarmless' ? [...e.event.wires] : []));
const typesOf = (events: readonly Emitted<BdEvent>[]): string[] => events.map((e) => e.event.type);

describe('Leaf Fall: fixed cases (O42, 02c §8.3)', () => {
  it('marks one wire per fall, says with the last one that all are marked, then stops', () => {
    // 6 wires, 4 cuts, shared: two harmless wires in all.
    const t = new Table(
      { mode: 'shared', value: ['red', 'blue', 'yellow', 'white'] },
      input('shared', PLAYERS),
    );
    const first = fall(t, 1);
    expect(typesOf(first)).toEqual(['WiresHarmless']);
    expect(marksOf(first)).toHaveLength(1);
    expect(first[0]?.audience).toBe('room');
    t.fold(first);
    const second = fall(t, 2);
    expect(typesOf(second)).toEqual(['WiresHarmless', 'HarmlessOver']);
    expect(second.every((e) => e.audience === 'room')).toBe(true);
    t.fold(second);
    expect([...t.state.harmless].sort()).toEqual(['black', 'green']);
    expect(fall(t, 3)).toEqual([]);
  });

  it('marks a wire whether or not anyone cut it, under every visibility', () => {
    for (const visibility of ['own', 'numbers', 'full'] as const) {
      const t = new Table(
        { mode: 'shared', value: ['red', 'blue', 'yellow', 'white', 'black'] },
        input('shared', PLAYERS, { cuts: 5, feedbackVisibility: visibility }),
      );
      expect(t.play('a', ['red', 'blue', 'green', 'white', 'black']).ok).toBe(true);
      expect(marksOf(fall(t, 1))).toEqual(['green']);
    }
  });

  it('in individual mode marks only wires outside every player’s sequence', () => {
    const byPlayer = {
      a: ['red', 'blue', 'yellow'],
      b: ['yellow', 'green', 'red'],
      c: ['blue', 'red', 'white'],
    } satisfies Record<string, Sequence>;
    const t = new Table(
      { mode: 'individual', byPlayer },
      input('individual', PLAYERS, { cuts: 3 }),
    );
    const first = fall(t, 1);
    expect(marksOf(first)).toEqual(['black']);
    expect(typesOf(first)).toEqual(['WiresHarmless', 'HarmlessOver']);
    t.fold(first);
    expect(fall(t, 2)).toEqual([]);
  });

  it('says nothing when no wire is outside every sequence', () => {
    const byPlayer = {
      a: ['red', 'blue', 'yellow'],
      b: ['green', 'red', 'blue'],
    } satisfies Record<string, Sequence>;
    const t = new Table(
      { mode: 'individual', byPlayer },
      input('individual', ['a', 'b'], { wires: 4, cuts: 3 }),
    );
    expect(fall(t, 1)).toEqual([]);
  });
});

const round = fc.record({
  mode: fc.constantFrom('shared' as const, 'individual' as const),
  seed: fc.uint8Array({ minLength: 32, maxLength: 32 }),
  wires: fc.integer({ min: 4, max: 8 }),
  cuts: fc.integer({ min: 3, max: 6 }),
});

type Round = typeof round extends fc.Arbitrary<infer T> ? T : never;

function setUp(r: Round): Table {
  const inp = input(r.mode, PLAYERS, { wires: r.wires, cuts: r.cuts });
  return new Table(bombDefusal.deriveSecrets(inp, roundRng(r.seed)), inp);
}

// Every fall until the timer stops: one mark each, the last one with the closing line.
function fallsOf(t: Table): Wire[] {
  const marks: Wire[] = [];
  const secretWires = new Set(allSecrets(t.secrets).flat());
  const harmless = t.state.wires.filter((w) => !secretWires.has(w));
  for (let index = 1; index <= 10; index += 1) {
    const events = fall(t, index, Infinity, seedOf(index));
    if (events.length === 0) break;
    const [mark, ...more] = marksOf(events);
    expect(more).toEqual([]);
    expect(mark !== undefined && !secretWires.has(mark)).toBe(true);
    expect(t.state.harmless).not.toContain(mark);
    marks.push(mark as Wire);
    const last = marks.length === harmless.length;
    expect(typesOf(events)).toEqual(last ? ['WiresHarmless', 'HarmlessOver'] : ['WiresHarmless']);
    t.fold(events);
  }
  // The falls end only once every wire outside every sequence is marked.
  expect([...marks].sort()).toEqual([...harmless].sort());
  return marks;
}

describe('Leaf Fall: properties (O42)', () => {
  it('marks every wire outside the sequences, one per fall, the same from the same seed', () => {
    fc.assert(
      fc.property(round, (r) => {
        fc.pre(r.cuts <= r.wires);
        const marks = fallsOf(setUp(r));
        expect(fallsOf(setUp(r))).toEqual(marks);
      }),
      { numRuns: 200 },
    );
  });
});
