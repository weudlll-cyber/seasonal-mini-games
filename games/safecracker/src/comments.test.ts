/**
 * @file   games/safecracker/src/comments.test.ts
 * @module games/safecracker
 * @brief  The safe's comment catalogue: sizes, tone rules, season lines, reproducible picks.
 *
 * Responsibility: every tier and both trend pools have at least 15 lines for every round and a
 *                 few of a season's own; no line has a digit or repeats within its pool or
 *                 across pools; a season's lines appear only in its rounds; the same seed gives
 *                 the same comments, another seed other ones.
 * Depends on:     vitest, @smg/guess-engine (picker, tiers), ./commentLines, ./fakes
 * Spec:           docs/spec/02b-game-safecracker.md §6; docs/spec/02-game-guess-the-number.md §6.3
 */
import { commentPicker, TIERS, type Pool } from '@smg/guess-engine';
import { describe, expect, it } from 'vitest';

import { COMMENT_LINES } from './commentLines.js';
import { input, shared, Table } from './fakes.js';

const POOLS: readonly Pool[] = [...TIERS, 'closer', 'farther'];
const text = (l: string | { readonly text: string }) => (typeof l === 'string' ? l : l.text);

describe('the catalogue', () => {
  it('has at least 15 general lines and some season lines in every pool', () => {
    for (const pool of POOLS) {
      const lines = COMMENT_LINES[pool];
      expect(lines.filter((l) => typeof l === 'string').length, pool).toBeGreaterThanOrEqual(15);
      expect(lines.filter((l) => typeof l !== 'string').length, pool).toBeGreaterThanOrEqual(2);
    }
  });

  it('has no digits and no repeated line anywhere', () => {
    const all = POOLS.flatMap((pool) => COMMENT_LINES[pool].map(text));
    expect(all.filter((t) => /\d/.test(t))).toEqual([]);
    expect(new Set(all).size).toBe(all.length);
  });

  it('offers a season’s own lines only in its rounds', () => {
    const { linesOf } = commentPicker(COMMENT_LINES);
    expect(linesOf('wayOff', 'winter')).toContain('The lock is as frozen as the pond.');
    expect(linesOf('wayOff', 'summer')).not.toContain('The lock is as frozen as the pond.');
  });
});

describe('the round’s comments', () => {
  it('are the same for the same seed and differ for another', () => {
    const lines = (seedByte: number) => {
      const t = new Table(shared('1123'), input('shared', ['a']), seedByte);
      for (const v of ['4567', '1000', '1300', '1320', '1312', '1132', '1124', '1123'])
        t.play('a', v);
      return t.state.players.a?.guesses.map((g) => g.comment?.text);
    };
    expect(lines(1)).toEqual(lines(1));
    expect(lines(1)).not.toEqual(lines(2));
    expect(lines(1)).toHaveLength(8);
  });
});
