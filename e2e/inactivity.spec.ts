/**
 * @file   e2e/inactivity.spec.ts
 * @module e2e
 * @brief  Journey 37: an idle player sees the countdown, is out of time, the round ends early.
 *
 * Responsibility: an individual Guess The Number round started at once with a short limit
 *                 (out after 20 s, warned after 10 s, O71; the server takes the player out 2 s
 *                 later, O72) and one bot on a short range with a 23 s cooldown: the player
 *                 never guesses; from the warning point the line "N s
 *                 left for your next guess" stands at the input row on a desktop and on a
 *                 phone, counting down, its text readable in both themes; at the limit, while
 *                 the bot still plays, the input row gives way to "Out of time this round. You
 *                 can play the next round."; once the bot has solved, the round ends long before
 *                 its longest duration, the placings say "timed out" for the player; the host
 *                 form for the next round shows the two settings with their help, starting
 *                 from the Quick Test round's 20 s and 10 s (O75). Light
 *                 screenshots of each step go to reports/screens/latest/ (O70). The match is
 *                 aborted.
 * Depends on:     @playwright/test, node:path, ./contrast, ./guessGames, ./play, ./screens
 * Spec:           docs/spec/09-testing-strategy.md §4 (journey 37); docs/spec/02-game-guess-the-number.md §5.3
 */
import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { readable } from './contrast.js';
import { direct, WIDE } from './guessGames.js';
import { abortMatch, closeAll, hostMenu, person } from './play.js';
import { PHONE, SHOTS_DIR } from './screens.js';

const shot = (page: Page, name: string) =>
  page.screenshot({ path: path.join(SHOTS_DIR, `inactivity-${name}.png`) });

// The seconds the countdown line shows.
async function secondsLeft(page: Page): Promise<number> {
  const text = (await page.getByTestId('inactivity-warning').textContent()) ?? '';
  return Number(/^(\d+) s left for your next guess$/.exec(text)?.[1] ?? Number.NaN);
}

// From the warning point the line counts down from at most 10 s, announced once, on a
// desktop and on a phone, readable in both themes.
async function countdown(page: Page): Promise<void> {
  const warning = page.getByTestId('inactivity-warning');
  // No line before the warning point; then it counts down from at most 10 s.
  await expect(page.getByTestId('guess-input')).toBeVisible();
  await expect(warning).toBeVisible({ timeout: 15_000 });
  const first = await secondsLeft(page);
  expect(first).toBeLessThanOrEqual(10);
  await expect.poll(() => secondsLeft(page), { timeout: 4_000 }).toBeLessThan(first);
  await expect(page.getByTestId('inactivity-announcement')).toHaveText(
    /^\d+ s left for your next guess\.$/,
  );
  await shot(page, 'countdown-desktop');
  await page.setViewportSize(PHONE);
  await expect(warning).toBeVisible();
  await shot(page, 'countdown-phone');
  await readable(page, 'inactivity countdown on a phone');
  await page.setViewportSize(WIDE);
}

test('journey 37: an idle player is out of time and the individual round ends early', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const p = await person(browser, 'player-1', WIDE);
  const codes: string[] = [];
  try {
    const started = await direct(p, {
      mode: 'individual',
      season: 'spring',
      // The bot searches 1–10 with a 23 s cooldown: its second guess comes after the player
      // is out (the limit and the 2 s grace, O72), so it still plays then (its picks on so
      // small a range are fixed, and the seed's secret is not its first, 5); it has solved
      // within about a minute and a half.
      rangeHigh: 10,
      cooldownS: 23,
      settings: { 'round.inactivityLimitS': 20, 'round.inactivityWarnS': 10 },
    });
    codes.push(started.matchCode);
    await countdown(p.page);

    // Out of time: the notice where the input row was; the player keeps watching.
    const notice = p.page.getByTestId('timed-out-notice');
    await expect(notice).toHaveText('Out of time this round. You can play the next round.', {
      timeout: 15_000,
    });
    await expect(p.page.getByTestId('guess-input')).toHaveCount(0);
    await shot(p.page, 'timed-out');

    // The bot solved, nobody else is left: the round ends well before its longest duration.
    const result = p.page.getByTestId('result');
    await expect(result).toBeVisible({ timeout: 90_000 });
    await expect(result.getByRole('heading', { level: 1 })).toHaveText(
      'Everyone still in the round found their number.',
    );
    const rows = p.page.getByTestId('placings').locator('tbody tr');
    await expect(rows.filter({ hasText: 'dev-player-1' })).toContainText(/^timed out/);
    await expect(rows.filter({ hasText: 'bot-01' })).toContainText(/^1/);
    await shot(p.page, 'result');

    // The next round's form: the two settings with their help lines (O71), starting from the
    // last round's values (O75).
    await hostMenu(p);
    const form = p.page.getByTestId('round-form');
    const limit = form.getByLabel('Inactivity limit', { exact: true });
    await expect(limit).toHaveAttribute('min', '0');
    await expect(limit).toHaveValue('20');
    await expect(form.getByLabel('Inactivity warning', { exact: true })).toHaveValue('10');
    await expect(form.getByText(/0 switches it off/)).toBeVisible();
    await limit.scrollIntoViewIfNeeded();
    await shot(p.page, 'host-form');
  } finally {
    for (const code of codes) await abortMatch(p, code);
    await closeAll([p]);
  }
});
