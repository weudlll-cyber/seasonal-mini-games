/**
 * @file   e2e/target.spec.ts
 * @module e2e
 * @brief  Journey 22: Seasonal Target through the lobby, both answer modes, its specials, one screen.
 *
 * Responsibility: a shared spring round from the Quick Test form through the lobby: the intro
 *                 names the map, Spring's quarter shows on the map; a click selects a cell, an
 *                 arrow button and an arrow key move it, its coordinates show as text, Guess
 *                 sends and the own dot and row appear with distance and direction (O39's
 *                 default); then an individual autumn round with closeness only (O39): the row
 *                 has no distance, and cells fall and show on the map. Each round view fits
 *                 1280 × 720 and 390 × 844, the map left of the list on the desktop (T123). The
 *                 matches are aborted.
 * Depends on:     @playwright/test, ./guessGames, ./play
 * Spec:           docs/spec/09-testing-strategy.md §4 (journey 22); docs/spec/02d-game-seasonal-target.md
 */
import { expect, test } from '@playwright/test';

import { direct, fitsBoth, fromLobby, WIDE } from './guessGames.js';
import { abortMatch, closeAll, ownRows, person, roundOpen } from './play.js';

const DIRECTION = /\d+ away, (N|NE|E|SE|S|SW|W|NW)|correct/;

test('journey 22: Seasonal Target, distance and direction, closeness only', async ({ browser }) => {
  test.setTimeout(150_000);
  const p = await person(browser, 'player-1', WIDE);
  const codes: string[] = [];
  try {
    codes.push(await fromLobby(p, 'seasonal-target', 'spring'));
    await expect(p.page.getByTestId('intro-secret')).toHaveText('Shared target on a 50 × 50 map');
    await roundOpen(p.page);
    await expect(p.page.getByTestId('map-quarter')).toBeVisible();
    // The map on the left of the list (the board layout).
    const map = await p.page.getByTestId('map').boundingBox();
    const list = await p.page.locator('.round-log').boundingBox();
    expect((map?.x ?? 0) < (list?.x ?? 0)).toBe(true);
    // Select by click, move by button and key; the coordinates as text.
    const selected = p.page.getByTestId('selected');
    await p.page.getByTestId('map').click({ position: { x: 20, y: 20 } });
    const clicked = await selected.textContent();
    await p.page.getByRole('button', { name: /Move south/i }).click();
    await expect(selected).not.toHaveText(clicked ?? '');
    await p.page.getByTestId('map').press('ArrowRight');
    await expect(selected).toHaveText(/column \d+, row \d+/);
    await p.page.getByTestId('guess-button').click();
    await expect(ownRows(p.page).first().locator('.round-answer')).toHaveText(DIRECTION, {
      timeout: 10_000,
    });
    await expect(p.page.locator('[data-testid="map-dot"][data-own="true"]')).toHaveCount(1);
    await fitsBoth(p.page);

    // Individual, autumn, closeness only: no distance in the answer; cells fall.
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
    await expect(p.page.getByTestId('map-fallen').first()).toBeVisible({ timeout: 20_000 });
    await fitsBoth(p.page);
  } finally {
    for (const code of codes) await abortMatch(p, code);
    await closeAll([p]);
  }
});
