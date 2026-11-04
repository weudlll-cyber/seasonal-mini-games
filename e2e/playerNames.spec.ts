/**
 * @file   e2e/playerNames.spec.ts
 * @module e2e
 * @brief  Journey 35: a 24-character name whole in "Next round" → Players at 1280 × 720.
 *
 * Responsibility: after a Quick Test round the waiting area beside the result lists the
 *                 players with the team as its icon under "Team" (named, T212); the longest
 *                 allowed display name (24 characters), written into a row's name, is not cut
 *                 there at 1280 × 720 (its scroll width within its box). The match is aborted.
 * Depends on:     @playwright/test, ./guessGames, ./play
 * Spec:           docs/spec/09-testing-strategy.md §4 (journey 35); docs/spec/02-game-guess-the-number.md §2
 */
import { expect, test } from '@playwright/test';

import { direct, WIDE } from './guessGames.js';
import { abortMatch, closeAll, hostMenu, person } from './play.js';

// The longest display name an account may have (3–24 characters).
const LONG = 'Maximilian_Wolfgang_Ob24';

test('journey 35: a 24-character name whole in "Next round" → Players', async ({ browser }) => {
  test.setTimeout(90_000);
  const p = await person(browser, 'player-1', WIDE);
  let code = '';
  try {
    code = (await direct(p, { gameId: 'guess-the-number', season: 'summer', cooldownS: 30 }))
      .matchCode;
    await hostMenu(p);
    await p.page.getByTestId('host-console').getByTestId('end-round').click();
    await expect(p.page.getByTestId('result')).toBeVisible({ timeout: 15_000 });
    await p.page.keyboard.press('Escape');
    const list = p.page.getByTestId('match-players');
    await expect(list.getByRole('img', { name: /^Team / }).first()).toBeVisible();
    const fit = await list.evaluate((ul, long) => {
      const name = [...ul.querySelectorAll<HTMLElement>('.player-name')].at(-1);
      if (name === undefined) return null;
      name.textContent = long;
      return { scroll: name.scrollWidth, client: name.clientWidth };
    }, LONG);
    expect(fit, 'a row with a name').not.toBeNull();
    expect(fit?.scroll ?? 1, 'the 24-character name whole').toBeLessThanOrEqual(fit?.client ?? 0);
  } finally {
    if (code !== '') await abortMatch(p, code);
    await closeAll([p]);
  }
});
