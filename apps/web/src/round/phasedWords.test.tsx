// @vitest-environment jsdom
/**
 * @file   apps/web/src/round/phasedWords.test.tsx
 * @module web/round
 * @brief  The platform's words in a phased round, and the guess rounds' unchanged.
 *
 * Responsibility: a round's actions are guesses in a guess round and choices in a phased one;
 *                 the result's headline of a phased round that ran its time is "The round is
 *                 over.", with nobody in it "Nobody chose this round." (02e §9), a guess round's
 *                 the same as before; the intro has no cooldown line in a phased round (DECISIONS
 *                 T332). A guess round's placings keep Place, Player, Guesses and Points in place
 *                 order; a phased round's have only Player and Points, its winners first, then
 *                 the rest, each in name order ("bot-9" before "bot-10", O102), and no count of
 *                 anyone's choices (T343). The round bar's time: a guess round's "… left" to its
 *                 end; a phased round's (total 60, hold 5) to the plan's end, where its strip
 *                 ends, then in the hold "Result in 0:04", whole seconds down (O107, T386).
 * Depends on:     vitest, @testing-library/react, @smg/contracts, ./fakes, ./ResultParts,
 *                 ./RoundIntro, ./roundText
 * Spec:           docs/spec/02e-game-mind-games.md §4, §9; docs/spec/04-software-architecture.md §4.8
 */
import type { RoundStateView } from '@smg/contracts';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ended } from './fakes.js';
import { Placings } from './ResultParts.js';
import { RoundIntro } from './RoundIntro.js';
import { actionCount, barTime, endHeadline } from './roundText.js';

afterEach(() => {
  cleanup();
});

const plan = { entryEndMs: 60_000, actionsEndMs: 90_000, endMs: 120_000, viewDelayMs: 30_000 };
const phased: RoundStateView = { ...ended, plan };

describe('the platform words of a phased round (T332)', () => {
  it('counts choices, and guesses in a guess round', () => {
    expect(actionCount(ended, 1)).toBe('1 guess');
    expect(actionCount(phased, 3)).toBe('3 choices');
  });

  it('heads the result of a phased round in its own words, a guess round as before', () => {
    expect(endHeadline({ ...ended, endReason: 'timeUp' })).toBe('Time is up.');
    expect(endHeadline({ ...phased, endReason: 'timeUp' })).toBe('The round is over.');
    expect(endHeadline({ ...phased, endReason: 'noPlayers' })).toBe('Nobody chose this round.');
    expect(endHeadline({ ...phased, endReason: 'host' })).toBe('The host ended the round.');
  });

  it('leaves the cooldown out of a phased round’s intro', () => {
    const counting = { ...ended, status: 'countdown' as const, opensAt: 5_000, game: null };
    render(<RoundIntro state={counting} game={null} />);
    expect(screen.getByText(/between guesses/)).toBeTruthy();
    cleanup();
    render(<RoundIntro state={{ ...counting, plan }} game={null} />);
    expect(screen.queryByText(/between guesses/)).toBeNull();
  });

  it('keeps a guess round’s placings; a phased round’s show Player and Points only (T343)', () => {
    const heads = () => screen.getAllByRole('columnheader').map((c) => c.textContent);
    const rows = () =>
      screen
        .getAllByRole('row')
        .slice(1)
        .map((r) => [...r.querySelectorAll('td')].map((c) => c.textContent));
    render(<Placings state={ended} viewerKey={null} />);
    expect(heads()).toEqual(['Place#', 'Player', 'Guesses', 'PointsPts']);
    cleanup();
    const row = (ended.results ?? [])[0];
    if (row === undefined) throw new Error('a result');
    // A winner, two others and a second winner, out of order, with counts that must not show.
    const results = [
      { ...row, playerId: 'p3', place: null, won: false, guesses: 7, points: 0 },
      { ...row, playerId: 'p1', place: null, won: true, guesses: 5, points: 1 },
      { ...row, playerId: 'p4', place: null, won: false, guesses: 9, points: 0 },
      { ...row, playerId: 'p2', place: null, won: true, guesses: 3, points: 2 },
    ];
    const names = { p1: 'zed', p2: 'Anna', p3: 'cy', p4: 'Bo' };
    render(<Placings state={{ ...phased, results, names }} viewerKey={null} />);
    fireEvent.click(screen.getByTestId('all-placings'));
    expect(heads()).toEqual(['Player', 'PointsPts']);
    expect(rows().map((r) => r[0]?.replace(/\s+/g, ''))).toEqual(['Anna', 'zed', 'Bo', 'cy']);
    expect(rows().map((r) => r[1])).toEqual(['2', '1', '0', '0']);
    expect(rows().flat().join(' ')).not.toMatch(/[3579]/);
  });
});

describe('a phased round’s result rows (O102)', () => {
  it('lists a phased round’s names in the numeric-aware order of O102', () => {
    const row = (ended.results ?? [])[0];
    if (row === undefined) throw new Error('a result');
    const results = ['b10', 'b9', 'b1'].map((playerId) => ({
      ...row,
      playerId,
      place: null,
      won: false,
    }));
    const names = { b10: 'bot-10', b9: 'bot-9', b1: 'bot-1' };
    render(<Placings state={{ ...phased, results, names }} viewerKey={null} />);

    const shown = screen
      .getAllByRole('row')
      .slice(1)
      .map((r) => r.querySelector('td')?.textContent);
    expect(shown.map((t) => t?.replace(/\s+/g, ''))).toEqual(['bot-1', 'bot-9', 'bot-10']);
  });
});

describe('the round bar’s time (O107, T386)', () => {
  const open = { ...ended, status: 'open' as const, opensAt: 0, endsAt: 60_000 };
  // Total 60 with the hold of 5 s: the plan ends at 60 s, the result comes at 65 s.
  const sixty = { entryEndMs: 30_000, actionsEndMs: 45_000, endMs: 60_000, viewDelayMs: 15_000 };
  const held: RoundStateView = { ...open, endsAt: 65_000, plan: sixty };

  it('counts a guess round to its end, whole seconds down', () => {
    expect(barTime(open, 500)).toEqual({ text: '0:59', left: true });
    expect(barTime(open, 59_700)).toEqual({ text: '0:00', left: true });
    expect(barTime(open, 61_000)).toEqual({ text: '0:00', left: true });
    expect(barTime({ ...open, status: 'countdown' }, 0)).toBeNull();
  });

  it('counts a phased round to the plan’s end, then says when the result comes', () => {
    expect(barTime(held, 500)).toEqual({ text: '0:59', left: true });
    expect(barTime(held, 29_700)).toEqual({ text: '0:30', left: true });
    expect(barTime(held, 59_700)).toEqual({ text: '0:00', left: true });
    expect(barTime(held, 60_000)).toEqual({ text: 'Result in 0:05', left: false });
    expect(barTime(held, 60_300)).toEqual({ text: 'Result in 0:04', left: false });
    expect(barTime(held, 62_500)).toEqual({ text: 'Result in 0:02', left: false });
    expect(barTime(held, 66_000)).toEqual({ text: 'Result in 0:00', left: false });
  });
});
