/**
 * @file   apps/web/src/boards/fakes.tsx
 * @module web/boards
 * @brief  The boards' tests' fakes: a served API, the page shown with a session, board rows.
 *
 * Responsibility: `serve` answers the API by path (the session signed in as Anna) and returns
 *                 the paths asked; `show` renders a page inside the session and lets its loads
 *                 settle; `rowsOf` reads a table's rows; the all-time and a season's period and
 *                 a board row. Split out of the former boards.test so each test file keeps to
 *                 one subject (night 7).
 * Depends on:     vitest, @testing-library/react, ../shell/session
 * Used by:        ./leaderboard.test, ./profile.test, ./verify.test
 * Spec:           docs/spec/09-testing-strategy.md §2
 */
import { act, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { vi } from 'vitest';

import { SessionProvider } from '../shell/session.js';

export type Answer = readonly [status: number, body: unknown];

// Answers by path after /api/v1, query included; the session is signed in as Anna.
export function serve(routes: Readonly<Record<string, Answer>>): string[] {
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

export async function show(page: ReactElement): Promise<void> {
  render(<SessionProvider>{page}</SessionProvider>);
  // Let the loads and the browser's hash settle.
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

export const rowsOf = (testId: string) =>
  [...screen.getByTestId(testId).querySelectorAll('tbody tr')].map((tr) => tr.textContent);

export const allTime = {
  id: 'p0',
  kind: 'all_time',
  name: 'All time',
  startsAt: 0,
  endsAt: null,
  status: 'active',
};
export const winter = { ...allTime, id: 'p1', kind: 'season', name: 'Winter 2026' };
export const row = (rank: number, displayName: string, points: number, you = false) => ({
  rank,
  displayName,
  points,
  wins: 1,
  solves: 2,
  matches: 3,
  you,
});
