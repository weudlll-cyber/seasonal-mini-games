/**
 * @file   e2e/target.spec.ts
 * @module e2e
 * @brief  Journey 22: Seasonal Target through the lobby on its tile grid, two answer modes, one screen.
 *
 * Responsibility: a shared spring round from the Quick Test form through the lobby on the
 *                 20 × 20 tile grid (O45): the intro names the grid, Spring's quarter is tinted
 *                 on the grid; a click selects a tile, an arrow button and an arrow key move
 *                 the selection, its coordinates show as text, Guess sends and the own tile and
 *                 row appear with the distance only (O43's default): the tile filled in its
 *                 closeness colour, framed as the viewer's, with its distance; then an
 *                 individual autumn round with closeness only (O43): the row has no distance,
 *                 the own tile its colour but no number, and fallen tiles are hatched. Each
 *                 round view fits 1280 × 720 and 390 × 844, the grid left of the list on the
 *                 desktop (T123). The matches are aborted.
 * Depends on:     @playwright/test, ./guessGames, ./play
 * Spec:           docs/spec/09-testing-strategy.md §4 (journey 22); docs/spec/02d-game-seasonal-target.md
 */
import { expect, test } from '@playwright/test';

import { direct, fitsBoth, fromLobby, WIDE } from './guessGames.js';
import { abortMatch, closeAll, ownRows, person, roundOpen } from './play.js';

// Distance only, the default (O43): the cells away and no compass direction.
const DISTANCE = /^\d+ away$|correct/;

test('journey 22: Seasonal Target, distance only (the default) and closeness only', async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const p = await person(browser, 'player-1', WIDE);
  const codes: string[] = [];
  const own = p.page.locator('[data-testid="tile"][data-own="true"]');
  try {
    codes.push(await fromLobby(p, 'seasonal-target', 'spring'));
    await expect(p.page.getByTestId('intro-secret')).toHaveText('Shared target on a 20 × 20 grid');
    await roundOpen(p.page);
    await expect(p.page.locator('[data-testid="tile"][data-quarter="true"]').first()).toBeVisible();
    // The grid on the left of the list (the board layout).
    const grid = await p.page.getByTestId('tile-grid').boundingBox();
    const list = await p.page.locator('.round-log').boundingBox();
    expect((grid?.x ?? 0) < (list?.x ?? 0)).toBe(true);
    // Select by click, move by button and key; the coordinates as text.
    const selected = p.page.getByTestId('selected');
    await p.page.locator('[data-testid="tile"][data-x="3"][data-y="3"]').click();
    await expect(selected).toHaveText('Selected: column 3, row 3');
    await p.page.getByRole('button', { name: /Move south/i }).click();
    await expect(selected).toHaveText('Selected: column 3, row 4');
    await p.page.getByTestId('tile-grid').press('ArrowRight');
    await expect(selected).toHaveText('Selected: column 4, row 4');
    await p.page.getByTestId('guess-button').click();
    await expect(ownRows(p.page).first().locator('.round-answer')).toHaveText(DISTANCE, {
      timeout: 10_000,
    });
    // The own tile: its colour step, its frame and its distance.
    await expect(own).toHaveCount(1);
    await expect(own).toHaveAttribute('data-step', /^[1-5]$|correct/);
    await expect(own).toHaveText(/\d/);
    await fitsBoth(p.page);

    // Individual, autumn, closeness only: no distance in the answer or on the tile; tiles fall.
    const started = await direct(p, {
      gameId: 'seasonal-target',
      mode: 'individual',
      season: 'autumn',
      settings: { 'target.feedback': 'closeness' },
    });
    codes.push(started.matchCode);
    await p.page.getByTestId('guess-button').click();
    const answer = ownRows(p.page).first().locator('.round-answer');
    await expect(answer).not.toHaveText('', { timeout: 10_000 });
    await expect(answer).not.toHaveText(/away/);
    await expect(own).toHaveAttribute('data-step', /^[1-5]$|correct/);
    await expect(own).not.toHaveText(/\d/);
    await expect(p.page.locator('[data-testid="tile"][data-fallen="true"]').first()).toBeVisible({
      timeout: 20_000,
    });
    await fitsBoth(p.page);
  } finally {
    for (const code of codes) await abortMatch(p, code);
    await closeAll([p]);
  }
});
