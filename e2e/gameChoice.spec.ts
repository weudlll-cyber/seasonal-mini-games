/**
 * @file   e2e/gameChoice.spec.ts
 * @module e2e
 * @brief  Journey 23: the host chooses the game (O41); every screen names the match's game.
 *
 * Responsibility: the create-match form offers the four games with a help line and opens a
 *                 public match of the chosen one; the match page and the Play list name its
 *                 game; ended at once, its summary names it too. The Quick
 *                 Test form shows only the chosen game's own settings (Guess The Number's range
 *                 for it alone, Bomb Defusal's wires and cuts for it alone).
 * Depends on:     @playwright/test, ./play
 * Spec:           docs/spec/09-testing-strategy.md §4 (journey 23); docs/spec/02-game-guess-the-number.md §2
 */
import { expect, test } from '@playwright/test';

import { attempt, call, closeAll, person } from './play.js';

const GAMES = [
  'Guess The Number',
  'Seasonal Safecracker',
  'Seasonal Bomb Defusal',
  'Seasonal Target',
];

test('journey 23: the game is chosen when the match is opened, and named everywhere', async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const p = await person(browser, 'host');
  // Its own title, so the Play list shows exactly this match; closed at the end.
  const title = `e2e game choice ${String(Date.now())}`;
  let code = '';
  try {
    // The create-match form: the four games, a help line, the chosen one opened.
    await p.page.goto('./');
    const form = p.page.getByTestId('open-match');
    const choice = form.getByTestId('match-game');
    await expect(choice.locator('option')).toHaveText(GAMES);
    await expect(form.getByText('Every round of the match is this game')).toBeVisible();
    await choice.selectOption('safecracker');
    await form.getByTestId('match-title').fill(title);
    await form.getByRole('button', { name: 'Open match' }).click();
    await expect(p.page.getByTestId('match-game')).toHaveText('Seasonal Safecracker');
    code = /#\/match\/(\w+)/.exec(p.page.url())?.[1] ?? '';
    // The Play list names it.
    await p.page.goto('./');
    const row = p.page.getByTestId('matches').locator('li', { hasText: title });
    await expect(row.getByTestId('match-game-name')).toContainText('Seasonal Safecracker');
    // Ended at once (End match's request): the summary names it.
    await call(p, 'POST', `/matches/${code}/close`, {});
    await p.page.goto(`./#/match/${code}`);
    const summary = p.page.getByTestId('match-summary');
    await expect(summary.getByTestId('match-game')).toHaveText('Seasonal Safecracker');

    // The Quick Test form: only the chosen game's own settings.
    await p.page.goto('./#/quick-test');
    const quick = p.page.getByTestId('quick-test');
    await expect(quick.getByTestId('quick-game')).toHaveValue('guess-the-number');
    await expect(quick.getByLabel('Lowest number').and(quick.locator('input'))).toHaveCount(1);
    await expect(quick.getByLabel('Wires').and(quick.locator('input'))).toHaveCount(0);
    await quick.getByTestId('quick-game').selectOption('bomb-defusal');
    await expect(quick.getByLabel('Wires').and(quick.locator('input'))).toHaveCount(1);
    await expect(quick.getByLabel('Cuts').and(quick.locator('input'))).toHaveCount(1);
    await expect(quick.getByLabel('Lowest number').and(quick.locator('input'))).toHaveCount(0);
  } finally {
    // Closed already when the test got that far; a second close changes nothing.
    if (code !== '') await attempt(p, 'POST', `/matches/${code}/close`, {});
    await closeAll([p]);
  }
});
