/**
 * @file   packages/domain/src/round/specials.test.ts
 * @module domain/round
 * @brief  The platform's handling of the seasonal specials, with the pick game's hooks.
 *
 * Responsibility: Spring Herald fires once at the open, before any guess; Heatwave lowers the
 *                 cooldown by its step at each due time, never below 3 s, keeps running
 *                 cooldowns and stops at the floor (S2); a special stops when its hook returns
 *                 nothing; specials due at one instant run halving, Leaf Fall, Heatwave in one
 *                 step (S7); none fires at or after the end; with the special off or another
 *                 season nothing fires; Frost marks answers, solves and the win with the
 *                 delay and changes neither order nor winner (S4); `nextDue` names the next
 *                 time the round must run.
 * Depends on:     vitest, ./fakes, ./specials
 * Spec:           docs/spec/03-seasonal-specials.md §1, §2; docs/spec/09-testing-strategy.md §3 S1, S2, S4, S7
 */
import { describe, expect, it } from 'vitest';

import { config, fixedRng, pickGame, PickDriver } from './fakes.js';
import { nextDue } from './specials.js';

const base = config().specials;
const fired = (d: PickDriver) =>
  d.log.flatMap((e) => (e.type === 'SpecialFired' ? [`${e.special}#${String(e.index)}`] : []));

describe('Spring Herald', () => {
  it('fires once at the open, before the first guess is accepted', () => {
    const d = new PickDriver({ specialOn: true }, fixedRng(7), 'spring');
    const t = d.start(['a', 'b']);
    d.guess('a', 1, t + 5);
    const types = d.log.map((e) => e.type);
    expect(types.indexOf('SpecialFired')).toBeLessThan(types.indexOf('GuessAccepted'));
    expect(fired(d)).toEqual(['springHerald#0']);
    d.run({ type: 'tick', at: t + 60_000 });
    expect(fired(d)).toEqual(['springHerald#0']);
  });
});

describe('Heatwave', () => {
  const summer = (cooldownMs: number) =>
    new PickDriver(
      {
        specialOn: true,
        cooldownMs,
        specials: { ...base, heatwave: { stepMs: 2_000, intervalMs: 30_000 } },
      },
      fixedRng(7),
      'summer',
    );

  it('lowers the cooldown by its step to the 3 s floor and stops there (S2)', () => {
    const d = summer(8_000);
    const t = d.start(['a']);
    const seen: number[] = [];
    for (let k = 1; k <= 5; k += 1) {
      d.run({ type: 'tick', at: t + k * 30_000 });
      seen.push(d.state.cooldownMs);
    }
    expect(seen).toEqual([6_000, 4_000, 3_000, 3_000, 3_000]);
    expect(fired(d)).toEqual(['heatwave#1', 'heatwave#2', 'heatwave#3']);
    expect(nextDue(d.state, pickGame)).toBe(d.state.endsAt);
  });

  it('keeps a running cooldown and applies the new value from the step on', () => {
    const d = summer(8_000);
    const t = d.start(['a', 'b']);
    const first = d.guess('a', 1, t + 29_000);
    expect(first).toMatchObject({ cooldownEndsAt: t + 37_000 });
    expect(d.guess('a', 2, t + 36_999)).toMatchObject({
      code: 'COOLDOWN_ACTIVE',
      until: t + 37_000,
    });
    expect(d.guess('b', 2, t + 31_000)).toMatchObject({ cooldownEndsAt: t + 37_000 });
  });

  it('never fires in a round that starts at 3 s', () => {
    const d = summer(3_000);
    const t = d.start(['a']);
    d.run({ type: 'tick', at: t + 90_000 });
    expect(fired(d)).toEqual([]);
  });
});

describe('interval specials, running their course', () => {
  it('stop when the hook returns nothing and never fire at or after the end', () => {
    const d = new PickDriver(
      {
        specialOn: true,
        maxDurationMs: 100_000,
        specials: { ...base, leafFall: { intervalMs: 20_000, count: 3 } },
      },
      fixedRng(7),
      'autumn',
    );
    const t = d.start(['a']);
    d.run({ type: 'tick', at: t + 200_000 });
    expect(fired(d)).toEqual(['leafFall#1', 'leafFall#2', 'leafFall#3', 'leafFall#4']);
    expect(d.log.findLast((e) => e.type === 'SpecialFired')).toMatchObject({ last: true });
    const short = new PickDriver(
      {
        specialOn: true,
        maxDurationMs: 40_000,
        specials: { ...base, leafFall: { intervalMs: 20_000, count: 3 } },
      },
      fixedRng(7),
      'autumn',
    );
    const u = short.start(['a']);
    short.run({ type: 'tick', at: u + 50_000 });
    expect(fired(short)).toEqual(['leafFall#1']);
  });
});

describe('interval specials, together and off', () => {
  it('due at one instant run halving, Leaf Fall, Heatwave in one step (S7)', () => {
    const specials = {
      ...base,
      heatwave: { stepMs: 1_000, intervalMs: 20_000 },
      leafFall: { intervalMs: 20_000, count: 2 },
      halvingIntervalMs: 20_000,
    };
    // A summer halving round: halving and Heatwave; an autumn one: halving and Leaf Fall.
    const summer = new PickDriver(
      { specialOn: true, halving: true, specials },
      fixedRng(7),
      'summer',
    );
    const t = summer.start(['a']);
    const step = summer.run({ type: 'tick', at: t + 20_000 });
    expect(step.events.filter((e) => e.type === 'SpecialFired').map((e) => e.special)).toEqual([
      'halving',
      'heatwave',
    ]);
    const autumn = new PickDriver(
      { specialOn: true, halving: true, specials },
      fixedRng(7),
      'autumn',
    );
    const u = autumn.start(['a']);
    autumn.run({ type: 'tick', at: u + 20_000 });
    expect(fired(autumn)).toEqual(['halving#1', 'leafFall#1']);
  });

  it('do nothing with the special off', () => {
    const d = new PickDriver({ specialOn: false }, fixedRng(7), 'autumn');
    const t = d.start(['a']);
    d.run({ type: 'tick', at: t + 300_000 });
    expect(fired(d)).toEqual([]);
    expect(nextDue(d.state, pickGame)).toBe(d.state.endsAt);
  });
});

describe('Frost', () => {
  const play = (season: 'winter' | 'spring') => {
    const d = new PickDriver(
      { specialOn: true, specials: { ...base, frostDelayMs: 3_000 } },
      fixedRng(7),
      season,
    );
    const t = d.start(['a', 'b']);
    d.guess('a', 1, t);
    d.guess('b', 7, t + 10);
    return { d, t };
  };

  it('marks answers, the solve and the win with the delay (S4)', () => {
    const { d, t } = play('winter');
    const held = d.log.flatMap((e) => (e.type === 'Game' ? [e.deliverAt] : []));
    expect(held).toEqual([t + 3_000, t + 3_010]);
    expect(d.log.find((e) => e.type === 'PlayerSolved')).toMatchObject({
      at: t + 10,
      deliverAt: t + 3_010,
    });
    expect(d.log.find((e) => e.type === 'RoundEnded')).toMatchObject({
      at: t + 10,
      deliverAt: t + 3_010,
    });
  });

  it('changes neither the order nor the winner (S4, metamorphic)', () => {
    const frost = play('winter').d;
    const plain = play('spring').d;
    const strip = (d: PickDriver) =>
      d.log
        .filter((e) => e.type === 'GuessAccepted' || e.type === 'PlayerSolved')
        .map((e) => ({ ...e, deliverAt: null }));
    expect(strip(frost)).toEqual(strip(plain));
    expect(frost.state.winner).toBe(plain.state.winner);
  });

  it('is off outside winter', () => {
    const { d } = play('spring');
    expect(d.log.every((e) => !('deliverAt' in e) || e.deliverAt === null)).toBe(true);
  });
});

describe('nextDue', () => {
  it('names the open, then the next special or the end', () => {
    const d = new PickDriver(
      { specialOn: true, specials: { ...base, leafFall: { intervalMs: 20_000, count: 1 } } },
      fixedRng(7),
      'autumn',
    );
    expect(nextDue(d.state, pickGame)).toBeNull();
    const t = d.start(['a']);
    expect(nextDue(d.state, pickGame)).toBe(t);
    d.run({ type: 'tick', at: t });
    expect(nextDue(d.state, pickGame)).toBe(t + 20_000);
    d.run({ type: 'end', at: t + 1, reason: 'host' });
    expect(nextDue(d.state, pickGame)).toBeNull();
  });
});
