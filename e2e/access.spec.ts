/**
 * @file   e2e/access.spec.ts
 * @module e2e
 * @brief  Journey 9: accessibility — axe on lobby, round and result; guessing by keyboard only.
 *
 * Responsibility: no serious or critical axe violation (WCAG 2.2 AA rules) on the lobby, a
 *                 running round and its result; a player reaches the guess field with Tab,
 *                 types a number and sends it with Enter, without a mouse (02 §12).
 * Depends on:     @playwright/test, @axe-core/playwright, ./play
 * Spec:           docs/spec/09-testing-strategy.md §4 (journey 9); docs/spec/02-game-guess-the-number.md §12
 */
import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { abortMatch, call, closeAll, hostMenu, person } from './play.js';

async function noSeriousViolations(page: Page, where: string): Promise<void> {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const serious = result.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
  expect(serious, `axe on the ${where}`).toEqual([]);
}

test('journey 9: lobby, round and result pass axe; a guess by keyboard only', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const p = await person(browser, 'player-1');
  await noSeriousViolations(p.page, 'lobby');
  const started = await call<{ matchCode: string }>(p, 'POST', '/dev/quicktest', {
    bots: 1,
    cooldownS: 3,
    rangeHigh: 1_000_000,
    fast: false,
  });
  try {
    await p.page.goto(`./#/match/${started.matchCode}`);
    const input = p.page.getByTestId('guess-input');
    await expect(p.page.getByTestId('guess-button')).toBeEnabled({ timeout: 10_000 });
    await noSeriousViolations(p.page, 'round');
    // Keyboard only: Tab until the guess field has the focus, type, Enter.
    for (
      let i = 0;
      i < 60 && !(await input.evaluate((el) => el === document.activeElement));
      i += 1
    ) {
      await p.page.keyboard.press('Tab');
    }
    await expect(input).toBeFocused();
    await p.page.keyboard.type('10');
    await p.page.keyboard.press('Enter');
    await expect(p.page.getByTestId('own-guesses')).toContainText('10');
    // The Quick Test player hosts the round: End round in the host menu brings the result.
    await hostMenu(p);
    await p.page.getByTestId('end-round').click();
    await expect(p.page.getByTestId('result')).toBeVisible({ timeout: 10_000 });
    await noSeriousViolations(p.page, 'result');
  } finally {
    await abortMatch(p, started.matchCode);
    await closeAll([p]);
  }
});
