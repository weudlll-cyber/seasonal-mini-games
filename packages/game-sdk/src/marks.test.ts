/**
 * @file   packages/game-sdk/src/marks.test.ts
 * @module game-sdk
 * @brief  Player marks for rounds of 20 and more (O62): tags, and 24 colour-shape combinations.
 *
 * Responsibility: the viewer's tag "you", a player's "p3", a bot's "b7"; 24 distinct
 *                 combinations of eight colours and three shapes in join order, none repeated
 *                 before the 25th player, colours first.
 * Depends on:     vitest, ./marks
 * Spec:           docs/spec/02d-game-seasonal-target.md §11
 */
import { describe, expect, it } from 'vitest';

import { MARK_COLORS, MARK_SHAPES, markAt, marksOf, tagOf } from './marks.js';

describe('player tags', () => {
  it('names the viewer "you", a player by number, a bot shortly', () => {
    expect(tagOf('p3', 'p3')).toBe('you');
    expect(tagOf('p12', 'p3')).toBe('p12');
    expect(tagOf('bot-07', null)).toBe('b7');
    expect(tagOf('bot-20', 'p1')).toBe('b20');
  });
});

describe('colour and shape', () => {
  it('gives 24 distinct combinations, none repeated before the 25th player', () => {
    expect(MARK_COLORS).toHaveLength(8);
    expect(MARK_SHAPES).toEqual(['dot', 'ring', 'square']);
    const combos = Array.from({ length: 24 }, (_, i) => {
      const m = markAt(i);
      return `${m.color}/${m.shape}`;
    });
    expect(new Set(combos).size).toBe(24);
    expect(markAt(24)).toEqual(markAt(0));
    // Colours first: the first eight players all have a filled dot.
    expect(combos.slice(0, 8).every((c) => c.endsWith('/dot'))).toBe(true);
  });

  it('hands them out in join order, the viewer tagged "you"', () => {
    const keys = [
      'p1',
      ...Array.from({ length: 21 }, (_, i) => `bot-${String(i + 1).padStart(2, '0')}`),
    ];
    const marks = marksOf(keys, 'p1');
    expect(marks['p1']).toEqual({ tag: 'you', ...markAt(0) });
    expect(marks['bot-21']).toEqual({ tag: 'b21', ...markAt(21) });
    expect(new Set(Object.values(marks).map((m) => m.tag)).size).toBe(22);
  });
});
