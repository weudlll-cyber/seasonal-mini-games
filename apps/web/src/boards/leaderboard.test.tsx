// @vitest-environment jsdom
/**
 * @file   apps/web/src/boards/leaderboard.test.tsx
 * @module web/boards
 * @brief  The leaderboard: its boards, rows, the neighbourhood, one game's board.
 *
 * Responsibility: the leaderboard lists its boards by name, shows ranked rows with the
 *                 viewer's highlighted, the viewer's neighbourhood when the viewer is not on
 *                 the first page, the team board, "Show more", a board for one game (O44) and
 *                 the empty sentence.
 * Depends on:     vitest, @testing-library/react, ./fakes, ./LeaderboardPage
 * Spec:           docs/spec/02-game-guess-the-number.md §9, §10; docs/spec/09-testing-strategy.md §2
 */
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { allTime, row, rowsOf, serve, show, winter } from './fakes.js';
import { LeaderboardPage } from './LeaderboardPage.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the leaderboard', () => {
  it('shows the board, the team board, more rows and the viewer’s neighbourhood', async () => {
    serve({
      '/leaderboards': [200, { periods: [allTime, winter] }],
      '/leaderboards/p0': [
        200,
        { period: allTime, rows: [row(1, 'Walter', 30), row(1, 'Bo', 30)], next: 50 },
      ],
      '/leaderboards/p0/me': [200, { period: allTime, rows: [row(60, 'Anna', 2, true)] }],
      '/leaderboards/p0/teams': [
        200,
        { period: allTime, rows: [{ rank: 1, team: 'winter', points: 4, wins: 4 }] },
      ],
    });
    await show(<LeaderboardPage periodId={null} />);
    const picker = screen.getByTestId<HTMLSelectElement>('board-picker');
    expect([...picker.options].map((o) => o.textContent)).toEqual(['All time', 'Winter 2026']);
    expect(rowsOf('board')).toEqual(['1Walter30123', '1Bo30123']);
    expect(screen.getByRole('link', { name: 'Walter' }).getAttribute('href')).toBe(
      '#/players/Walter',
    );
    expect(screen.getByTestId('board-around').querySelector('.round-you')?.textContent).toBe(
      '60Anna (you)2123',
    );
    expect(rowsOf('team-board')).toEqual(['1 Team Winter44']);
    expect(screen.getByAltText('Winter')).toBeTruthy();
  });

  it('adds the next page with "Show more" and drops the neighbourhood once the viewer shows', async () => {
    serve({
      '/leaderboards': [200, { periods: [allTime] }],
      '/leaderboards/p0': [200, { period: allTime, rows: [row(1, 'Walter', 30)], next: 50 }],
      '/leaderboards/p0/me': [200, { period: allTime, rows: [row(51, 'Anna', 2, true)] }],
      '/leaderboards/p0/teams': [200, { period: allTime, rows: [] }],
    });
    await show(<LeaderboardPage periodId="p0" />);
    expect(screen.getByTestId('board-around')).toBeTruthy();
    expect(screen.getByText('No team points on this board yet.')).toBeTruthy();
    // The next page answers on the same path; its query names the offset.
    serve({
      '/leaderboards/p0?offset=50': [
        200,
        { period: allTime, rows: [row(51, 'Anna', 2, true)], next: null },
      ],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(rowsOf('board')).toEqual(['1Walter30123', '51Anna (you)2123']);
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
    expect(screen.queryByTestId('board-around')).toBeNull();
  });
});

describe('a board for one game (O44)', () => {
  it('shows the total over every game first, and one game’s board when chosen', async () => {
    const row = { rank: 1, points: 0, wins: 0, solves: 0, matches: 1, you: false };
    const asked = serve({
      '/games': [200, { games: [{ id: 'safecracker', name: 'Seasonal Safecracker' }] }],
      '/leaderboards': [200, { periods: [winter] }],
      '/leaderboards/p1': [
        200,
        { period: winter, rows: [{ ...row, displayName: 'All', points: 30 }], next: null },
      ],
      '/leaderboards/p1?game=safecracker': [
        200,
        { period: winter, rows: [{ ...row, displayName: 'Safe', points: 10 }], next: null },
      ],
      '/leaderboards/p1/me': [200, { period: winter, rows: [] }],
      '/leaderboards/p1/me?game=safecracker': [200, { period: winter, rows: [] }],
      '/leaderboards/p1/teams': [200, { period: winter, rows: [] }],
      '/leaderboards/p1/teams?game=safecracker': [200, { period: winter, rows: [] }],
    });
    await show(<LeaderboardPage periodId={null} />);
    expect(await screen.findByText('All')).toBeTruthy();
    await screen.findByRole('option', { name: 'Seasonal Safecracker' });
    fireEvent.change(screen.getByTestId('board-game'), { target: { value: 'safecracker' } });
    expect(await screen.findByText('Safe')).toBeTruthy();
    expect(asked).toContain('/leaderboards/p1/teams?game=safecracker');
  });
});

describe('an empty board', () => {
  it('says so when a board has no points yet', async () => {
    serve({
      '/leaderboards': [200, { periods: [winter] }],
      '/leaderboards/p1': [200, { period: winter, rows: [], next: null }],
      '/leaderboards/p1/me': [200, { period: winter, rows: [] }],
      '/leaderboards/p1/teams': [200, { period: winter, rows: [] }],
    });
    await show(<LeaderboardPage periodId={null} />);
    expect(screen.getByTestId('board-empty').textContent).toBe('No points on this board yet.');
  });
});

// Anna's profile: one board, one round of a Safecracker match, one staff adjustment.
