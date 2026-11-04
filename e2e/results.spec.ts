/**
 * @file   e2e/results.spec.ts
 * @module e2e
 * @brief  Journey 28: each game's result page under the slim bar, its first part on one screen.
 *
 * Responsibility: for Guess The Number, Safecracker, Bomb Defusal and Seasonal Target a round
 *                 started at once and ended by the host: the result page has the slim game bar
 *                 instead of the app header, at 1280 × 720 and 390 × 844, and its first part
 *                 (headline of at most two lines, the game's result, the top three placings,
 *                 the team line) ends inside the screen; the standings follow below it, where
 *                 the page may scroll (T145, O54). The matches are aborted.
 * Depends on:     @playwright/test, ./guessGames, ./play, ./screens
 * Spec:           docs/spec/09-testing-strategy.md §4 (journey 28); docs/spec/02-game-guess-the-number.md §9
 */
import { expect, test, type Page } from '@playwright/test';

import { direct, WIDE } from './guessGames.js';
import { abortMatch, closeAll, hostMenu, person, roundOpen } from './play.js';
import { PHONE } from './screens.js';

// The first part inside the screen, the headline at most two lines, the bar not the header.
async function firstPartFits(page: Page): Promise<void> {
  await expect(page.locator('.shell-bar')).toBeHidden();
  await expect(page.getByTestId('result-bar')).toBeVisible();
  const first = page.getByTestId('result-first');
  await expect(first).toBeVisible();
  const fit = await first.evaluate((el) => {
    const h1 = el.querySelector('h1');
    const lines =
      h1 === null
        ? 0
        : h1.getBoundingClientRect().height / parseFloat(getComputedStyle(h1).lineHeight);
    return { bottom: el.getBoundingClientRect().bottom, inner: window.innerHeight, lines };
  });
  expect(fit.bottom, 'the first part ends inside the screen').toBeLessThanOrEqual(fit.inner + 1);
  expect(Math.round(fit.lines), 'the headline').toBeLessThanOrEqual(2);
}

for (const gameId of ['guess-the-number', 'safecracker', 'bomb-defusal', 'seasonal-target']) {
  test(`journey 28 (${gameId}): the result's first part fits one screen`, async ({ browser }) => {
    test.setTimeout(90_000);
    const p = await person(browser, 'player-1', WIDE);
    let code = '';
    try {
      code = (await direct(p, { gameId, season: 'summer', cooldownS: 30 })).matchCode;
      await roundOpen(p.page);
      await hostMenu(p);
      await p.page.getByTestId('host-console').getByTestId('end-round').click();
      await expect(p.page.getByTestId('result')).toBeVisible({ timeout: 15_000 });
      await firstPartFits(p.page);
      await p.page.setViewportSize(PHONE);
      await p.page.reload();
      await expect(p.page.getByTestId('result')).toBeVisible({ timeout: 15_000 });
      await firstPartFits(p.page);
    } finally {
      if (code !== '') await abortMatch(p, code);
      await closeAll([p]);
    }
  });
}
