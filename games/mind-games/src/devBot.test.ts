/**
 * @file   games/mind-games/src/devBot.test.ts
 * @module games/mind-games
 * @brief  The development bot's first choice and its three ways to play, from its own view.
 *
 * Responsibility: without a choice the bot makes its first one from its draws; a bot that
 *                 stays has nothing more to do; one that leans takes the least chosen option
 *                 its feed shows; one that switches at random moves on every third change of
 *                 its feed and otherwise sends its current choice (refused at no cost); All only
 *                 where offered.
 * Depends on:     vitest, ./devBot, ./fakes, ./module, ./views
 * Spec:           docs/spec/09-testing-strategy.md §4.2
 */
import { describe, expect, it } from 'vitest';

import { mindDevBot } from './devBot.js';
import { playAll, roundWith } from './fakes.js';
import { mindGames } from './module.js';
import type { MindConfig } from './settings.js';

// Draws given in order: the way, the box, the first choice, then the rest.
const draws = (list: readonly number[]) => {
  let i = 0;
  return (n: number) => (list[i++] ?? 0) % n;
};

const viewOf = (moves: Parameters<typeof playAll>[1], cfg: Partial<MindConfig> = {}) =>
  mindGames.views.player(playAll(roundWith(cfg), moves), 'bot', { releasedBefore: Infinity });

describe('Mind Games development bot (09 §4.2)', () => {
  it('makes its first choice from its draws, All only where offered', () => {
    expect(mindDevBot(viewOf([]), draws([0, 1, 3]))).toEqual({
      value: { choice: 'winter', hide: true },
    });
    expect(mindDevBot(viewOf([]), draws([0, 0, 4]))).toEqual({
      value: { choice: 'spring', hide: false },
    });
    expect(mindDevBot(viewOf([], { allOption: true }), draws([0, 0, 4]))).toEqual({
      value: { choice: 'all', hide: false },
    });
  });

  it('stays after its first choice', () => {
    expect(mindDevBot(viewOf([['bot', 'winter']]), draws([0, 0, 0]))).toBeNull();
  });

  it('leans to the least chosen option its feed shows', () => {
    const view = viewOf([
      ['bot', 'spring'],
      ['a', 'spring'],
      ['b', 'summer'],
      ['c', 'autumn'],
      ['d', 'autumn'],
      ['e', 'winter'],
      ['f', 'winter'],
    ]);
    expect(mindDevBot(view, draws([2, 0, 0]))).toEqual({
      value: { choice: 'summer', hide: false },
    });
  });

  it('switches at random on every third change of its feed, else keeps its choice', () => {
    // Two lines and two players in the round: 4, not a third change.
    const kept = viewOf([
      ['bot', 'spring'],
      ['a', 'summer'],
    ]);
    expect(mindDevBot(kept, draws([1, 0, 0, 1]))).toEqual({
      value: { choice: 'spring', hide: false },
    });
    // Three lines and three players: 6, a third change; (1 + 6) % 4 = 3.
    const moved = viewOf([
      ['bot', 'spring'],
      ['a', 'summer'],
      ['b', 'summer'],
    ]);
    expect(mindDevBot(moved, draws([1, 0, 0, 1]))).toEqual({
      value: { choice: 'winter', hide: false },
    });
  });
});
