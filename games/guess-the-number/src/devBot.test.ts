/**
 * @file   games/guess-the-number/src/devBot.test.ts
 * @module games/guess-the-number
 * @brief  The development bot finds the number from its own answers and then stops.
 *
 * Responsibility: playing only from its player view, the bot solves a 1–1 000 round in at
 *                 most 30 guesses, never repeats or picks a removed number, and has nothing
 *                 to do once solved or when its band is used up.
 * Depends on:     vitest, ./devBot, ./fakes, ./module
 * Spec:           docs/spec/09-testing-strategy.md §5
 */
import { describe, expect, it } from 'vitest';

import { gtnDevBot } from './devBot.js';
import { input, Table } from './fakes.js';
import { guessTheNumber } from './module.js';

const all = { releasedBefore: Infinity };
let state = 7;
const pick = (n: number) => {
  state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
  return state % n;
};

describe('the development bot', () => {
  it('solves from its own answers without repeats and then stops', () => {
    for (const secret of [1, 500, 731, 1_000]) {
      const t = new Table({ mode: 'shared', value: secret }, input('shared', ['bot']));
      t.state = { ...t.state, removed: secret === 500 ? [] : [secret === 1 ? 2 : 1] };
      let guesses = 0;
      for (;;) {
        const action = gtnDevBot(guessTheNumber.views.player(t.state, 'bot', all), pick);
        if (action === null) break;
        expect(t.play('bot', action.value).ok).toBe(true);
        guesses += 1;
      }
      expect(guesses).toBeLessThanOrEqual(30);
      expect(t.state.players.bot?.guesses.at(-1)?.feedback).toBe('correct');
    }
  });

  it('has nothing to do when every number of its band was tried', () => {
    const view = {
      range: { low: 1, high: 2 },
      removed: [2],
      band: { low: 1, high: 2 },
      guesses: [{ receiveSeq: 1, value: 1, feedback: 'higher' }],
    };
    expect(gtnDevBot(view, pick)).toBeNull();
  });
});
