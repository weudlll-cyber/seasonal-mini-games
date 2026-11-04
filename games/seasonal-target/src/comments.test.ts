/**
 * @file   games/seasonal-target/src/comments.test.ts
 * @module games/seasonal-target
 * @brief  The comment catalogue: counts, distinctness, no digits, no compass word, the picker.
 *
 * Responsibility: every tier and trend pool has at least 15 distinct lines in every season and
 *                 a few season lines of its own; no line holds a digit or a compass word (in
 *                 `closeness` mode the tier is all a player may learn); a guess's comment is a
 *                 line of its tier's or a trend pool, the same for the same seed.
 * Depends on:     vitest, @smg/guess-engine (Pool), ./commentLines, ./fakes
 * Spec:           docs/spec/02d-game-seasonal-target.md §7; docs/spec/09-testing-strategy.md §4.1
 */
import type { Pool } from '@smg/guess-engine';
import { describe, expect, it } from 'vitest';

import { COMMENT_LINES, stComments } from './commentLines.js';
import { input, Table, targets } from './fakes.js';

const POOLS = Object.keys(COMMENT_LINES) as Pool[];
const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
const COMPASS_WORDS = /\b(north|south|east|west|above|below)\b/i;

describe('comment catalogue', () => {
  it('has every tier and both trend pools', () => {
    expect(POOLS.sort()).toEqual(
      [
        'closer',
        'cold',
        'cool',
        'correct',
        'farther',
        'hot',
        'justMissed',
        'warm',
        'wayOff',
        'burning',
      ].sort(),
    );
  });

  it('has at least 15 distinct lines per pool in every season, and season lines', () => {
    for (const pool of POOLS) {
      for (const season of SEASONS) {
        const lines = stComments.linesOf(pool, season);
        expect(lines.length).toBeGreaterThanOrEqual(15);
        expect(new Set(lines).size).toBe(lines.length);
      }
      expect(COMMENT_LINES[pool].filter((l) => typeof l !== 'string').length).toBeGreaterThan(1);
    }
  });

  it('holds no digit and no word about where the target lies', () => {
    for (const pool of POOLS) {
      for (const line of COMMENT_LINES[pool]) {
        const text = typeof line === 'string' ? line : line.text;
        expect(text).not.toMatch(/\d/);
        expect(text).not.toMatch(COMPASS_WORDS);
        expect(text.length).toBeGreaterThan(3);
      }
    }
  });
});

describe('comment picking', () => {
  it('comments a guess from its tier, the same for the same seed', () => {
    const run = () => {
      const inp = input('shared', ['a']);
      const t = new Table(targets(inp, [{ x: 12, y: 10 }]), inp, 3);
      return [
        { x: 4, y: 14 },
        { x: 13, y: 11 },
        { x: 12, y: 10 },
      ].map((g) => {
        const d = t.play('a', g);
        return d.ok
          ? (d.events[0]?.event as { comment: { tier: string; pool: string } }).comment
          : null;
      });
    };
    const comments = run();
    expect(comments.map((c) => c?.tier)).toEqual(['cold', 'justMissed', 'correct']);
    expect(comments[2]?.pool).toBe('correct');
    expect(run()).toEqual(comments);
  });
});
