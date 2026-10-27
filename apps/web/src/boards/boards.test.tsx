// @vitest-environment jsdom
/**
 * @file   apps/web/src/boards/boards.test.tsx
 * @module web/boards
 * @brief  The boards in the player client: leaderboard, profile, verification page.
 *
 * Responsibility: the leaderboard lists its boards by name, shows ranked rows with the
 *                 viewer's highlighted, the viewer's neighbourhood when the viewer is not on
 *                 the first page, the team board, "Show more" and the empty sentence; the
 *                 profile shows its numbers, boards, last rounds and staff adjustments, and
 *                 says so for an unknown name; the verification page checks the seed against
 *                 the commitment in the browser (matching and not), names the secrets by
 *                 player, lists the guesses in receive order, and words a missing proof.
 * Depends on:     node:crypto, vitest, @testing-library/react, ../shell/session, ./*
 * Spec:           docs/spec/02-game-guess-the-number.md §9, §10; docs/spec/09-testing-strategy.md §2
 */
import { createHash } from 'node:crypto';

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SessionProvider } from '../shell/session.js';
import { LeaderboardPage } from './LeaderboardPage.js';
import { ProfilePage } from './ProfilePage.js';
import { VerifyPage } from './VerifyPage.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

type Answer = readonly [status: number, body: unknown];

// Answers by path after /api/v1, query included; the session is signed in as Anna.
function serve(routes: Readonly<Record<string, Answer>>): string[] {
  const asked: string[] = [];
  const session = {
    signedIn: true,
    account: { id: 'a', displayName: 'Anna' },
    permissions: [],
    csrfToken: 'x',
  };
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      const path = url.replace(/^.*\/api\/v1/, '');
      asked.push(path);
      const [status, body] =
        path === '/session' ? [200, session] : (routes[path] ?? [404, { code: 'NOT_FOUND' }]);
      return Promise.resolve(new Response(JSON.stringify(body), { status }));
    }),
  );
  return asked;
}

async function show(page: ReactElement): Promise<void> {
  render(<SessionProvider>{page}</SessionProvider>);
  // Let the loads and the browser's hash settle.
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

const rowsOf = (testId: string) =>
  [...screen.getByTestId(testId).querySelectorAll('tbody tr')].map((tr) => tr.textContent);

const allTime = {
  id: 'p0',
  kind: 'all_time',
  name: 'All time',
  startsAt: 0,
  endsAt: null,
  status: 'active',
};
const winter = { ...allTime, id: 'p1', kind: 'season', name: 'Winter 2026' };
const row = (rank: number, displayName: string, points: number, you = false) => ({
  rank,
  displayName,
  points,
  wins: 1,
  solves: 2,
  matches: 3,
  you,
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
    expect(rowsOf('team-board')).toEqual(['1 Winter44']);
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

describe('the profile', () => {
  it('shows the numbers, boards, last rounds and staff adjustments', async () => {
    serve({
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
    });
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
    expect(rowsOf('profile-recent')).toEqual(['Friday fun20 October 2026not solved0Verify']);
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

const seed = 'cd'.repeat(32);
const sha = createHash('sha256').update(Buffer.from(seed, 'hex')).digest('hex');

function proofAnswer(commitment: string) {
  return {
    ok: true,
    secrets: { mode: 'individual', byPlayer: { w: 412, a: 77 } },
    events: [
      {
        type: 'RoundCreated',
        roundId: 'r1',
        season: 'winter',
        commitment,
        config: { secretMode: 'individual' },
        gameConfig: { rangeLow: 1, rangeHigh: 1000 },
      },
      {
        type: 'CountdownStarted',
        roster: [
          { playerId: 'w', team: 'winter' },
          { playerId: 'a', team: null },
        ],
      },
      { type: 'GuessAccepted', playerId: 'a', receiveSeq: 2, receivedAt: 2, action: { value: 80 } },
      { type: 'GuessAccepted', playerId: 'w', receiveSeq: 1, receivedAt: 1, action: { value: 9 } },
      { type: 'RoundEnded', seed, reason: 'allSolved' },
    ],
  };
}

describe('the verification page', () => {
  it('confirms a matching seed, names the secrets and lists the guesses in receive order', async () => {
    serve({
      '/rounds/r1/verify': [200, proofAnswer(sha)],
      '/rounds/r1/result': [200, { names: { w: 'Walter', a: 'Anna' } }],
    });
    await show(<VerifyPage roundId="r1" />);
    expect(screen.getByTestId('seed-check').textContent).toBe(
      'The seed matches the commitment published before the round.',
    );
    expect(screen.getByTestId('commitment').textContent).toBe(sha);
    expect(screen.getByTestId('secrets').textContent).toBe('Walter: 412Anna: 77');
    expect(screen.getByTestId('roster').textContent).toContain('Walter');
    expect(rowsOf('guesses')).toEqual(['1Walter9', '2Anna80']);
    expect(screen.getByRole('button', { name: 'Download the proof' })).toBeTruthy();
  });

  it('reports a seed that does not match the commitment', async () => {
    serve({ '/rounds/r1/verify': [200, proofAnswer('00'.repeat(32))] });
    await show(<VerifyPage roundId="r1" />);
    const check = screen.getByTestId('seed-check');
    expect(check.textContent).toMatch(/does not match/);
    expect(check.dataset['ok']).toBe('false');
  });

  it('words a round without a proof', async () => {
    serve({ '/rounds/r2/verify': [409, { code: 'NO_PROOF' }] });
    await show(<VerifyPage roundId="r2" />);
    expect(screen.getByRole('alert').textContent).toMatch(/without a fairness proof/);
  });
});
