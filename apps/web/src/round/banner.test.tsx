// @vitest-environment jsdom
/**
 * @file   apps/web/src/round/banner.test.tsx
 * @module web/round
 * @brief  The specials made visible while a round runs (O35): banner, info button, chip.
 *
 * Responsibility: the banner says what a special just did — Leaf Fall and halving in the
 *                 game's words, Heatwave's waiting time and Spring Herald in the platform's —
 *                 for 3 s after the event and then goes; the newest event wins; under Frost
 *                 the viewer's just-sent guess gets "Frost: your answer arrives in N s."; the
 *                 top bar's chip names the special and its info button opens the special's
 *                 sentence and closes with Escape.
 * Depends on:     vitest, @testing-library/react, @smg/contracts, ./fakes, ./RoundScreen,
 *                 ./SpecialBanner
 * Spec:           docs/spec/03-seasonal-specials.md §2, §6; docs/spec/09-testing-strategy.md §2
 */
import type { RoundStateView } from '@smg/contracts';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ended } from './fakes.js';
import { RoundScreen } from './RoundScreen.js';
import { bannerOf, SpecialBanner } from './SpecialBanner.js';

afterEach(() => {
  cleanup();
});

const open: RoundStateView = { ...ended, status: 'open', role: 'player', game: {} };
// The game's banner words for its own events, and the viewer's guess rows.
const gameWith = (rows: readonly object[] = []) =>
  ({
    text: {
      banner: (e: { type: string }) =>
        e.type === 'NumbersRemoved'
          ? 'Leaf Fall: 10 numbers fell.'
          : e.type === 'RangeHalved'
            ? 'Range halved: the number is between 25 and 75.'
            : null,
      guesses: () => rows,
    },
  }) as never;
const item = (key: string, at: number, event: unknown) => ({ key, s: Number(key), at, event });
const game = (type: string) => ({ type: 'Game', event: { type } });

describe('the special banner', () => {
  it('names each special for 3 s after it fires', () => {
    const g = gameWith();
    const cases: [unknown, string][] = [
      [game('NumbersRemoved'), 'Leaf Fall: 10 numbers fell.'],
      [game('RangeHalved'), 'Range halved: the number is between 25 and 75.'],
      [{ type: 'CooldownChanged', cooldownMs: 4_000 }, 'Heatwave: waiting time is now 4 s.'],
      [
        { type: 'SpecialFired', special: 'springHerald' },
        'Spring Herald: everyone got a free hint.',
      ],
    ];
    for (const [event, text] of cases) {
      expect(bannerOf([item('1', 10_000, event)], open, g, 12_900)).toBe(text);
      expect(bannerOf([item('1', 10_000, event)], open, g, 13_000)).toBeNull();
    }
    // Rows the game does not banner (a guess) never show one.
    expect(bannerOf([item('1', 10_000, game('GuessFed'))], open, g, 10_500)).toBeNull();
  });

  it('shows the newest event when two fire close together', () => {
    const feed = [
      item('2', 11_000, { type: 'CooldownChanged', cooldownMs: 6_500 }),
      item('1', 10_000, game('NumbersRemoved')),
    ];
    expect(bannerOf(feed, open, gameWith(), 11_200)).toBe('Heatwave: waiting time is now 6.5 s.');
  });

  it('tells under Frost when the viewer’s held answer arrives', () => {
    const rows = [{ key: '1', at: 10_000, playerId: null, pending: true, feedback: null }];
    const frost = { ...open, season: 'winter', frostDelayMs: 3_000 } as const;
    expect(bannerOf([], frost, gameWith(rows), 10_200)).toBe('Frost: your answer arrives in 3 s.');
    expect(bannerOf([], frost, gameWith(rows), 13_100)).toBeNull();
    // Another player's held guess is not the viewer's to wait for.
    const theirs = [{ ...rows[0], playerId: 'w' }];
    expect(bannerOf([], frost, gameWith(theirs), 10_200)).toBeNull();
  });

  it('says for 3 s after a Frost round opens that answers arrive late', () => {
    const frost = { ...open, season: 'winter', frostDelayMs: 3_000, opensAt: 20_000 } as const;
    expect(bannerOf([], frost, gameWith(), 20_500)).toBe('Frost: answers arrive 3 s late.');
    expect(bannerOf([], frost, gameWith(), 23_100)).toBeNull();
    expect(bannerOf([], { ...frost, frostDelayMs: null }, gameWith(), 20_500)).toBeNull();
  });

  it('keeps an empty live region while nothing fires', () => {
    render(<SpecialBanner feed={[]} state={open} game={gameWith()} now={0} />);
    const region = screen.getByTestId('special-banner');
    expect(region.getAttribute('role')).toBe('status');
    expect(region.textContent).toBe('');
  });
});

describe('the top bar', () => {
  const show = (state: RoundStateView) =>
    render(
      <RoundScreen
        live={{ state, feed: [], reload: () => Promise.resolve() }}
        gameId="none"
        viewerKey="w"
        hostMenu={null}
        teamPoints={[]}
        standings={[]}
        chat={null}
      />,
    );

  it('names the special in the chip, and its info button tells what it does', () => {
    show(open);
    expect(screen.getByTestId('round-special').textContent).toBe('Leaf Fall');
    const button = screen.getByRole('button', { name: 'What Leaf Fall does' });
    const note = screen.getByRole('note', { hidden: true });
    expect(note.hidden).toBe(true);
    fireEvent.click(button);
    expect(note.hidden).toBe(false);
    expect(note.textContent).toBe(
      'Leaf Fall: Every so often, some wrong numbers fall out of the game.',
    );
    fireEvent.keyDown(note, { key: 'Escape' });
    expect(note.hidden).toBe(true);
  });

  it('has no info button with the special off', () => {
    show({ ...open, specialOn: false });
    expect(screen.getByTestId('round-special').textContent).toBe('no special');
    expect(screen.queryByTestId('special-info')).toBeNull();
  });
});
