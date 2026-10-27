/**
 * @file   e2e/boards.spec.ts
 * @module e2e
 * @brief  Journey 12: points of two matches add up on the season board, teams beside, profile
 *         and verification page; aborting the matches takes the points back.
 *
 * Responsibility: four accounts (host and players 1–3, the minimum for league points, O11)
 *                 play one shared round in each of two counting matches; the season board
 *                 then holds 20 more points for them (10 per round to its winner, 02 §9) and
 *                 the team board beside it two more round wins (O12); the board page shows both
 *                 side by side on a desktop, a name leads to the profile, and the result's
 *                 "Verify this round" opens the verification page, which checks the seed against
 *                 the commitment in the browser (O9). The matches are aborted at the end, which
 *                 takes their points back (DECISIONS T70): the boards are as before.
 * Depends on:     @playwright/test, ./play
 * Spec:           docs/spec/09-testing-strategy.md §4 (journey 12); docs/spec/02-game-guess-the-number.md §9, §10
 */
import { expect, test } from '@playwright/test';

import {
  abortMatch,
  call,
  closeAll,
  hostRound,
  openMatch,
  person,
  search,
  type Person,
} from './play.js';

interface Row {
  readonly displayName: string;
  readonly points: number;
}

const NAMES = ['dev-host', 'dev-player-1', 'dev-player-2', 'dev-player-3'];

// The season board's id and the four accounts' points and the teams' wins on it.
async function seasonTotals(p: Person) {
  const { periods } = await call<{ periods: { id: string; kind: string }[] }>(
    p,
    'GET',
    '/leaderboards',
  );
  const season = periods.find((x) => x.kind === 'season');
  if (season === undefined) return { id: null, points: 0, teamWins: 0 };
  const board = await call<{ rows: Row[] }>(p, 'GET', `/leaderboards/${season.id}?offset=0`);
  const teams = await call<{ rows: { wins: number }[] }>(
    p,
    'GET',
    `/leaderboards/${season.id}/teams`,
  );
  return {
    id: season.id,
    points: board.rows
      .filter((r) => NAMES.includes(r.displayName))
      .reduce((s, r) => s + r.points, 0),
    teamWins: teams.rows.reduce((s, t) => s + t.wins, 0),
  };
}

// One counting match with one shared round played to its end from the screen.
async function playMatch(host: Person, players: readonly Person[], title: string): Promise<string> {
  const code = await openMatch(host, players, title);
  await hostRound(host, { Cooldown: '3', 'Highest number': '30', Secret: 'shared' });
  await Promise.all([host, ...players].map((p) => search(p)));
  for (const p of [host, ...players]) await expect(p.page.getByTestId('result')).toBeVisible();
  return code;
}

test('journey 12: two matches add up on the season board with the team board beside it', async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const host = await person(browser, 'host');
  const players = [
    await person(browser, 'player-1'),
    await person(browser, 'player-2'),
    await person(browser, 'player-3'),
  ];
  const before = await seasonTotals(host);
  const codes: string[] = [];
  try {
    codes.push(await playMatch(host, players, 'journey 12 a'));
    // The result names the match standings and leads to the round's verification page.
    await expect(host.page.getByTestId('match-standings')).toContainText('10');
    // The link sits in the result's "Fairness proof" disclosure, as a person finds it.
    await host.page.getByTestId('proof').getByText('Fairness proof').click();
    await host.page.getByRole('link', { name: 'Verify this round' }).click();
    await expect(host.page.getByTestId('seed-check')).toHaveText(
      'The seed matches the commitment published before the round.',
    );
    await expect(host.page.getByTestId('guesses')).toBeVisible();
    codes.push(await playMatch(host, players, 'journey 12 b'));
    const after = await seasonTotals(host);
    expect(after.points - (after.id === before.id ? before.points : 0)).toBe(20);
    expect(after.teamWins - (after.id === before.id ? before.teamWins : 0)).toBe(2);

    await host.page.goto(`./#/leaderboard/${after.id ?? ''}`);
    const board = host.page.getByTestId('board');
    await expect(board).toContainText('dev-player-1');
    const teams = host.page.getByTestId('team-board');
    await expect(teams).toBeVisible();
    // Beside it on a desktop: the team board starts to the right of the player board.
    const [b, t] = [await board.boundingBox(), await teams.boundingBox()];
    expect((t?.x ?? 0) > (b?.x ?? 0) + (b?.width ?? 0) / 2, 'team board beside').toBe(true);
    await board.getByRole('link', { name: 'dev-player-2' }).click();
    await expect(host.page.getByTestId('profile')).toContainText('dev-player-2');
    await expect(host.page.getByTestId('profile-boards')).toBeVisible();
  } finally {
    for (const code of codes) await abortMatch(host, code);
    await closeAll([host, ...players]);
  }
  // Aborted matches take their points back (T70).
  const cleanup = await person(browser, 'host');
  const end = await seasonTotals(cleanup);
  expect(end.points).toBe(end.id === before.id ? before.points : 0);
  await closeAll([cleanup]);
});
