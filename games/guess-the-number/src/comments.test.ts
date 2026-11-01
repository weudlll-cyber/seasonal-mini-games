/**
 * @file   games/guess-the-number/src/comments.test.ts
 * @module games/guess-the-number
 * @brief  The comment catalogue and the choice of a line: sizes, tone rules, no early repeats.
 *
 * Responsibility: every tier has at least 25 general lines, a correct guess 15, each trend
 *                 direction 10; no line has a digit or names the range, and none repeats in
 *                 its pool; every line keeps to the seasonal theme; a season's own lines
 *                 appear only in its rounds; two guesses of one tier get that tier's lines
 *                 (the Quick Test seed `acorn`, 500 then 502); within a round no
 *                 line of a pool comes back until the pool is used up (T72); the same seed
 *                 gives the same lines, another seed other ones.
 * Depends on:     node:crypto, vitest, @smg/game-sdk/crypto, ./closeness, ./commentLines,
 *                 ./comments, ./fakes, ./module
 * Spec:           docs/spec/02-game-guess-the-number.md §6.3
 */
import { createHash } from 'node:crypto';

import { createDrbg, roundRng, SEED_BYTES } from '@smg/game-sdk/crypto';
import { describe, expect, it } from 'vitest';

import { TIERS } from './closeness.js';
import { COMMENT_LINES, type Pool } from './commentLines.js';
import { linesOf, noteUsed, pickComment, type UsedLines } from './comments.js';
import { input, Table } from './fakes.js';
import { guessTheNumber } from './module.js';

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

  it('keeps to the seasonal theme: no sea, ships, islands, captains or space', () => {
    const off = /\b(sea|ships?|sail\w*|islands?|captain|pirates?|space|planets?|passports?)\b/i;
    const texts = Object.values(COMMENT_LINES).flatMap((lines) =>
      lines.map((l) => (typeof l === 'string' ? l : l.text)),
    );
    expect(texts.filter((t) => off.test(t))).toEqual([]);
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

  it('gives two guesses of one tier lines of that tier, never a trend line (seed acorn)', () => {
    // The Quick Test round of seed `acorn` (winter, shared): the secret is 891, so 500 and 502
    // are both 39 % of the range away, "cold"; the two lines are two draws from the cold pool.
    const rng = roundRng(createHash('sha256').update('smg-quicktest:acorn').digest());
    const roundInput = { ...input('shared', ['a']), season: 'winter' as const };
    const secrets = guessTheNumber.deriveSecrets(roundInput, rng);
    expect(secrets).toEqual({ mode: 'shared', value: 891 });
    const t = new Table(secrets, roundInput);
    for (const v of [500, 502]) t.play('a', v);
    const comments = t.state.players.a?.guesses.map((g) => g.comment);
    expect(comments?.map((c) => [c?.tier, c?.pool])).toEqual([
      ['cold', 'cold'],
      ['cold', 'cold'],
    ]);
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
