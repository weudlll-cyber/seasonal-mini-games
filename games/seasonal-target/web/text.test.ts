/**
 * @file   games/seasonal-target/web/text.test.ts
 * @module games/seasonal-target/web
 * @brief  The game's words: answers, rows, event lines, banners, closest miss, intro, rules.
 *
 * Responsibility: answers long and short in all three modes in tiles; only a found target
 *                 takes the platform's tone, every miss `far` with its server tier, prefixed, as
 *                 the row's tier (O51); the views become rows with the tile as text and the
 *                 answer in words, own rows pending under Frost, hidden tiles "guessed"; every
 *                 room event has its line (Leaf Fall as the special's row, sizes in tiles),
 *                 Spring Herald's hint and guesses none; the banners; the closest miss besides
 *                 the winner, touching or not; the intro line naming the grid; the special's
 *                 sentence for Spring and Autumn only; refusals in tiles.
 * Depends on:     vitest, ./text, ./words
 * Spec:           docs/spec/02d-game-seasonal-target.md §2, §5, §6, §8, §9
 */
import { describe, expect, it } from 'vitest';

import { stText } from './text.js';
import { areaText, longAnswer, rowTier, shortAnswer, toneOf } from './words.js';

const ne = { kind: 'direction', distance: 9, direction: 'NE', tier: 'cold' } as const;
const nine = { kind: 'distance', distance: 9, tier: 'cold' } as const;

describe('answers', () => {
  it('words direction, distance, closeness and correct answers', () => {
    expect(longAnswer(nine)).toBe('9 tiles away');
    expect(longAnswer({ kind: 'distance', distance: 1, tier: 'justMissed' })).toBe('1 tile away');
    expect(shortAnswer(nine)).toBe('9 away');
    // A miss is never the platform's green: its colour is the row's tier, like the tile's.
    expect(toneOf({ kind: 'distance', distance: 3, tier: 'hot' })).toBe('far');
    expect(rowTier({ kind: 'distance', distance: 3, tier: 'hot' })).toBe('st-hot');
    expect(rowTier({ kind: 'correct' })).toBe('st-correct');
    expect(longAnswer(ne)).toBe('9 tiles away, to the north-east');
    expect(shortAnswer(ne)).toBe('9 away, NE ↗');
    expect(longAnswer({ kind: 'direction', distance: 1, direction: 'N', tier: 'justMissed' })).toBe(
      '1 tile away, to the north',
    );
    expect(longAnswer({ kind: 'closeness', tier: 'warm' })).toBe('Warm');
    // Short on the row, never cut; the tile's label keeps the sentence (T151).
    expect(shortAnswer({ kind: 'closeness', tier: 'justMissed' })).toBe('Just missed');
    expect(longAnswer({ kind: 'closeness', tier: 'justMissed' })).toBe(
      'Just missed — right next to it',
    );
    expect(rowTier({ kind: 'closeness', tier: 'cold' })).toBe('st-k-cold');
    expect(longAnswer({ kind: 'correct' })).toBe('Target found!');
    expect(toneOf({ kind: 'correct' })).toBe('correct');
    expect(toneOf(ne)).toBe('far');
    expect(toneOf({ kind: 'closeness', tier: 'justMissed' })).toBe('far');
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
      log: [
        {
          receiveSeq: 2,
          receivedAt: 20,
          playerId: 'b',
          value: null,
          feedback: null,
          held: false,
          ...seen,
        },
      ],
    };
    const rows = stText.guesses(view);
    expect(rows[0]).toMatchObject({
      key: '1',
      playerId: null,
      value: null,
      feedback: null,
      text: '(12, 34)',
      answer: { text: '9 away, NE ↗', tone: 'far' },
      // The answer's tier even with comments off (the view's comment tier is null).
      tier: 'st-cold',
      pending: false,
    });
    expect(rows[1]).toMatchObject({ text: '(1, 1)', answer: null, tier: null, pending: true });
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
      text: 'Leaf Fall: 2 tiles fell.',
      playerId: null,
      special: true,
    });
    // A later fall says which one it is, so the rows differ.
    expect(stText.event({ ...fell, index: 3 }, {})?.text).toBe('Leaf Fall: 2 tiles fell (fall 3).');
    // The hint shows as the grid's quarter and the panel's line, never as a list line.
    expect(stText.event({ type: 'HintGiven', playerId: null, quarter }, {})).toBeNull();
    expect(stText.event({ type: 'HintGiven', playerId: null, quarter: null }, {})).toBeNull();
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
      'Leaf Fall: 1 tile fell.',
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
  it('words the closest miss besides the winner, touching or not', () => {
    const miss = { playerId: 'a', value: { x: 21, y: 31 }, distance: 1, touching: true };
    expect(stText.runnerUp({ closestMiss: miss }, { a: 'Anna' }, true)).toBe(
      'Closest miss besides the winner: Anna, right next to the target (21, 31).',
    );
    const far = { ...miss, value: { x: 17, y: 30 }, distance: 3, touching: false };
    expect(stText.runnerUp({ closestMiss: far }, {}, true)).toBe(
      'Closest miss besides the winner: a, 3 tiles away (17, 30).',
    );
    expect(stText.runnerUp({ closestMiss: null }, {}, true)).toBeNull();
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
    expect(stText.code('CELL_REMOVED')).toBe('That tile has fallen.');
    expect(stText.code('OUT_OF_MAP')).toBe('That tile is not on the grid.');
    expect(stText.code('INVALID_ACTION')).toBe('Pick a tile on the grid.');
    expect(stText.code('COOLDOWN_ACTIVE')).toBeNull();
  });
});
