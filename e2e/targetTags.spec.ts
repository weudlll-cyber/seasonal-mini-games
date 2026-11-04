/**
 * @file   e2e/targetTags.spec.ts
 * @module e2e
 * @brief  Journey 34: Seasonal Target with 20 bots: tags on the grid, a hovered row highlights.
 *
 * Responsibility: a shared summer round on the 20 × 20 grid with 20 Quick Test bots and the
 *                 viewer: once 15 tiles or more are guessed, the tiles carry their first
 *                 guesser's tag at 1280 × 720 (30 px tiles); hovering another player's list
 *                 row makes only that player's tiles bright, every other guessed tile faded,
 *                 and the bright tiles show the row's tag; leaving the row clears it; the info
 *                 column is wider than 340 px beside the full-height grid (O62). The match is
 *                 aborted.
 * Depends on:     @playwright/test, ./guessGames, ./play
 * Spec:           docs/spec/09-testing-strategy.md §4 (journey 34); docs/spec/02d-game-seasonal-target.md §11
 */
import { expect, test } from '@playwright/test';

import { direct, WIDE } from './guessGames.js';
import { abortMatch, closeAll, person } from './play.js';

test('journey 34: Seasonal Target with 20 players, a hovered row highlights its tiles', async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const p = await person(browser, 'player-1', WIDE);
  let code = '';
  try {
    code = (
      await direct(p, {
        gameId: 'seasonal-target',
        season: 'summer',
        bots: 20,
        cooldownS: 3,
        // Each bot's first guess at once, then a minute's pause: a busy grid, no early win (T154).
        botDelayS: 60,
        settings: { 'target.size': 20, 'target.feedback': 'closeness' },
      })
    ).matchCode;
    const page = p.page;
    const guessed = page.locator('[data-testid="tile"][data-who]');
    await expect.poll(() => guessed.count(), { timeout: 60_000 }).toBeGreaterThanOrEqual(15);
    await expect(guessed.first().locator('.smg-mark-tag')).toBeVisible();
    // The column beside the square grid takes the free room (O62's review).
    const grid = await page.getByTestId('tile-grid').boundingBox();
    const column = await page.locator('.round-column').boundingBox();
    expect(column?.width ?? 0).toBeGreaterThan(340);
    expect(grid?.height ?? 0).toBeGreaterThan(600);
    // Another player's row: hovering it lights their tiles only.
    const row = page
      .getByTestId('guess-list')
      .locator('li[data-own="false"]')
      .filter({ has: page.locator('.smg-mark-tag') })
      .first();
    const tag = (await row.locator('.smg-mark-tag').textContent()) ?? '';
    await row.hover();
    const on = page.locator('[data-testid="tile"][data-hl="on"]');
    await expect(on.first()).toBeVisible();
    const counts = await page.evaluate(() => ({
      on: document.querySelectorAll('[data-testid="tile"][data-hl="on"]').length,
      off: document.querySelectorAll('[data-testid="tile"][data-hl="off"]').length,
      guessed: document.querySelectorAll('[data-testid="tile"][data-who]').length,
    }));
    expect(counts.on + counts.off).toBe(counts.guessed);
    expect(counts.off).toBeGreaterThan(0);
    for (const t of await on.locator('.smg-mark-tag').allTextContents()) expect(t).toBe(tag);
    await page.mouse.move(1, 1);
    await expect(page.locator('[data-testid="tile"][data-hl]')).toHaveCount(0);
  } finally {
    if (code !== '') await abortMatch(p, code);
    await closeAll([p]);
  }
});
