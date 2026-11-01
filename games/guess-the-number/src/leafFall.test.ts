/**
 * @file   games/guess-the-number/src/leafFall.test.ts
 * @module games/guess-the-number
 * @brief  Leaf Fall's candidate set (O37): only numbers still possible from public answers fall.
 *
 * Responsibility: with a shared number and `full` the higher/lower answers cut the range to
 *                 their intersection; an answer Frost still holds does not cut yet; a hidden
 *                 range is cut the same way; `own`, `numbers` and individual mode use the whole
 *                 range without guessed and fallen numbers; no secret ever falls; the falls stop
 *                 when the candidates reach `minRemaining`; the same seed and the same guesses
 *                 give the same drops.
 * Depends on:     vitest, ./fakes, ./leafFall, ./module, ./settings
 * Spec:           docs/spec/03-seasonal-specials.md §2.3; docs/spec/09-testing-strategy.md §3 S3
 */
import { describe, expect, it } from 'vitest';

import { input, Table } from './fakes.js';
import { candidatesOf } from './leafFall.js';
import { guessTheNumber } from './module.js';
import type { GtnConfig } from './settings.js';

const shared = (value: number) => ({ mode: 'shared', value }) as const;

// A shared round of players a and b, its secret 500 in 1–1000 unless the config says else.
function table(config: Partial<GtnConfig> = {}, seedByte = 7): Table {
  return new Table(shared(500), input('shared', ['a', 'b'], config), seedByte);
}

// One fall of `count`, folded into the table's state; the numbers that fell.
function fall(t: Table, index: number, count: number, releasedBefore = Infinity): number[] {
  const ctx = { now: 0, cooldownMs: 3_000, secrets: t.secrets, rng: t.rng };
  const events =
    guessTheNumber.specials?.leafFall?.(t.state, ctx, { index, count, releasedBefore }) ?? [];
  for (const e of events) t.state = guessTheNumber.evolve(t.state, e.event);
  const first = events[0]?.event;
  return first?.type === 'NumbersRemoved' ? [...first.numbers] : [];
}

const between = (low: number, high: number) => (v: number) => v >= low && v <= high;

describe('the candidate set under full visibility', () => {
  it('is the intersection of every higher and lower answer', () => {
    const t = table();
    t.play('a', 300);
    t.play('b', 700);
    t.play('a', 450);
    t.play('b', 600);
    expect(candidatesOf(t.state, Infinity).bounds).toEqual({ low: 451, high: 599 });
    const fell = fall(t, 1, 30);
    expect(fell).toHaveLength(30);
    expect(fell.every(between(451, 599))).toBe(true);
    expect(fell).not.toContain(500);
  });

  it('counts an answer Frost still holds only once it is delivered', () => {
    const t = table();
    t.play('a', 300, 1_000);
    t.play('b', 700, 5_000);
    // At 4 000 the answer to 700 (received at 5 000) is still held; 300's is out.
    expect(candidatesOf(t.state, 4_000).bounds).toEqual({ low: 301, high: 1_000 });
    expect(candidatesOf(t.state, 5_001).bounds).toEqual({ low: 301, high: 699 });
    // A guess received exactly at the cut is still held, as in the views.
    expect(candidatesOf(t.state, 5_000).bounds).toEqual({ low: 301, high: 1_000 });
  });

  it('cuts a hidden range the same way, its own bounds included', () => {
    const t = table({ rangeVisible: false });
    t.play('a', -50);
    t.play('b', 2_000);
    expect(candidatesOf(t.state, Infinity).bounds).toEqual({ low: 1, high: 1_000 });
    t.play('a', 400);
    const fell = fall(t, 1, 50);
    expect(fell.every(between(401, 1_000))).toBe(true);
  });
});

describe('the candidate set without public answers', () => {
  for (const visibility of ['own', 'numbers'] as const) {
    it(`is the whole range without guessed and fallen numbers under ${visibility}`, () => {
      const t = table({ feedbackVisibility: visibility, rangeHigh: 30 });
      t.play('a', 10);
      t.play('b', 20);
      const c = candidatesOf(t.state, Infinity);
      expect(c.bounds).toEqual({ low: 1, high: 30 });
      expect(c.size).toBe(28);
      const fell = fall(t, 1, 100);
      expect(fell).not.toContain(10);
      expect(fell).not.toContain(20);
      // 30 numbers, two guessed, the secret 500 outside: the candidates stop at 10.
      expect(candidatesOf(t.state, Infinity).size).toBe(10);
    });
  }

  it('in individual mode never removes anyone’s secret', () => {
    const secrets = { mode: 'individual', byPlayer: { a: 3, b: 17 } } as const;
    const t = new Table(secrets, input('individual', ['a', 'b'], { rangeHigh: 20 }));
    t.play('a', 10);
    expect(candidatesOf(t.state, Infinity).bounds).toEqual({ low: 1, high: 20 });
    const fell = fall(t, 1, 100);
    expect(fell).toHaveLength(9);
    for (const v of [3, 17, 10]) expect(fell).not.toContain(v);
  });
});

describe('the end of the falls', () => {
  it('never removes the secret and stops at minRemaining candidates', () => {
    const t = table({ autumnMinRemaining: 5 });
    t.play('a', 495);
    t.play('b', 505);
    // 496–504: nine candidates, the secret among them.
    expect(candidatesOf(t.state, Infinity).size).toBe(9);
    const fell = fall(t, 1, 100);
    expect(fell).toHaveLength(4);
    expect(fell).not.toContain(500);
    expect(candidatesOf(t.state, Infinity).size).toBe(5);
    expect(fall(t, 2, 100)).toEqual([]);
  });

  it('removes only the secret’s neighbours down to the secret alone at minRemaining 1', () => {
    const t = table({ autumnMinRemaining: 1 });
    t.play('a', 497);
    t.play('b', 503);
    expect(fall(t, 1, 100).sort((x, y) => x - y)).toEqual([498, 499, 501, 502]);
  });
});

describe('the draw', () => {
  it('gives the same drops from the same seed and the same guesses', () => {
    const play = (t: Table) => {
      t.play('a', 200);
      t.play('b', 800);
      return [fall(t, 1, 10), fall(t, 2, 10)];
    };
    expect(play(table({}, 3))).toEqual(play(table({}, 3)));
  });
});
