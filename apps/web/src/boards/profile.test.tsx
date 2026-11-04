// @vitest-environment jsdom
/**
 * @file   apps/web/src/boards/profile.test.tsx
 * @module web/boards
 * @brief  A player's profile: numbers, boards, last rounds, staff adjustments.
 *
 * Responsibility: the profile shows its numbers, boards, last rounds with their game and
 *                 staff adjustments, and says so for an unknown name.
 * Depends on:     vitest, @testing-library/react, ./fakes, ./ProfilePage
 * Spec:           docs/spec/02-game-guess-the-number.md §9, §10; docs/spec/09-testing-strategy.md §2
 */
import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { rowsOf, serve, show, winter, type Answer } from './fakes.js';
import { ProfilePage } from './ProfilePage.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const ANNA_ROUTES: Readonly<Record<string, Answer>> = {
  '/games': [
    200,
    {
      games: [{ id: 'safecracker', name: 'Seasonal Safecracker', secretModes: [], teams: true }],
    },
  ],
  '/players/Anna': [
    200,
    {
      displayName: 'Anna',
      memberSince: Date.UTC(2026, 0, 15, 12),
      matchesPlayed: 4,
      roundsPlayed: 12,
      wins: 3,
      solves: 7,
      bestPlace: 1,
      boards: [{ period: winter, rank: 2, points: 41 }],
      recent: [
        {
          matchCode: 'ABC234',
          matchTitle: 'Friday fun',
          gameId: 'safecracker',
          roundId: 'r9',
          endedAt: Date.UTC(2026, 9, 20, 12),
          secretMode: 'individual',
          place: null,
          solved: false,
          points: 0,
        },
      ],
      adjustments: [
        {
          periodName: 'Winter 2026',
          delta: -5,
          reason: 'Shared account',
          at: Date.UTC(2026, 1, 2, 12),
        },
      ],
    },
  ],
};

describe('the profile', () => {
  it('shows the numbers, boards, last rounds with their game and staff adjustments', async () => {
    serve(ANNA_ROUTES);
    await show(<ProfilePage displayName="Anna" />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Anna');
    expect(screen.getByText('Member since 15 January 2026')).toBeTruthy();
    expect(screen.getByTestId('profile-facts').textContent).toBe(
      'Matches played4Rounds played12Round wins3Solves7Best place1',
    );
    expect(screen.getByTestId('profile-boards').textContent).toBe('Winter 2026: rank 2, 41 points');
    expect(screen.getByRole('link', { name: 'Winter 2026' }).getAttribute('href')).toBe(
      '#/leaderboard/p1',
    );
    // The round's game by name once the installed games are known (O41).
    await screen.findByText(/Seasonal Safecracker/);
    expect(rowsOf('profile-recent')).toEqual([
      'Friday funSeasonal Safecracker · 20 October 2026not solved0Verify',
    ]);
    expect(screen.getByRole('link', { name: 'Verify' }).getAttribute('href')).toBe(
      '#/rounds/r9/verify',
    );
    expect(screen.getByTestId('profile-adjustments').textContent).toContain(
      'Winter 2026: -5 points on 2 February 2026 — Shared account',
    );
  });
});

describe('an unknown profile', () => {
  it('says so for an unknown name', async () => {
    serve({});
    await show(<ProfilePage displayName="Nobody" />);
    expect(screen.getByTestId('profile-missing').textContent).toBe('No player with that name.');
  });
});
