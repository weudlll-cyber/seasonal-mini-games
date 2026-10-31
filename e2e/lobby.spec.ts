/**
 * @file   e2e/lobby.spec.ts
 * @module e2e
 * @brief  Journey 12: the Quick Test through the lobby, from the form to the result.
 *
 * Responsibility: the player starts the Quick Test from its form with "Start from the lobby"
 *                 on (O24) and lands in the waiting area (O23); the bots join one after another
 *                 and show as here with a team; the player picks a team, which shows pressed;
 *                 the host menu starts the round with the normal Start; the
 *                 round runs with the bots playing; the result names the closest miss (O22),
 *                 or the margin when a second correct guess came in its window; and the
 *                 waiting area for the next round follows the result.
 * Depends on:     @playwright/test, ./play
 * Spec:           docs/spec/09-testing-strategy.md §4 (journey 12); docs/spec/02-game-guess-the-number.md §2, §9
 */
import { expect, test } from '@playwright/test';

import { abortMatch, closeAll, hostMenu, person, search } from './play.js';

test('journey 12: the Quick Test through the lobby, bots, a team, the start and the result', async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const p = await person(browser, 'player-1');
  let code = '';
  try {
    await p.page.goto('./#/quick-test');
    const form = p.page.getByTestId('quick-test');
    await expect(form.getByTestId('quick-lobby')).toBeChecked();
    await form.getByTestId('seed').fill('acorn');
    await form.getByLabel('Lowest number').and(form.locator('input')).fill('1');
    await form.getByLabel('Highest number').and(form.locator('input')).fill('100');
    await form.getByTestId('start-quick-test').click();
    await expect(p.page.getByTestId('waiting-area')).toBeVisible();
    code = /#\/match\/(\w+)/.exec(p.page.url())?.[1] ?? '';
    // The bots arrive one after another, each with a team.
    const players = p.page.getByTestId('match-players');
    for (const bot of ['bot-01', 'bot-02', 'bot-03'])
      await expect(players).toContainText(`${bot} here`, { timeout: 10_000 });
    await expect(players.locator('li svg, li img')).toHaveCount(3);
    const summer = p.page
      .getByRole('group', { name: 'Season team' })
      .getByRole('button', { name: 'Summer' });
    await summer.click();
    await expect(summer).toHaveAttribute('aria-pressed', 'true');
    await expect(p.page.getByTestId('waiting-state')).toContainText('set up');
    // The normal Start in the host menu.
    await hostMenu(p);
    await p.page.getByTestId('host-console').getByTestId('start-round').click();
    await expect(p.page.getByTestId('round-banner')).toBeVisible();
    await search(p);
    const result = p.page.getByTestId('result');
    await expect(result).toBeVisible({ timeout: 60_000 });
    // The closest miss, unless a second correct guess set the margin (O13, O22).
    if ((await result.getByTestId('margin').count()) === 0) {
      await expect(result.getByTestId('closest-miss')).toHaveText(
        /^(.+ missed by just [12] \(\d+\)\.|Closest miss: .+, \d+ away \(\d+\)\.)$/,
      );
    }
    await expect(p.page.getByTestId('waiting-area')).toContainText('Next round');
  } finally {
    if (code !== '') await abortMatch(p, code);
    await closeAll([p]);
  }
});
