/**
 * @file   e2e/range.spec.ts
 * @module e2e
 * @brief  Journeys 10 and 11: a hidden range, and a range with negative bounds.
 *
 * Responsibility: journey 10 (1280 × 720) — with the range hidden the round view says "Any
 *                 whole number", no bound is anywhere on the page, a guess far outside the
 *                 range is accepted and answered, and the result reveals the range (O19,
 *                 DECISIONS T52, T53). Journey 11 (390 × 844) — a range from −500 to 500 is
 *                 shown, the ± button turns a typed number negative, the guess is answered,
 *                 and the round plays to its result (O18). Both check that the round view fits
 *                 the screen without a page scrollbar (02 §12). The Quick Test player hosts
 *                 and plays (O16).
 * Depends on:     @playwright/test, ./play, ./screens
 * Spec:           docs/spec/02-game-guess-the-number.md §3, §5.1, §12; docs/spec/09-testing-strategy.md §4
 */
import { expect, test } from '@playwright/test';

import { abortMatch, call, closeAll, fitsScreen, hostMenu, person, search } from './play.js';
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
    expect(await p.page.locator('body').textContent()).not.toMatch(/4321|8765/);
    await p.page.getByTestId('guess-input').fill('900000000');
    await p.page.getByTestId('guess-button').click();
    const chip = p.page.getByTestId('own-guesses').locator('li').first();
    await expect(chip).toHaveAttribute('data-feedback', 'lower');
    await expect(chip).toContainText('900000000');
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

test('journey 11: a range from -500 to 500 takes negative guesses on a phone', async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const p = await person(browser, 'player-1', PHONE);
  const started = await call<Started>(p, 'POST', '/dev/quicktest', {
    bots: 1,
    cooldownS: 3,
    rangeLow: -500,
    rangeHigh: 500,
    fast: false,
  });
  try {
    await p.page.goto(`./#/match/${started.matchCode}`);
    await expect(p.page.getByTestId('range')).toContainText(
      'The number is somewhere between -500 and 500',
    );
    await expect(p.page.getByTestId('guess-button')).toBeEnabled({ timeout: 10_000 });
    await fitsScreen(p.page);
    await p.page.getByTestId('guess-input').fill('250');
    await p.page.getByRole('button', { name: 'Change the sign' }).click();
    await expect(p.page.getByTestId('guess-input')).toHaveValue('-250');
    await p.page.getByTestId('guess-button').click();
    await expect(p.page.getByTestId('own-guesses')).toContainText('-250');
    await search(p);
    await expect(p.page.getByTestId('result-range')).toHaveText('The range was -500 to 500.', {
      timeout: 15_000,
    });
  } finally {
    await abortMatch(p, started.matchCode);
    await closeAll([p]);
  }
});
