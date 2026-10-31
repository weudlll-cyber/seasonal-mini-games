/**
 * @file   games/guess-the-number/src/comments.test.ts
 * @module games/guess-the-number
 * @brief  The comment catalogue and the choice of a line: sizes, tone rules, no early repeats.
 *
 * Responsibility: every tier has at least 25 general lines, a correct guess 15, each trend
 *                 direction 10; no line has a digit or names the range, and none repeats in
 *                 its pool; a season's own lines appear only in its rounds; within a round no
 *                 line of a pool comes back until the pool is used up (T72); the same seed
 *                 gives the same lines, another seed other ones.
 * Depends on:     vitest, @smg/game-sdk/crypto, ./commentLines, ./comments, ./fakes
 * Spec:           docs/spec/02-game-guess-the-number.md §6.3
 */
import { createDrbg, SEED_BYTES } from '@smg/game-sdk/crypto';
import { describe, expect, it } from 'vitest';

import { TIERS } from './closeness.js';
import { COMMENT_LINES, type Pool } from './commentLines.js';
import { linesOf, noteUsed, pickComment, type UsedLines } from './comments.js';
import { input, Table } from './fakes.js';

const general = (pool: Pool) => COMMENT_LINES[pool].filter((l) => typeof l === 'string');

describe('the catalogue', () => {
  it('has enough lines in every pool', () => {
    for (const tier of TIERS) {
      expect(general(tier).length, tier).toBeGreaterThanOrEqual(tier === 'correct' ? 15 : 25);
    }
    expect(general('closer').length).toBeGreaterThanOrEqual(10);
    expect(general('farther').length).toBeGreaterThanOrEqual(10);
  });

  it('has no digits, no word about the range, and no repeats within a pool', () => {
    for (const [pool, lines] of Object.entries(COMMENT_LINES)) {
      const texts = lines.map((l) => (typeof l === 'string' ? l : l.text));
      expect(
        texts.filter((t) => /\d|range/i.test(t)),
        pool,
      ).toEqual([]);
      expect(new Set(texts).size, pool).toBe(texts.length);
    }
  });

  it('offers a season’s own lines only in its rounds', () => {
    expect(linesOf('correct', 'winter')).toContain('Found it — snow problem!');
    expect(linesOf('correct', 'summer')).not.toContain('Found it — snow problem!');
  });
});

describe('choosing a line', () => {
  it('repeats no line of a pool until the pool is used up', () => {
    const rng = createDrbg(new Uint8Array(SEED_BYTES).fill(3), 'test');
    const size = linesOf('warm', 'spring').length;
    let used: UsedLines = {};
    const seen: string[] = [];
    for (let k = 0; k < size; k += 1) {
      const c = pickComment('warm', null, { used, season: 'spring', trendPercent: 33 }, rng);
      seen.push(c.text);
      used = noteUsed(used, c, 'spring');
    }
    expect(new Set(seen).size).toBe(size);
    // The pool is full: the next pick starts it over.
    const next = pickComment('warm', null, { used, season: 'spring', trendPercent: 33 }, rng);
    expect(noteUsed(used, next, 'spring').warm).toEqual([next.index]);
  });

  it('gives the same lines for the same seed and other lines for another', () => {
    const lines = (seedByte: number) => {
      const t = new Table({ mode: 'shared', value: 700 }, input('shared', ['a']), seedByte);
      for (const v of [100, 200, 300, 400, 500, 600, 650, 690]) t.play('a', v);
      return t.state.players.a?.guesses.map((g) => g.comment?.text);
    };
    expect(lines(1)).toEqual(lines(1));
    expect(lines(1)).not.toEqual(lines(2));
  });

  it('may answer a change of tier with a trend line, never a found number', () => {
    const rng = createDrbg(new Uint8Array(SEED_BYTES).fill(5), 'trend');
    const round = { used: {}, season: 'autumn', trendPercent: 33 } as const;
    const pools = new Set(
      Array.from({ length: 60 }, () => pickComment('warm', 'cold', round, rng).pool),
    );
    expect([...pools].sort()).toEqual(['closer', 'warm']);
    expect(pickComment('correct', 'cold', round, rng).pool).toBe('correct');
    expect(pickComment('warm', 'warm', round, rng).pool).toBe('warm');
    const never = { ...round, trendPercent: 0 };
    expect(Array.from({ length: 30 }, () => pickComment('warm', 'cold', never, rng).pool)).toEqual(
      Array.from({ length: 30 }, () => 'warm'),
    );
  });
});
