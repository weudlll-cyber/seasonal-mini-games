/**
 * @file   e2e/rounds.spec.ts
 * @module e2e
 * @brief  Journeys 1 and 2: a shared round of two players and a host; an individual round of three.
 *
 * Responsibility: journey 1 — the host creates and starts a shared round (cooldown 3 s), Guess
 *                 waits for the open and for the cooldown, both players search from what the
 *                 screen shows, one wins, both see the result with the revealed secret; one
 *                 player plays on a 390 × 844 screen. Journey 2 — an individual round: placings
 *                 follow the solve order, a solved player can guess no more, the round ends with
 *                 "time is up" and a "not solved" row for the player who did not play.
 * Depends on:     @playwright/test, ./play, ./screens
 * Spec:           docs/spec/09-testing-strategy.md §4 (journeys 1, 2); docs/spec/02-game-guess-the-number.md §4–§9
 */
import { expect, test } from '@playwright/test';

import {
  abortMatch,
  closeAll,
  fitsScreen,
  hostRound,
  openMatch,
  ownRows,
  person,
  search,
} from './play.js';
import { PHONE } from './screens.js';

test('journey 1: a shared round from start to result, also on a phone', async ({ browser }) => {
  const host = await person(browser, 'host');
  const one = await person(browser, 'player-1');
  const two = await person(browser, 'player-2', PHONE);
  const code = await openMatch(host, [one, two], 'journey 1');
  try {
    await hostRound(host, {
      Cooldown: '3',
      // Long enough that a slow browser still sees the countdown hold Guess.
      'Countdown before opening': '8',
      'Highest number': '30',
      Secret: 'shared',
    });
    for (const p of [one, two]) {
      await expect(p.page.getByTestId('round-banner')).toBeVisible();
      await expect(p.page.getByTestId('guess-button')).toBeDisabled();
    }
    await expect(one.page.getByTestId('guess-button')).toBeEnabled({ timeout: 15_000 });
    // The cooldown ring holds Guess after an accepted guess (02 §7).
    await one.page.getByTestId('guess-input').fill('15');
    await one.page.getByTestId('guess-button').click();
    await expect(ownRows(one.page).first()).toContainText('15');
    // The closeness comment under the guess (O21), in smaller text on its own line.
    await expect(ownRows(one.page).first().locator('.round-comment')).not.toBeEmpty();
    await expect(one.page.getByTestId('guess-button')).toBeDisabled();
    // The round view is one screen on the phone (02 §12).
    await fitsScreen(two.page);
    await Promise.all([search(one), search(two)]);
    for (const p of [one, two, host]) {
      await expect(p.page.getByTestId('result')).toBeVisible();
      await expect(p.page.getByTestId('secret')).toHaveText(/^\d+$/);
      await expect(p.page.getByTestId('result').getByRole('heading', { level: 1 })).toContainText(
        'found it first',
      );
    }
    const width = await two.page.evaluate(() => document.documentElement.scrollWidth);
    expect(width, 'no sideways scrolling at 390 px').toBeLessThanOrEqual(PHONE.width);
  } finally {
    await abortMatch(host, code);
    await closeAll([host, one, two]);
  }
});

test('journey 2: an individual round places solvers in order and ends with time up', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const host = await person(browser, 'host');
  const players = [
    await person(browser, 'player-1'),
    await person(browser, 'player-2'),
    await person(browser, 'player-3'),
  ];
  const code = await openMatch(host, players, 'journey 2');
  try {
    await hostRound(host, {
      Secret: 'individual',
      Cooldown: '3',
      'Countdown before opening': '3',
      'Longest round': '1',
      'Highest number': '20',
    });
    const [one, two, idle] = players;
    if (one === undefined || two === undefined || idle === undefined)
      throw new Error('three players');
    // Player 1 solves before player 2 starts, so the solve order is known.
    await expect(one.page.getByTestId('guess-button')).toBeEnabled({ timeout: 10_000 });
    await search(one);
    // Solved: no enabled Guess button is left (the form may be gone altogether).
    await expect(one.page.locator('[data-testid="guess-button"]:enabled')).toHaveCount(0);
    await search(two);
    for (const p of [one, two, idle, host])
      await expect(p.page.getByTestId('result')).toBeVisible({ timeout: 90_000 });
    const rows = await host.page.getByTestId('placings').locator('tbody tr').allTextContents();
    expect(rows[0]).toMatch(/^1\s*dev-player-1/);
    expect(rows[1]).toMatch(/^2\s*dev-player-2/);
    // The host plays too (O16) and, like player 3, did not guess.
    expect(rows.slice(2).sort()).toEqual([
      expect.stringMatching(/^not solved\s*dev-host/),
      expect.stringMatching(/^not solved\s*dev-player-3/),
    ]);
    await expect(host.page.getByTestId('result').getByRole('heading', { level: 1 })).toHaveText(
      'Time is up.',
    );
  } finally {
    await abortMatch(host, code);
    await closeAll([host, ...players]);
  }
});
