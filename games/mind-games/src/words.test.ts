/**
 * @file   games/mind-games/src/words.test.ts
 * @module games/mind-games
 * @brief  The result's headline and the chat's round line in the words of 02e §9.
 *
 * Responsibility: one winning option, a shared place, the 2nd least chosen, one player, a place
 *                 that does not exist, a round nobody chose in; the chat line's part, none
 *                 when nobody won.
 * Depends on:     vitest, ./fakes, ./module, ./views, ./words
 * Spec:           docs/spec/02e-game-mind-games.md §9; docs/spec/09-testing-strategy.md §4.2
 */
import { describe, expect, it } from 'vitest';

import { playAll, roundWith } from './fakes.js';
import { mindGames } from './module.js';
import type { MindConfig } from './settings.js';
import type { ResultView } from './views.js';
import { headline, placeWords } from './words.js';

// A round's result with these final choices, one player each.
function resultOf(choices: readonly string[], cfg: Partial<MindConfig> = {}): ResultView {
  const s = playAll(
    roundWith(cfg),
    choices.map((c, i) => [`p${String(i)}`, c]),
  );
  return mindGames.views.result(s, null) as ResultView;
}

const reveal = (r: ResultView) => mindGames.reveal?.(r, null);

describe('Mind Games result words (02e §9)', () => {
  it('names one winning option and its players', () => {
    const r = resultOf(['winter', 'winter', 'winter', 'spring', 'spring', 'spring', 'spring']);
    expect(headline(r)).toBe('Winter was the least chosen — 3 players win.');
    expect(reveal(r)).toBe('Winter was the least chosen (3 players)');
  });

  it('names a shared place', () => {
    const r = resultOf(['spring', 'autumn', 'summer', 'summer']);
    expect(headline(r)).toBe('Spring and Autumn share the least chosen place — 2 players win.');
    expect(reveal(r)).toBe('Spring and Autumn were the least chosen (2 players)');
  });

  it('names another place and a single winner', () => {
    const r = resultOf(['summer', 'winter', 'winter'], { winnerPlace: 2 });
    expect(headline(r)).toBe('Winter was the 2nd least chosen — 2 players win.');
    expect(headline(resultOf(['all', 'spring', 'spring'], { allOption: true }))).toBe(
      'All was the least chosen — 1 player wins.',
    );
  });

  it('says when nobody wins and when nobody chose', () => {
    const none = resultOf(['spring', 'summer'], { winnerPlace: 4 });
    expect(headline(none)).toBe('Nobody wins: there is no 4th least chosen option this round.');
    expect(reveal(none)).toBeNull();
    expect(headline(resultOf([]))).toBe('Nobody chose this round.');
  });

  it('words every place', () => {
    expect([1, 2, 3, 4, 5, 6].map(placeWords)).toEqual([
      'least chosen',
      '2nd least chosen',
      '3rd least chosen',
      '4th least chosen',
      '5th least chosen',
      '6th least chosen',
    ]);
  });
});
