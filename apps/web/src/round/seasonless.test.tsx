// @vitest-environment jsdom
/**
 * @file   apps/web/src/round/seasonless.test.tsx
 * @module web/round
 * @brief  A game whose rounds show no season (O93) beside one that shows it, as every guess game.
 *
 * Responsibility: through the game list's `seasons`: the round bar keeps its season pill for a
 *                 game that shows its season and has none for one that does not; the intro
 *                 names the season and its special, or the game's name with no season and no
 *                 special; the host form's season controls and the season's own fields (its
 *                 `formSeason`) are there only for a game that shows its season.
 * Depends on:     vitest, @testing-library/react, @smg/contracts, ./fakes, ./RoundScreen,
 *                 ../match/roundFields
 * Spec:           docs/spec/02e-game-mind-games.md §12; docs/spec/04-software-architecture.md §4
 */
import type { RoundStateView } from '@smg/contracts';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { formSeason, SeasonControls } from '../match/roundFields.js';
import { ended } from './fakes.js';
import { RoundScreen } from './RoundScreen.js';

// The game list: one game that shows its season, one that does not (O93).
const GAMES = [
  {
    id: 'seasonal',
    name: 'Seasonal',
    secretModes: ['shared'],
    teams: true,
    timing: 'cooldown',
    seasons: true,
  },
  {
    id: 'plain',
    name: 'Plain Game',
    secretModes: [],
    teams: false,
    timing: 'phased',
    seasons: false,
  },
];
vi.mock('../shell/http.js', () => ({
  api: () => Promise.resolve({ games: GAMES }),
  ApiError: class extends Error {},
  BASE_PATH: '/',
}));

afterEach(() => {
  cleanup();
});

const state = (status: RoundStateView['status']): RoundStateView => ({
  ...ended,
  status,
  role: 'player',
  opensAt: 10_000,
  game: {},
});

const screenOf = (gameId: string, status: RoundStateView['status']) =>
  render(
    <RoundScreen
      live={{ state: state(status), feed: [], reload: () => Promise.resolve() }}
      gameId={gameId}
      viewerKey="w"
      host={null}
      teamPoints={[]}
      standings={[]}
      chat={null}
    />,
  );

describe('a round of a game that shows no season (O93)', () => {
  it('keeps the season pill for a game that shows its season, and has none otherwise', async () => {
    screenOf('seasonal', 'open');
    expect(screen.queryByTestId('round-season')).not.toBeNull();
    cleanup();
    screenOf('plain', 'open');
    expect(screen.getByTestId('round-banner')).toBeTruthy();
    // The game list arrives after the first frame.
    await waitFor(() => {
      expect(screen.queryByTestId('round-season')).toBeNull();
    });
  });

  it('names the season on the intro, or the game with no season and no special', async () => {
    screenOf('seasonal', 'countdown');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Autumn');
    expect(screen.getByTestId('intro-special')).toBeTruthy();
    cleanup();
    screenOf('plain', 'countdown');
    expect(await screen.findByRole('heading', { level: 1, name: 'Plain Game' })).toBeTruthy();
    expect(screen.queryByTestId('intro-special')).toBeNull();
    expect(screen.getByTestId('round-intro').dataset['season']).toBeUndefined();
    expect(screen.queryByText(/No special/)).toBeNull();
  });

  it('leaves the season out of the host form for such a game', () => {
    const choice = {
      now: null,
      season: 'summer' as const,
      setSeason: () => undefined,
      halving: false,
      setHalving: () => undefined,
    };
    render(<SeasonControls {...choice} shows />);
    expect(screen.getByLabelText('Season')).toBeTruthy();
    expect(formSeason({ ...choice, shows: true })).toBe('summer');
    cleanup();
    render(<SeasonControls {...choice} shows={false} />);
    expect(screen.queryByLabelText('Season')).toBeNull();
    // No season, so no season's own fields (Heatwave's) either.
    expect(formSeason({ ...choice, shows: false })).toBeNull();
  });
});
