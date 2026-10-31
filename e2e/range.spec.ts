/**
 * @file   e2e/range.spec.ts
 * @module e2e
 * @brief  Journeys 10 and 11: a hidden range, and a range with negative bounds.
 *
 * Responsibility: journey 10 (1280 × 720) — with the range hidden the round view says "Any
 *                 whole number", no bound is anywhere on the page, a guess far outside the
 *                 range is accepted and answered, and the result reveals the range (O19,
 *                 DECISIONS T52, T53). Journey 11 (390 × 844) — the Quick Test form takes
 *                 "-500" typed key by key into Lowest number and starts a round from −500 to
 *                 500, the range is shown, the ± button turns a typed number negative, the
 *                 guess is answered, and the round plays to its result (O18). Both check that the round view fits
 *                 the screen without a page scrollbar (02 §12) and that every text on it keeps
 *                 4.5:1 in light and dark (./contrast); on the phone the app bar is one row of
 *                 at most 56 px (T67). The Quick Test player hosts and plays (O16).
 * Depends on:     @playwright/test, ./contrast, ./play, ./screens
 * Spec:           docs/spec/02-game-guess-the-number.md §3, §5.1, §12; docs/spec/09-testing-strategy.md §4
 */
import { expect, test, type Page } from '@playwright/test';

import { readable } from './contrast.js';
import {
  abortMatch,
  call,
  closeAll,
  fitsScreen,
  hostMenu,
  ownRows,
  person,
  search,
} from './play.js';
import { PHONE } from './screens.js';

interface Started {
  readonly matchCode: string;
}

test('journey 10: a hidden range reaches no screen and a guess outside it is answered', async ({
  browser,
}) => {
  const p = await person(browser, 'player-1', { width: 1280, height: 720 });
  const started = await call<Started>(p, 'POST', '/dev/quicktest', {
    bots: 1,
    cooldownS: 3,
    rangeLow: -4_321,
    rangeHigh: 8_765,
    rangeVisible: false,
    fast: false,
  });
  try {
    await p.page.goto(`./#/match/${started.matchCode}`);
    await expect(p.page.getByTestId('range')).toContainText('Any whole number');
    await expect(p.page.getByTestId('guess-button')).toBeEnabled({ timeout: 10_000 });
    await fitsScreen(p.page);
    await readable(p.page, 'round view with a hidden range');
    // Every whole number on the page, so a guess like -14644321 does not count as -4321.
    const shown = ((await p.page.locator('body').textContent()) ?? '').match(/-?\d+/g) ?? [];
    const numbers = shown.map((n) => Math.abs(Number(n)));
    expect(numbers).not.toContain(4_321);
    expect(numbers).not.toContain(8_765);
    await p.page.getByTestId('guess-input').fill('900000000');
    await p.page.getByTestId('guess-button').click();
    const row = ownRows(p.page).first();
    await expect(row.locator('.round-answer')).toHaveAttribute('data-feedback', 'lower');
    await expect(row).toContainText('900000000');
    // Outside the hidden range: the farthest tier, with a comment that names no bound (O21).
    await expect(row).toHaveAttribute('data-tier', 'wayOff');
    await hostMenu(p);
    await p.page.getByTestId('end-round').click();
    await expect(p.page.getByTestId('result-range')).toHaveText('The range was -4321 to 8765.', {
      timeout: 10_000,
    });
  } finally {
    await abortMatch(p, started.matchCode);
    await closeAll([p]);
  }
});

// The Quick Test form, filled the way a person types: "-500" key by key into Lowest number
// (a lone "-" used to turn into 0). Returns the code of the match it opened.
async function quickTestForm(page: Page): Promise<string> {
  await page.goto('./#/quick-test');
  const form = page.getByTestId('quick-test');
  await form.getByLabel('Bots', { exact: true }).fill('1');
  await form.getByLabel('Cooldown', { exact: true }).fill('3');
  const low = form.getByLabel('Lowest number', { exact: true });
  await low.fill('');
  await low.pressSequentially('-500');
  await expect(low).toHaveValue('-500');
  await form.getByLabel('Highest number', { exact: true }).fill('500');
  await form.getByLabel('Fast specials', { exact: true }).uncheck();
  await page.getByTestId('start-quick-test').click();
  await page.waitForURL(/#\/match\/[A-Z0-9]+$/);
  return new URL(page.url()).hash.split('/').pop() ?? '';
}

test('journey 11: a range from -500 to 500 takes negative guesses on a phone', async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const p = await person(browser, 'player-1', PHONE);
  let code = '';
  try {
    code = await quickTestForm(p.page);
    await expect(p.page.getByTestId('range')).toContainText(
      'The number is somewhere between -500 and 500',
    );
    await expect(p.page.getByTestId('guess-button')).toBeEnabled({ timeout: 10_000 });
    await fitsScreen(p.page);
    // During a round on a phone the app bar is one row of at most 56 px (DECISIONS T67).
    const bar = await p.page.locator('.shell-bar').boundingBox();
    expect(bar?.height ?? Infinity, 'the app bar during a round').toBeLessThanOrEqual(56);
    await readable(p.page, 'round view on a phone');
    await p.page.getByTestId('guess-input').fill('250');
    await p.page.getByRole('button', { name: 'Change the sign', exact: true }).click();
    await expect(p.page.getByTestId('guess-input')).toHaveValue('-250');
    await p.page.getByTestId('guess-button').click();
    await expect(ownRows(p.page).first()).toContainText('-250');
    await search(p);
    await expect(p.page.getByTestId('result-range')).toHaveText('The range was -500 to 500.', {
      timeout: 15_000,
    });
  } finally {
    if (code !== '') await abortMatch(p, code);
    await closeAll([p]);
  }
});
