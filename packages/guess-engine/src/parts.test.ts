/**
 * @file   packages/guess-engine/src/parts.test.ts
 * @module guess-engine
 * @brief  The engine's parts on their own: secrets, tiers, comments, candidates, closest miss, settings.
 *
 * Responsibility: secrets drawn under their labels and found per player; the tier ladder at
 *                 its thresholds and the trend; comment lines without an early repeat and with
 *                 the season's own lines (property); the public answers of the Leaf Fall rule
 *                 (O37) by mode, visibility and Frost cut; the distinct uniform draw (property);
 *                 the closest miss with ties and without a winner; the shared setting keys.
 * Depends on:     fast-check, vitest, @smg/game-sdk (crypto entry), ./fakes, ./index
 * Spec:           docs/spec/04-software-architecture.md §4.7; docs/spec/09-testing-strategy.md §2
 */
import { createDrbg, roundRng, SEED_BYTES } from '@smg/game-sdk/crypto';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { TOY_LINES, toyInput, ToyTable } from './fakes.js';
import {
  allSecrets,
  closestMissBy,
  COMMENTS_DEF,
  commentPicker,
  deriveSecrets,
  guessedValues,
  pickDistinct,
  publicGuesses,
  readGuessConfig,
  repeatDef,
  secretOf,
  tierByPercent,
  trendOf,
  TREND_DEF,
  visibilityDef,
} from './index.js';

const seed = (n: number) => new Uint8Array(SEED_BYTES).fill(n);

describe('secrets', () => {
  it('are drawn under secret/shared and secret/<player>, and found per player', () => {
    const rng = roundRng(seed(1));
    const draw = (r: { nextUint32: () => number }) => r.nextUint32();
    const one = deriveSecrets(toyInput('shared'), rng, draw);
    expect(one).toEqual({ mode: 'shared', value: rng.child('secret', 'shared').nextUint32() });
    const each = deriveSecrets(toyInput('individual'), rng, draw);
    expect(secretOf(each, 'b')).toBe(rng.child('secret', 'b').nextUint32());
    expect(allSecrets(each)).toHaveLength(3);
    expect(allSecrets(one)).toEqual([secretOf(one, 'anyone')]);
    expect(() => secretOf(each, 'zed')).toThrow(/no secret/);
  });
});

describe('tiers', () => {
  const t = { wayOff: 50, cold: 25, cool: 10, warm: 3, hot: 1 };
  it('place a percent on the ladder, the threshold itself in the closer tier', () => {
    expect([60, 50, 25, 10, 3, 1, 0.5].map((p) => tierByPercent(p, t))).toEqual([
      'wayOff',
      'cold',
      'cool',
      'warm',
      'hot',
      'burning',
      'burning',
    ]);
    expect(trendOf('cold', 'hot')).toBe('closer');
    expect(trendOf('hot', 'cold')).toBe('farther');
    expect(trendOf('warm', 'warm')).toBeNull();
  });
});

describe('comments', () => {
  const picker = commentPicker(TOY_LINES);
  it('use a line again only once its pool is used up, the season’s own lines included', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 255 }), (n) => {
        const rng = createDrbg(seed(n), 'test');
        let used = {};
        const seen: number[] = [];
        for (let i = 0; i < 3; i += 1) {
          const c = picker.pickComment(
            'cold',
            null,
            { used, season: 'spring', trendPercent: 0 },
            rng,
          );
          seen.push(c.index);
          used = picker.noteUsed(used, c, 'spring');
        }
        expect(new Set(seen).size).toBe(3);
        expect(picker.linesOf('cold', 'spring')).toHaveLength(3);
        expect(picker.linesOf('cold', 'winter')).toHaveLength(2);
      }),
      { numRuns: 200 },
    );
  });

  it('give a trend line when the tier changed and the dice say so', () => {
    const rng = createDrbg(seed(9), 'test');
    const c = picker.pickComment(
      'hot',
      'cold',
      { used: {}, season: 'winter', trendPercent: 100 },
      rng,
    );
    expect(c).toMatchObject({ tier: 'hot', pool: 'closer' });
    const found = picker.pickComment(
      'correct',
      'cold',
      { used: {}, season: 'winter', trendPercent: 100 },
      rng,
    );
    expect(found.pool).toBe('correct');
  });
});

describe('the Leaf Fall candidates (O37)', () => {
  it('use public answers only with a shared secret and full, delivered before the cut', () => {
    const t = new ToyTable(toyInput('shared'), { mode: 'shared', value: 10 });
    t.play('a', 4, 1_000);
    t.play('b', 15, 5_000);
    expect(publicGuesses(t.state, 3_000).map((g) => g.value)).toEqual([4]);
    expect(publicGuesses(t.state, 9_000).map((g) => g.value)).toEqual([4, 15]);
    expect(guessedValues(t.state)).toEqual([4, 15]);
    for (const config of [
      { feedbackVisibility: 'own' },
      { feedbackVisibility: 'numbers' },
    ] as const) {
      const other = new ToyTable(toyInput('shared', config), { mode: 'shared', value: 10 });
      other.play('a', 4, 1_000);
      expect(publicGuesses(other.state, 9_000)).toEqual([]);
    }
    const own = new ToyTable(toyInput('individual'), {
      mode: 'individual',
      byPlayer: { a: 1, b: 2, c: 3 },
    });
    own.play('a', 4, 1_000);
    expect(publicGuesses(own.state, 9_000)).toEqual([]);
  });

  it('draw distinct values of the pool, as many as asked', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer(), { minLength: 1, maxLength: 40 }),
        fc.nat(255),
        (pool, n) => {
          const k = n % (pool.length + 1);
          const picked = pickDistinct([...pool], k, createDrbg(seed((n % 255) + 1), 'test'));
          expect(picked).toHaveLength(k);
          expect(new Set(picked).size).toBe(k);
          for (const v of picked) expect(pool).toContain(v);
        },
      ),
    );
  });
});

describe('the closest miss', () => {
  const hit = (f: string) => f === 'hit';
  it('is the best wrong guess of anyone but the winner, the earlier on a tie', () => {
    const t = new ToyTable(toyInput('shared', { repeatGuessRejected: false }), {
      mode: 'shared',
      value: 10,
    });
    t.play('a', 7);
    t.play('b', 13 - 1);
    t.play('c', 8);
    t.play('a', 10);
    t.play('b', 10);
    const miss = closestMissBy(t.state, hit, (g) => Math.abs(g.value - 10));
    // b's 12 and c's 8 are both 2 away: b's came first; a won, b's later hit is not a miss.
    expect(miss).toEqual({ playerId: 'b', value: 12, distance: 2 });
  });

  it('is the closest guess without a winner (time up), none without another wrong guess', () => {
    const t = new ToyTable(toyInput('shared'), { mode: 'shared', value: 10 });
    t.play('a', 7);
    // No winner: the round's closest guess, over every player (T145).
    expect(closestMissBy(t.state, hit, () => 0)).toEqual({ playerId: 'a', value: 7, distance: 0 });
    t.play('a', 10);
    expect(closestMissBy(t.state, hit, () => 0)).toBeNull();
  });
});

describe('the shared settings', () => {
  it('define the four keys once and read them', () => {
    const defs = [visibilityDef('v'), COMMENTS_DEF, TREND_DEF, repeatDef('r')];
    expect(defs.map((d) => d.key)).toEqual([
      'round.feedbackVisibility',
      'round.comments',
      'comments.trendPercent',
      'round.repeatGuessRejected',
    ]);
    const values = Object.fromEntries(defs.map((d) => [d.key, d.default]));
    expect(readGuessConfig(values)).toEqual({
      feedbackVisibility: 'full',
      comments: true,
      trendPercent: 33,
      repeatGuessRejected: true,
    });
  });
});
