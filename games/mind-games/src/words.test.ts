/**
 * @file   games/mind-games/src/words.test.ts
 * @module games/mind-games
 * @brief  The result's headline, its line, a loser's reason and the chat's round line (02e §9).
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
import { placeWords, resultLine, resultTitle, whyNot } from './words.js';

// A round's result with these final choices, one player each.
function resultOf(choices: readonly string[], cfg: Partial<MindConfig> = {}): ResultView {
  const s = playAll(
    roundWith(cfg),
    choices.map((c, i) => [`p${String(i)}`, c]),
  );
  return mindGames.views.result(s, null) as ResultView;
}

const reveal = (r: ResultView) => mindGames.reveal?.(r, null);

describe('Mind Games result words (02e §9, O97)', () => {
  it('names one winning option and its players', () => {
    const r = resultOf(['winter', 'winter', 'winter', 'spring', 'spring', 'spring', 'spring']);
    expect(resultTitle(r)).toBe('Winter wins!');
    expect(resultLine(r)).toBe('Least chosen season · 3 players win 1 point');
    expect(reveal(r)).toBe('Winter was the least chosen (3 players)');
    expect(whyNot(r, 'spring')).toBe('not least chosen');
    expect(whyNot(r, 'summer')).toBe('not chosen');
  });

  it('names a shared place', () => {
    const r = resultOf(['spring', 'autumn', 'summer', 'summer']);
    expect(resultTitle(r)).toBe('Spring and Autumn win!');
    expect(resultLine(r)).toBe('Least chosen season · 2 players win 1 point');
    expect(reveal(r)).toBe('Spring and Autumn were the least chosen (2 players)');
  });

  it('names another place, a single winner and All with its points', () => {
    const r = resultOf(['summer', 'winter', 'winter'], { winnerPlace: 2 });
    expect(resultTitle(r)).toBe('Winter wins!');
    expect(resultLine(r)).toBe('2nd least chosen season · 2 players win 1 point');
    expect(whyNot(r, 'summer')).toBe('not 2nd least chosen');
    const all = resultOf(['all', 'spring', 'spring'], { allOption: true });
    expect(resultTitle(all)).toBe('All wins!');
    expect(resultLine(all)).toBe('Least chosen season · 1 player wins · +2 for All');
    const both = resultOf(['all', 'autumn', 'spring', 'spring'], { allOption: true });
    expect(resultTitle(both)).toBe('Autumn and All win!');
    expect(resultLine(both)).toBe('Least chosen season · 2 players win 1 point · +2 for All');
  });

  it('says when nobody wins and when nobody chose', () => {
    const none = resultOf(['spring', 'summer'], { winnerPlace: 4 });
    expect(resultTitle(none)).toBe('Nobody wins this round.');
    expect(resultLine(none)).toBe('There is no 4th least chosen season this round.');
    expect(reveal(none)).toBeNull();
    expect(resultTitle(resultOf([]))).toBe('Nobody chose this round.');
    expect(resultLine(resultOf([]))).toBeNull();
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
