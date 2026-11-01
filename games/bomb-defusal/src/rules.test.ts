/**
 * @file   games/bomb-defusal/src/rules.test.ts
 * @module games/bomb-defusal
 * @brief  Validation codes and order, the decision with its explosion, and the settings.
 *
 * Responsibility: `SEQUENCE_INVALID` for a wrong length, an unknown wire, a wire beyond
 *                 `bomb.wires`, a wire twice; `WIRE_HARMLESS`; `ALREADY_GUESSED` only for the
 *                 identical order (a shared start is no repeat), and not with the rule off; the
 *                 order of the checks; the decision's events, `Solved` at `k = cuts`, and the
 *                 explosion: `extraCooldownMs` equal to the penalty exactly on a wrong first
 *                 cut, the same for every player, none with penalty 0; the cooldown end the
 *                 platform computes (cooldown in force at receive time + penalty, G3) and that
 *                 Heatwave's shorter cooldown never shortens it; secrets distinct wires of the
 *                 round, uniform over the orders (chi-square smoke) and the same from the same
 *                 seed; the settings' keys, reading, cross-key problem and no halving.
 * Depends on:     vitest, fast-check, @smg/game-sdk, ./fakes, ./module, ./wires
 * Spec:           docs/spec/02c-game-bomb-defusal.md §3, §4, §5; docs/spec/08-admin-settings.md §3.2;
 *                 docs/spec/09-testing-strategy.md §4.1
 */
import { HEATWAVE_FLOOR_MS, resolveSettings } from '@smg/game-sdk';
import { roundRng } from '@smg/game-sdk/crypto';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { defaultConfig, input, Table } from './fakes.js';
import { bombDefusal } from './module.js';
import { answerOf, wiresOf, type Sequence } from './wires.js';

const SECRET: Sequence = ['red', 'blue', 'yellow', 'white'];
const shared = (value: Sequence = SECRET) => ({ mode: 'shared', value }) as const;
const table = (config = {}) => new Table(shared(), input('shared', ['a', 'b'], config));

describe('validation (02c §4)', () => {
  it('refuses a sequence that is not `cuts` different wires of this round', () => {
    const t = table();
    const invalid: unknown[] = [
      ['red', 'blue', 'yellow'],
      ['red', 'blue', 'yellow', 'white', 'green'],
      ['red', 'blue', 'yellow', 'yellow'],
      ['red', 'blue', 'yellow', 'orange'],
      ['red', 'blue', 'yellow', 'pink'],
      [],
    ];
    for (const value of invalid) {
      expect(bombDefusal.validate(t.state, 'a', { value } as never)).toBe('SEQUENCE_INVALID');
    }
    expect(bombDefusal.validate(t.state, 'nobody', { value: SECRET })).toBe('NOT_IN_ROUND');
  });

  it('refuses a harmless wire, then a repeat of the identical order only', () => {
    const t = table();
    t.state = { ...t.state, harmless: ['green'] };
    expect(t.play('a', ['green', 'blue', 'yellow', 'white'])).toEqual({
      ok: false,
      code: 'WIRE_HARMLESS',
    });
    expect(t.play('a', ['blue', 'red', 'yellow', 'white']).ok).toBe(true);
    expect(t.play('a', ['blue', 'red', 'yellow', 'white'])).toEqual({
      ok: false,
      code: 'ALREADY_GUESSED',
    });
    // A shared start is not a repeat; the other player may cut the same order.
    expect(t.play('a', ['blue', 'red', 'white', 'yellow']).ok).toBe(true);
    expect(t.play('b', ['blue', 'red', 'yellow', 'white']).ok).toBe(true);
  });

  it('checks in the order of 02c §4: invalid before harmless before repeat', () => {
    const t = table();
    expect(t.play('a', ['green', 'blue', 'yellow', 'white']).ok).toBe(true);
    t.state = { ...t.state, harmless: ['green'] };
    expect(t.play('a', ['green', 'blue', 'yellow', 'white'])).toMatchObject({
      code: 'WIRE_HARMLESS',
    });
    expect(t.play('a', ['green', 'green', 'yellow', 'white'])).toMatchObject({
      code: 'SEQUENCE_INVALID',
    });
  });

  it('accepts a repeat when the repeat rule is off', () => {
    const t = table({ repeatGuessRejected: false });
    expect(t.play('a', ['blue', 'red', 'yellow', 'white']).ok).toBe(true);
    expect(t.play('a', ['blue', 'red', 'yellow', 'white']).ok).toBe(true);
  });
});

describe('the decision and the explosion (02c §5)', () => {
  it('answers the guesser, tells the room, and signals the solve', () => {
    const t = table();
    const d = t.play('a', SECRET, 4_000);
    expect(d).toMatchObject({ ok: true, signals: [{ type: 'Solved', playerId: 'a' }] });
    expect(d.ok && d.events[0]).toMatchObject({
      audience: 'player:a',
      feedback: true,
      event: { type: 'FeedbackGiven', feedback: { correct: 4, defused: true } },
    });
    expect(d.ok && 'extraCooldownMs' in d).toBe(false);
  });

  const play = fc.record({
    secret: fc.shuffledSubarray(wiresOf(6), { minLength: 4, maxLength: 4 }),
    guess: fc.shuffledSubarray(wiresOf(6), { minLength: 4, maxLength: 4 }),
    penaltyS: fc.integer({ min: 0, max: 30 }),
    player: fc.constantFrom('a', 'b'),
    receivedAt: fc.integer({ min: 0, max: 1_000_000 }),
    cooldownMs: fc.integer({ min: HEATWAVE_FLOOR_MS, max: 60_000 }),
  });

  it('adds the penalty exactly on a wrong first cut, the same for every player', () => {
    fc.assert(
      fc.property(play, (p) => {
        const t = new Table(
          shared(p.secret),
          input('shared', ['a', 'b'], { explosionPenaltyS: p.penaltyS }),
        );
        const d = t.play(p.player, p.guess, p.receivedAt);
        if (!d.ok) throw new Error('refused');
        const boom = answerOf(p.guess, p.secret).correct === 0;
        const extra = d.extraCooldownMs ?? 0;
        expect(extra).toBe(boom ? p.penaltyS * 1_000 : 0);
        // With 0 s the bomb explodes without any extra wait: no field at all.
        if (extra === 0) expect('extraCooldownMs' in d).toBe(false);
        // G3 with the penalty: the platform adds it to the cooldown in force at receive time;
        // a shorter (Heatwave) cooldown in the step's context never changes the penalty.
        const fresh = new Table(
          shared(p.secret),
          input('shared', ['a', 'b'], { explosionPenaltyS: p.penaltyS }),
        );
        const act = { playerId: p.player, receiveSeq: 1, receivedAt: p.receivedAt };
        const ctx = { now: p.receivedAt, secrets: fresh.secrets, rng: fresh.rng };
        const hot = bombDefusal.decide(
          fresh.state,
          { ...act, action: { value: p.guess } },
          { ...ctx, cooldownMs: p.cooldownMs },
        );
        expect(hot.ok && (hot.extraCooldownMs ?? 0)).toBe(extra);
      }),
      { numRuns: 1_000 },
    );
  });
});

describe('secrets (02c §3)', () => {
  it('are `cuts` different wires of the round, the same from the same seed', () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 32, maxLength: 32 }),
        fc.integer({ min: 4, max: 8 }),
        fc.integer({ min: 3, max: 6 }),
        (seed, wires, cuts) => {
          fc.pre(cuts <= wires);
          const inp = input('individual', ['a', 'b'], { wires, cuts });
          const s = bombDefusal.deriveSecrets(inp, roundRng(seed));
          expect(bombDefusal.deriveSecrets(inp, roundRng(seed))).toEqual(s);
          for (const secret of Object.values(s.mode === 'individual' ? s.byPlayer : {})) {
            expect(secret).toHaveLength(cuts);
            expect(new Set(secret).size).toBe(cuts);
            for (const w of secret) expect(wiresOf(wires)).toContain(w);
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it('are uniform over the orders (chi-square smoke, 4 wires, 3 cuts: 24 orders)', () => {
    const counts = new Map<string, number>();
    const inp = input('shared', ['a'], { wires: 4, cuts: 3 });
    const n = 4_800;
    for (let i = 0; i < n; i += 1) {
      const seed = new Uint8Array(32);
      new DataView(seed.buffer).setUint32(0, i);
      const s = bombDefusal.deriveSecrets(inp, roundRng(seed));
      const key = s.mode === 'shared' ? s.value.join() : '';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(counts.size).toBe(24);
    const expected = n / 24;
    const chi = [...counts.values()].reduce((sum, c) => sum + (c - expected) ** 2 / expected, 0);
    // 23 degrees of freedom: the 0.999 quantile is about 49.7.
    expect(chi).toBeLessThan(49.7);
  });
});

describe('settings (08 §3.2)', () => {
  const { settings } = bombDefusal;

  it('has the game keys with their defaults and reads them', () => {
    const values = resolveSettings(settings.defs, {});
    expect(values).toMatchObject({
      'bomb.wires': 6,
      'bomb.cuts': 4,
      'bomb.explosionPenaltyS': 5,
      'round.feedbackVisibility': 'full',
    });
    expect(settings.read(values)).toEqual(defaultConfig);
  });

  it('refuses more cuts than wires, and never allows halving', () => {
    expect(settings.problem({ ...defaultConfig, wires: 4, cuts: 5 })).toMatch(/cuts/);
    expect(settings.problem({ ...defaultConfig, wires: 5, cuts: 5 })).toBeNull();
    expect(settings.halvingAllowed?.(defaultConfig)).toBe(false);
  });
});
