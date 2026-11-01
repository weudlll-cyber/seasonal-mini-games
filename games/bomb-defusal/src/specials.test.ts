/**
 * @file   games/bomb-defusal/src/specials.test.ts
 * @module games/bomb-defusal
 * @brief  Spring Herald's true first wire, and Leaf Fall's harmless wires by owner decision 37.
 *
 * Responsibility: the hint is the true first wire (one for all in shared mode, each player's
 *                 own in individual mode, to that player only); Leaf Fall never marks a secret
 *                 wire, keeps one set for everyone, marks `wiresPerFall` or fewer only when the
 *                 candidates run out, under shared `full` never a wire the delivered answers
 *                 prove harmless (a Frost-held answer does not count yet), outside it never a
 *                 wire of an accepted sequence; "no more harmless wires" comes once, then the
 *                 timer stops; the same seed and sequences mark the same wires; the proof rule
 *                 is sound (a proven wire is in no secret).
 * Depends on:     vitest, fast-check, @smg/game-sdk/crypto, @smg/guess-engine, ./fakes,
 *                 ./leafFall, ./module, ./state, ./wires
 * Spec:           docs/spec/02c-game-bomb-defusal.md §8.1, §8.3; docs/spec/09-testing-strategy.md §4.1
 */
import type { Emitted } from '@smg/game-sdk';
import { roundRng } from '@smg/game-sdk/crypto';
import { allSecrets, guessedValues, publicGuesses, type Secrets } from '@smg/guess-engine';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { input, Table } from './fakes.js';
import { provenHarmless } from './leafFall.js';
import { bombDefusal } from './module.js';
import type { BdEvent, BdState } from './state.js';
import { answerOf, wiresOf, type Sequence, type Wire } from './wires.js';

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

describe('Leaf Fall: fixed cases (02c §8.3)', () => {
  it('marks the harmless wires one by one, says once that none are left, then stops', () => {
    // 6 wires, 4 cuts, shared: two harmless wires in all.
    const t = new Table(
      { mode: 'shared', value: ['red', 'blue', 'yellow', 'white'] },
      input('shared', PLAYERS),
    );
    const first = fall(t, 1);
    expect(first).toHaveLength(1);
    expect(first[0]?.audience).toBe('room');
    t.fold(first);
    const second = fall(t, 2);
    t.fold(second);
    expect([...t.state.harmless].sort()).toEqual(['black', 'green']);
    const over = fall(t, 3);
    expect(over).toEqual([{ audience: 'room', event: { type: 'HarmlessOver', index: 3 } }]);
    t.fold(over);
    expect(fall(t, 4)).toEqual([]);
  });

  it('marks only as many as are left on the last fall', () => {
    const t = new Table(
      { mode: 'shared', value: ['red', 'blue', 'yellow', 'white', 'black'] },
      input('shared', PLAYERS, { cuts: 5, wiresPerFall: 2 }),
    );
    expect(marksOf(fall(t, 1))).toEqual(['green']);
  });

  it('under shared `full` skips a wire a delivered answer proves harmless, not a held one', () => {
    const config = { wires: 4, cuts: 3 };
    const t = new Table(
      { mode: 'shared', value: ['red', 'blue', 'yellow'] },
      input('shared', PLAYERS, config),
    );
    // "first 2 right" with green third: green is known not to be at any place.
    expect(t.play('a', ['red', 'blue', 'green'], 5_000).ok).toBe(true);
    expect(fall(t, 1, 6_000)[0]?.event.type).toBe('HarmlessOver');
    expect(marksOf(fall(t, 1, 5_000))).toEqual(['green']);
  });
});

describe('Leaf Fall: candidates by visibility (02c §8.3)', () => {
  it('outside shared `full` skips every wire of an accepted sequence', () => {
    for (const [mode, visibility] of [
      ['shared', 'numbers'],
      ['shared', 'own'],
      ['individual', 'full'],
    ] as const) {
      const value: Sequence = ['red', 'blue', 'yellow', 'white'];
      const secrets: Secrets<Sequence> =
        mode === 'shared' ? { mode, value } : { mode, byPlayer: { a: value, b: value, c: value } };
      const t = new Table(secrets, input(mode, PLAYERS, { feedbackVisibility: visibility }));
      expect(t.play('a', ['green', 'blue', 'yellow', 'white']).ok).toBe(true);
      expect(marksOf(fall(t, 1))).toEqual(['black']);
    }
  });

  it('proves a wire harmless only when every place is ruled out', () => {
    const g = (value: Sequence, correct: number) => ({
      receiveSeq: 1,
      receivedAt: 0,
      value,
      feedback: { correct, defused: false },
      comment: null,
    });
    expect(provenHarmless([g(['red', 'blue', 'green'], 2)], 'green', 3)).toBe(true);
    expect(provenHarmless([g(['red', 'blue', 'green'], 1)], 'green', 3)).toBe(false);
    const both = [g(['red', 'green', 'blue'], 1), g(['red', 'blue', 'green'], 2)];
    expect(provenHarmless(both, 'green', 3)).toBe(true);
    expect(provenHarmless([], 'green', 3)).toBe(false);
  });
});

const round = fc.record({
  mode: fc.constantFrom('shared' as const, 'individual' as const),
  visibility: fc.constantFrom('own' as const, 'numbers' as const, 'full' as const),
  seed: fc.uint8Array({ minLength: 32, maxLength: 32 }),
  wires: fc.integer({ min: 4, max: 8 }),
  cuts: fc.integer({ min: 3, max: 6 }),
  wiresPerFall: fc.integer({ min: 1, max: 2 }),
  plays: fc.array(
    fc.record({
      p: fc.integer({ min: 0, max: 2 }),
      order: fc.array(fc.nat(), { minLength: 8, maxLength: 8 }),
    }),
    { maxLength: 8 },
  ),
  releasedBefore: fc.integer({ min: 0, max: 10_000 }),
});

// A sequence of `cuts` different wires picked by the given numbers.
function sequenceFrom(order: readonly number[], pool: Wire[], cuts: number): Sequence {
  const rest = [...pool];
  return order.slice(0, cuts).map((n) => rest.splice(n % rest.length, 1)[0] as Wire);
}

type Round = typeof round extends fc.Arbitrary<infer T> ? T : never;

function setUp(r: Round): Table {
  const config = {
    wires: r.wires,
    cuts: r.cuts,
    wiresPerFall: r.wiresPerFall,
    feedbackVisibility: r.visibility,
  };
  const inp = input(r.mode, PLAYERS, config);
  const t = new Table(bombDefusal.deriveSecrets(inp, roundRng(r.seed)), inp);
  r.plays.forEach((x, k) =>
    t.play(PLAYERS[x.p] ?? 'a', sequenceFrom(x.order, wiresOf(r.wires), r.cuts), k * 1_500),
  );
  return t;
}

// Every fall until the timer stops: the marks of each, checked against the state before it.
function fallsOf(t: Table, r: Round): Wire[][] {
  const all: Wire[][] = [];
  const secretWires = new Set(allSecrets(t.secrets).flat());
  const open = r.mode === 'shared' && r.visibility === 'full';
  for (let index = 1; index <= 10; index += 1) {
    const before: BdState = t.state;
    const events = fall(t, index, r.releasedBefore, seedOf(index));
    if (events.length === 0) break;
    expect(events.every((e) => e.audience === 'room')).toBe(true);
    const marks = marksOf(events);
    const answers = publicGuesses(before, r.releasedBefore);
    const guessed = new Set(guessedValues(before).flat());
    for (const w of marks) {
      expect(secretWires.has(w)).toBe(false);
      expect(before.harmless).not.toContain(w);
      if (open) expect(provenHarmless(answers, w, r.cuts)).toBe(false);
      else expect(guessed.has(w)).toBe(false);
    }
    expect(marks.length).toBeLessThanOrEqual(r.wiresPerFall);
    t.fold(events);
    if (marks.length === 0) {
      // "No more harmless wires" once; the next call stops the timer.
      expect(events.map((e) => e.event.type)).toEqual(['HarmlessOver']);
      expect(fall(t, index + 1, r.releasedBefore)).toEqual([]);
      break;
    }
    // Fewer than `wiresPerFall` only when the candidates ran out: the next fall says so.
    if (marks.length < r.wiresPerFall) {
      const next = fall(t, index + 1, r.releasedBefore, seedOf(index + 1));
      expect(next.map((e) => e.event.type)).toEqual(['HarmlessOver']);
    }
    all.push(marks);
  }
  return all;
}

describe('Leaf Fall: properties (O37)', () => {
  it('marks only candidates, one set for all, and stops once with a row', () => {
    fc.assert(
      fc.property(round, (r) => {
        fc.pre(r.cuts <= r.wires);
        const t = setUp(r);
        const marks = fallsOf(t, r);
        expect(new Set(marks.flat()).size).toBe(marks.flat().length);
        expect(fallsOf(setUp(r), r)).toEqual(marks);
      }),
      { numRuns: 100 },
    );
  });

  it('only proves wires that are in no secret', () => {
    fc.assert(
      fc.property(round, (r) => {
        fc.pre(r.cuts <= r.wires);
        const secret = sequenceFrom(
          r.plays[0]?.order ?? [0, 0, 0, 0, 0, 0],
          wiresOf(r.wires),
          r.cuts,
        );
        const answers = r.plays.map((x, k) => {
          const value = sequenceFrom(x.order, wiresOf(r.wires), r.cuts);
          return {
            receiveSeq: k,
            receivedAt: k,
            value,
            feedback: answerOf(value, secret),
            comment: null,
          };
        });
        for (const w of wiresOf(r.wires)) {
          if (provenHarmless(answers, w, r.cuts)) expect(secret).not.toContain(w);
        }
      }),
      { numRuns: 1_000 },
    );
  });
});
