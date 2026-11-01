/**
 * @file   games/bomb-defusal/src/commentLines.test.ts
 * @module games/bomb-defusal
 * @brief  The comment catalogue: enough distinct lines per pool, no digits, nothing revealing.
 *
 * Responsibility: at least 15 general lines per tier and per trend pool, every line distinct,
 *                 no digit, no wire colour (a colour could hint at the secret), a few season
 *                 lines per pool; a guess's comment is a line of its tier (or a trend line)
 *                 and reproducible from the round's DRBG.
 * Depends on:     vitest, @smg/guess-engine, ./commentLines, ./fakes
 * Spec:           docs/spec/02c-game-bomb-defusal.md §7; docs/spec/02-game-guess-the-number.md §6.3
 */
import { commentPicker, TIERS, type Pool } from '@smg/guess-engine';
import { describe, expect, it } from 'vitest';

import { COMMENT_LINES } from './commentLines.js';
import { input, Table } from './fakes.js';
import { PALETTE } from './wires.js';

const POOLS: readonly Pool[] = [...TIERS, 'closer', 'farther'];
const text = (line: (typeof COMMENT_LINES)[Pool][number]) =>
  typeof line === 'string' ? line : line.text;

describe('the comment catalogue', () => {
  it('has at least 15 general lines and a season line in every pool', () => {
    for (const pool of POOLS) {
      const lines = COMMENT_LINES[pool];
      expect(lines.filter((l) => typeof l === 'string').length).toBeGreaterThanOrEqual(15);
      expect(lines.some((l) => typeof l !== 'string')).toBe(true);
    }
  });

  it('has distinct lines without digits or wire colours', () => {
    const all = POOLS.flatMap((p) => COMMENT_LINES[p].map(text));
    expect(new Set(all).size).toBe(all.length);
    const colour = new RegExp(`\\b(${PALETTE.join('|')})\\b`, 'i');
    for (const line of all) {
      expect(line).not.toMatch(/\d/);
      expect(line).not.toMatch(colour);
    }
  });

  it('gives each answer a line of its tier, the same from the same seed', () => {
    const picker = commentPicker(COMMENT_LINES);
    const play = () => {
      const t = new Table(
        { mode: 'shared', value: ['red', 'blue', 'yellow', 'white'] },
        input('shared', ['a']),
      );
      t.play('a', ['blue', 'red', 'yellow', 'white']);
      t.play('a', ['red', 'blue', 'green', 'white']);
      return t.state.players.a?.guesses.map((g) => g.comment) ?? [];
    };
    const comments = play();
    expect(comments).toEqual(play());
    const [boom, burning] = comments;
    expect(picker.linesOf('wayOff', 'autumn')).toContain(boom?.text);
    expect(burning?.tier).toBe('burning');
  });
});
