// @vitest-environment jsdom
/**
 * @file   apps/web/src/round/steps.test.tsx
 * @module web/round
 * @brief  A website member's Discord steps beside the name (O66): icon, name, or nothing.
 *
 * Responsibility: a step with an icon is a small image named by the step, one without shows
 *                 its name as text; without steps a name is the bare name as before (a
 *                 standalone install); the round's result, the leaderboard row and the
 *                 profile heading show them.
 * Depends on:     vitest, @testing-library/react, ./PlayerName, ./RoundScreen, ./fakes,
 *                 ../boards/*
 * Spec:           docs/spec/07-integration.md §7
 */
import type { PlayerStepView } from '@smg/contracts';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { allTime, row, serve, show, winter } from '../boards/fakes.js';
import { LeaderboardPage } from '../boards/LeaderboardPage.js';
import { ProfilePage } from '../boards/ProfilePage.js';
import { ended } from './fakes.js';
import { PlayerName } from './PlayerName.js';
import { RoundScreen } from './RoundScreen.js';

vi.mock('../live/socket.js', () => ({ serverNow: () => Date.now() }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const STEPS: readonly PlayerStepView[] = [
  { ladder: 'holder', name: 'Diamond Hands', icon: '/media/step-icons/0123456789abcdef.webp' },
  { ladder: 'farmer', name: 'Seedling', icon: null },
];

describe('steps beside a name', () => {
  it('shows an icon named by its step, or the step name as text', () => {
    render(<PlayerName name="Walter" steps={STEPS} />);
    const steps = screen.getByTestId('player-steps');
    const icon = screen.getByRole('img', { name: 'Diamond Hands' });
    expect(icon.getAttribute('src')).toBe('/media/step-icons/0123456789abcdef.webp');
    expect(steps.contains(icon)).toBe(true);
    expect(steps.textContent).toBe('Seedling');
    expect(screen.getByTitle('Walter').textContent).toBe('Walter');
  });

  it('leaves a name without steps as it was', () => {
    const { container } = render(<PlayerName name="Walter" steps={[]} />);
    expect(screen.queryByTestId('player-steps')).toBeNull();
    expect(container.innerHTML).toBe(
      '<span class="player-name" data-full="false" title="Walter" tabindex="0">Walter</span>',
    );
  });
});

describe('steps where names appear', () => {
  it("shows them in the round's result by player key", () => {
    render(
      <RoundScreen
        live={{
          state: { ...ended, steps: { w: STEPS } },
          feed: [],
          reload: () => Promise.resolve(),
        }}
        gameId="none"
        viewerKey="a"
        host={null}
        teamPoints={[]}
        standings={[]}
        chat={null}
      />,
    );
    const walter = screen.getAllByTitle('Walter')[0]?.closest('.player-named');
    expect(walter?.querySelector('img')?.getAttribute('alt')).toBe('Diamond Hands');
  });

  it('shows them on the leaderboard and the profile', async () => {
    serve({
      '/leaderboards': [200, { periods: [allTime] }],
      '/leaderboards/p0': [
        200,
        { period: allTime, rows: [{ ...row(1, 'Walter', 30), steps: STEPS }], next: null },
      ],
      '/leaderboards/p0/teams': [200, { period: allTime, rows: [] }],
      '/leaderboards/p0/me': [200, { period: allTime, rows: [] }],
    });
    await show(<LeaderboardPage periodId={null} />);
    expect(screen.getByRole('img', { name: 'Diamond Hands' })).toBeTruthy();
    cleanup();
    serve({
      '/games': [200, { games: [] }],
      '/players/Walter': [
        200,
        {
          displayName: 'Walter',
          steps: STEPS,
          memberSince: 0,
          matchesPlayed: 0,
          roundsPlayed: 0,
          wins: 0,
          solves: 0,
          bestPlace: null,
          boards: [{ period: winter, rank: null, points: 0 }],
          recent: [],
          adjustments: [],
        },
      ],
    });
    await show(<ProfilePage displayName="Walter" />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).toBe('WalterSeedling');
    expect(heading.querySelector('img')?.getAttribute('alt')).toBe('Diamond Hands');
  });
});
