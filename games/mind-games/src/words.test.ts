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
import { placeWords, resultLine, resultTitle, whyNot, winnersTitle } from './words.js';

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
    expect(resultLine(r)).toBe('Least chosen season · 7 players');
    expect(reveal(r)).toBe('Winter was the least chosen (3 players)');
    expect(whyNot(r, 'spring')).toBe('not least chosen');
    expect(whyNot(r, 'summer')).toBe('not chosen');
    expect(winnersTitle(r)).toBe('3 winners · +1 each');
  });
});

describe('Mind Games winners panel title (MG-N8)', () => {
  it('titles the winners panel with the points', () => {
    expect(winnersTitle(resultOf(['summer', 'winter', 'winter'], { winnerPlace: 2 }))).toBe(
      '2 winners · +1 each',
    );
    expect(winnersTitle(resultOf(['spring', 'summer', 'summer']))).toBe('1 winner · +1');
    const all = resultOf(['all', 'spring', 'spring'], { allOption: true });
    expect(winnersTitle(all)).toBe('1 winner · +2 for All');
    const both = resultOf(['all', 'autumn', 'spring', 'spring'], { allOption: true });
    expect(winnersTitle(both)).toBe('2 winners · +1 each, +2 for All');
    expect(winnersTitle(resultOf(['spring', 'summer'], { winnerPlace: 4 }))).toBeNull();
  });

  it('names a shared place', () => {
    const r = resultOf(['spring', 'autumn', 'summer', 'summer']);
    expect(resultTitle(r)).toBe('Spring and Autumn win!');
    expect(resultLine(r)).toBe('Least chosen season · 4 players');
    expect(reveal(r)).toBe('Spring and Autumn were the least chosen (2 players)');
  });

  it('names another place, a single winner and All with its points', () => {
    const r = resultOf(['summer', 'winter', 'winter'], { winnerPlace: 2 });
    expect(resultTitle(r)).toBe('Winter wins!');
    expect(resultLine(r)).toBe('2nd least chosen season · 3 players');
    expect(whyNot(r, 'summer')).toBe('not 2nd least chosen');
    const all = resultOf(['all', 'spring', 'spring'], { allOption: true });
    expect(resultTitle(all)).toBe('All wins!');
    expect(resultLine(all)).toBe('Least chosen season · 3 players');
    const both = resultOf(['all', 'autumn', 'spring', 'spring'], { allOption: true });
    expect(resultTitle(both)).toBe('Autumn and All win!');
    expect(resultLine(both)).toBe('Least chosen season · 4 players');
  });

  it('says when nobody wins and when nobody chose', () => {
    const none = resultOf(['spring', 'summer'], { winnerPlace: 4 });
    expect(resultTitle(none)).toBe('Nobody wins this round.');
    expect(resultLine(none)).toBe('4th least chosen season · 2 players');
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
