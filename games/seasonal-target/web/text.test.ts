/**
 * @file   games/seasonal-target/web/text.test.ts
 * @module games/seasonal-target/web
 * @brief  The game's words: answers, rows, event lines, banners, closest miss, intro, rules.
 *
 * Responsibility: answers long and short in all three modes with their tones from the
 *                 server's tier; the views become rows with the cell as text and the answer in
 *                 words, own rows pending under Frost, hidden cells "guessed"; every room event
 *                 has its line (Leaf Fall as the special's row, sizes in tiles), guesses none;
 *                 the banners; the closest miss touching or not; the intro line naming the
 *                 grid; the special's sentence for Spring and Autumn only.
 * Depends on:     vitest, ./text, ./words
 * Spec:           docs/spec/02d-game-seasonal-target.md §2, §5, §6, §8, §9
 */
import { describe, expect, it } from 'vitest';

import { stText } from './text.js';
import { areaText, longAnswer, shortAnswer, toneOf } from './words.js';

const ne = { kind: 'direction', distance: 9, direction: 'NE', tier: 'cold' } as const;
const nine = { kind: 'distance', distance: 9, tier: 'cold' } as const;

describe('answers', () => {
  it('words direction, distance, closeness and correct answers', () => {
    expect(longAnswer(nine)).toBe('9 cells away');
    expect(longAnswer({ kind: 'distance', distance: 1, tier: 'justMissed' })).toBe('1 cell away');
    expect(shortAnswer(nine)).toBe('9 away');
    // The tone follows the server's tier, like the tile's colour.
    expect(toneOf({ kind: 'distance', distance: 3, tier: 'hot' })).toBe('close');
    expect(toneOf({ kind: 'distance', distance: 4, tier: 'warm' })).toBe('far');
    expect(longAnswer(ne)).toBe('9 cells away, to the north-east');
    expect(shortAnswer(ne)).toBe('9 away, NE ↗');
    expect(longAnswer({ kind: 'direction', distance: 1, direction: 'N', tier: 'justMissed' })).toBe(
      '1 cell away, to the north',
    );
    expect(longAnswer({ kind: 'closeness', tier: 'warm' })).toBe('Warm');
    expect(shortAnswer({ kind: 'closeness', tier: 'justMissed' })).toBe(
      'Just missed — right next to it',
    );
    expect(longAnswer({ kind: 'correct' })).toBe('Target found!');
    expect(toneOf({ kind: 'correct' })).toBe('correct');
    expect(toneOf(ne)).toBe('far');
    expect(toneOf({ kind: 'direction', distance: 2, direction: 'S', tier: 'burning' })).toBe(
      'close',
    );
    expect(toneOf({ kind: 'closeness', tier: 'hot' })).toBe('close');
    expect(toneOf({ kind: 'closeness', tier: 'cold' })).toBe('far');
    expect(areaText({ left: 5, right: 5, top: 1, bottom: 50 })).toBe('columns 5, rows 1–50');
  });
});

describe('rows', () => {
  it('turns a player view into rows, own ones pending while held', () => {
    const seen = { tier: null, comment: null };
    const view = {
      guesses: [
        { receiveSeq: 1, receivedAt: 10, value: { x: 12, y: 34 }, feedback: ne, ...seen },
        { receiveSeq: 3, receivedAt: 30, value: { x: 1, y: 1 }, feedback: null, ...seen },
      ],
      log: [{ receiveSeq: 2, receivedAt: 20, playerId: 'b', value: null, feedback: null, ...seen }],
    };
    const rows = stText.guesses(view);
    expect(rows[0]).toMatchObject({
      key: '1',
      playerId: null,
      value: null,
      feedback: null,
      text: '(12, 34)',
      answer: { text: '9 away, NE ↗', tone: 'far' },
      pending: false,
    });
    expect(rows[1]).toMatchObject({ text: '(1, 1)', answer: null, pending: true });
    expect(rows[2]).toMatchObject({ playerId: 'b', text: null, answer: null, pending: false });
  });
});

describe('event lines and banners', () => {
  const area = { left: 13, right: 37, top: 1, bottom: 50 };
  const quarter = { name: 'north-west', left: 1, right: 25, top: 1, bottom: 25 } as const;

  it('words every room event, and no guess', () => {
    const fell = {
      type: 'CellsFell',
      index: 1,
      cells: [
        { x: 1, y: 1 },
        { x: 2, y: 1 },
      ],
    };
    expect(stText.event(fell, {})).toEqual({
      text: 'Leaf Fall: 2 cells fell.',
      playerId: null,
      special: true,
    });
    expect(stText.event({ type: 'HintGiven', playerId: null, quarter }, {})?.text).toBe(
      'Spring Herald: the target is in the north-west quarter (columns 1–25, rows 1–25).',
    );
    expect(stText.event({ type: 'HintGiven', playerId: null, quarter: null }, {})?.text).toBe(
      'Spring Herald: everyone received a hint.',
    );
    expect(stText.event({ type: 'HintGiven', playerId: 'a', quarter }, {})).toBeNull();
    const halved = { type: 'AreaHalved', index: 1, playerId: null, area, width: 25, height: 50 };
    expect(stText.event(halved, {})?.text).toBe(
      'Halving: the target area is now columns 13–37, rows 1–50.',
    );
    expect(stText.event({ ...halved, playerId: 'a' }, {})?.text).toContain('your target area');
    expect(stText.event({ ...halved, area: null }, {})?.text).toBe(
      'Halving: every target area is now 25 × 50 tiles.',
    );
    expect(stText.event({ type: 'GuessFed', playerId: 'a', guesses: 1 }, {})).toBeNull();
    expect(stText.event({ type: 'FeedbackGiven' }, {})).toBeNull();
  });

  it('gives a banner for Leaf Fall and halving only', () => {
    expect(stText.banner?.({ type: 'CellsFell', index: 1, cells: [{ x: 1, y: 1 }] })).toBe(
      'Leaf Fall: 1 cell fell.',
    );
    const halved = { type: 'AreaHalved', index: 1, playerId: null, area, width: 25, height: 50 };
    expect(stText.banner?.(halved)).toBe('Target area halved: columns 13–37, rows 1–50.');
    expect(stText.banner?.({ ...halved, area: null })).toBe(
      'Target areas halved: now 25 × 50 tiles each.',
    );
    expect(stText.banner?.({ type: 'HintGiven', playerId: null, quarter })).toBeNull();
  });
});

describe('result, intro and rules', () => {
  it('words the closest miss, touching or not', () => {
    const miss = { playerId: 'a', value: { x: 21, y: 31 }, distance: 1, touching: true };
    expect(stText.runnerUp({ closestMiss: miss }, { a: 'Anna' })).toBe(
      'Anna just missed — the next cell (21, 31).',
    );
    const far = { ...miss, value: { x: 17, y: 30 }, distance: 3, touching: false };
    expect(stText.runnerUp({ closestMiss: far }, {})).toBe(
      'Closest miss: a, 3 cells away (17, 30).',
    );
    expect(stText.runnerUp({ closestMiss: null }, {})).toBeNull();
  });

  it('names the grid in the intro, and words Spring and Autumn', () => {
    const view = { map: { width: 20, height: 20 } };
    expect(stText.intro?.(view, 'shared')).toBe('Shared target on a 20 × 20 grid');
    expect(stText.intro?.(view, 'individual')).toBe(
      'Everyone has their own target on a 20 × 20 grid',
    );
    expect(stText.intro?.(null, 'shared')).toBeNull();
    expect(stText.specialRule?.('spring')).toBe(
      'Everyone learns which quarter of the grid hides the target.',
    );
    expect(stText.specialRule?.('autumn')).toContain('tiles');
    expect(stText.specialRule?.('summer')).toBeNull();
    expect(stText.code('CELL_REMOVED')).toBe('That cell has fallen.');
    expect(stText.code('COOLDOWN_ACTIVE')).toBeNull();
  });
});
