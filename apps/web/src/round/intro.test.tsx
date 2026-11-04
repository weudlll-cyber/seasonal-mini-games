// @vitest-environment jsdom
/**
 * @file   apps/web/src/round/intro.test.tsx
 * @module web/round
 * @brief  The round intro during the countdown (O36): season, special, secret, cooldown, time.
 *
 * Responsibility: for every season the intro names the season and its special with the
 *                 owner's sentence, or "No special this round." when it is off; it shows the
 *                 game's line on the secret, the cooldown, the halving badge on a halving
 *                 round and the whole seconds until the round opens; the round screen shows
 *                 the intro under the round bar, without the list, while the round counts
 *                 down.
 * Depends on:     vitest, @testing-library/react, @smg/contracts, ./fakes, ./RoundIntro,
 *                 ./RoundScreen
 * Spec:           docs/spec/03-seasonal-specials.md §2, §6; docs/spec/09-testing-strategy.md §2
 */
import type { RoundStateView, SeasonName } from '@smg/contracts';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ended } from './fakes.js';
import { RoundIntro } from './RoundIntro.js';
import { RoundScreen } from './RoundScreen.js';

afterEach(() => {
  cleanup();
});

const counting: RoundStateView = {
  ...ended,
  status: 'countdown',
  role: 'player',
  opensAt: 10_000,
  game: {},
};
const game = {
  text: { intro: (_view: unknown, mode: string) => `${mode} number between 1 and 100` },
} as never;

const show = (state: RoundStateView, now = 2_100) =>
  render(<RoundIntro state={state} game={game} now={now} />);

const SENTENCES: readonly [SeasonName, string, string, string][] = [
  ['spring', 'Spring', 'Spring Herald', 'Everyone gets one free hint when the round opens.'],
  [
    'summer',
    'Summer',
    'Heatwave',
    'The waiting time between guesses gets shorter as the round goes on.',
  ],
  ['autumn', 'Autumn', 'Leaf Fall', 'Every so often, some wrong numbers fall out of the game.'],
  ['winter', 'Winter', 'Frost', 'Answers arrive a few seconds late.'],
];

describe('the round intro', () => {
  it.each(SENTENCES)('names %s, its special and what it does', (season, name, special, rule) => {
    show({ ...counting, season });
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(name);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(special);
    expect(screen.getByTestId('intro-special').textContent).toBe(`${special}${rule}`);
    expect(screen.getByTestId('round-intro').dataset['season']).toBe(season);
  });

  it('says so when the special is off', () => {
    show({ ...counting, specialOn: false });
    expect(screen.getByTestId('intro-special').textContent).toBe('No special this round.');
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
  });

  it('shows the secret line, the cooldown and the seconds until the round opens', () => {
    show(counting);
    expect(screen.getByTestId('intro-secret').textContent).toBe('shared number between 1 and 100');
    expect(screen.getByText('Cooldown 3.0 s between guesses')).toBeTruthy();
    expect(screen.getByTestId('countdown').textContent).toBe('Opens in 8 s');
    expect(screen.queryByText('Halving round')).toBeNull();
    cleanup();
    show({ ...counting, halving: true }, 10_500);
    expect(screen.getByText('Halving round')).toBeTruthy();
    expect(screen.getByTestId('countdown').textContent).toBe('Opens in 0 s');
  });

  it('takes the place of the round view under the round bar while the round counts down', () => {
    const live = { state: counting, feed: [], reload: () => Promise.resolve() };
    render(
      <RoundScreen
        live={live as never}
        gameId="none"
        viewerKey="w"
        host={null}
        teamPoints={[]}
        standings={[]}
        chat={null}
      />,
    );
    expect(screen.getByTestId('round-intro')).toBeTruthy();
    // The bar keeps the panels (O46); the seconds to the opening are only the intro's.
    expect(screen.getByTestId('round-banner')).toBeTruthy();
    expect(screen.getAllByTestId('countdown')).toHaveLength(1);
    expect(screen.queryByTestId('guess-list')).toBeNull();
  });
});
