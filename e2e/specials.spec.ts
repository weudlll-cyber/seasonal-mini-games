/**
 * @file   e2e/specials.spec.ts
 * @module e2e
 * @brief  Journeys 3 and 4: each season special once, and a halving round on a halving day.
 *
 * Responsibility: journey 3 — in Quick Test rounds of the fast test profile, Spring Herald's
 *                 hint card appears, Heatwave's cooldown drops, Leaf Fall strikes numbers and
 *                 Frost shows "answer arriving". Journey 4 — with today entered as a halving
 *                 day, a halving round's range halves, and a guess outside the new range is
 *                 refused without cost. The halving day and the matches are removed or aborted.
 * Depends on:     @playwright/test, ./play
 * Spec:           docs/spec/09-testing-strategy.md §4 (journeys 3, 4); docs/spec/03-seasonal-specials.md §2, §4
 */
import { expect, test, type Page } from '@playwright/test';

import { abortMatch, call, closeAll, person, type Person } from './play.js';

interface Started {
  readonly matchCode: string;
}

// A Quick Test round (fast specials, range 1–1 000 000 so the bots take long) and its page.
async function quickRound(p: Person, body: Record<string, unknown>): Promise<string> {
  const started = await call<Started>(p, 'POST', '/dev/quicktest', {
    bots: 1,
    rangeHigh: 1_000_000,
    fast: true,
    ...body,
  });
  await p.page.goto(`./#/match/${started.matchCode}`);
  await expect(p.page.getByTestId('round-banner')).toBeVisible();
  return started.matchCode;
}

async function cooldownSeconds(page: Page): Promise<number> {
  const text = (await page.getByText(/cooldown \d+(\.\d)? s/).textContent()) ?? '';
  return Number(/cooldown (\d+(?:\.\d)?) s/.exec(text)?.[1] ?? 'NaN');
}

test('journey 3: each season special shows itself', async ({ browser }) => {
  test.setTimeout(120_000);
  const p = await person(browser, 'player-1');
  const codes: string[] = [];
  try {
    codes.push(await quickRound(p, { season: 'spring' }));
    await expect(p.page.getByTestId('hint')).toContainText(/The number is (odd|even)\./, {
      timeout: 10_000,
    });

    codes.push(await quickRound(p, { season: 'summer', cooldownS: 8 }));
    await expect.poll(() => cooldownSeconds(p.page), { timeout: 15_000 }).toBeLessThan(8);
    await expect(p.page.getByTestId('feed')).toContainText('Heatwave: cooldown now');

    codes.push(await quickRound(p, { season: 'autumn' }));
    await expect(p.page.getByTestId('band')).toContainText('fallen', { timeout: 15_000 });
    await expect(p.page.getByTestId('feed')).toContainText('Leaf Fall:');

    codes.push(await quickRound(p, { season: 'winter' }));
    await expect(p.page.getByTestId('guess-button')).toBeEnabled({ timeout: 10_000 });
    await p.page.getByTestId('guess-input').fill('250000');
    await p.page.getByTestId('guess-button').click();
    await expect(p.page.getByTestId('own-guesses')).toContainText('Answer arriving in');
    await expect(p.page.getByTestId('own-guesses')).toContainText('The number is', {
      timeout: 10_000,
    });
  } finally {
    for (const code of codes) await abortMatch(p, code);
    await closeAll([p]);
  }
});

test('journey 4: a halving round halves the range and refuses a guess outside it', async ({
  browser,
}) => {
  const admin = await person(browser, 'admin');
  const p = await person(browser, 'player-1');
  const today = new Date().toISOString().slice(0, 10);
  await call(admin, 'POST', '/admin/halving-days', { day: today, token: 'E2E' });
  let code: string | null = null;
  try {
    code = await quickRound(p, { season: 'spring', halving: true, rangeHigh: 1_000 });
    await expect(p.page.getByTestId('round-banner')).toContainText('Halving round');
    // After the first halving (fast profile: 6 s) the range has 500 numbers.
    const range = p.page.locator('.gtn-range-text');
    await expect
      .poll(
        async () => {
          const [low, high] = (await range.locator('span').allTextContents())
            .filter((t) => /^\d+$/.test(t))
            .map(Number);
          return (high ?? 0) - (low ?? 0) + 1;
        },
        { timeout: 20_000 },
      )
      .toBe(500);
    const [low] = (await range.locator('span').allTextContents()).map(Number);
    const outside = (low ?? 1) > 1 ? 1 : 1_000;
    const before = await p.page.getByTestId('own-guesses').locator('li').count();
    await expect(p.page.getByTestId('guess-button')).toBeEnabled();
    await p.page.getByTestId('guess-input').fill(String(outside));
    await p.page.getByTestId('guess-button').click();
    await expect(p.page.getByRole('status')).toContainText('outside the range');
    await expect(p.page.getByTestId('own-guesses').locator('li')).toHaveCount(before);
  } finally {
    if (code !== null) await abortMatch(p, code);
    await call(admin, 'DELETE', `/admin/halving-days/${today}/E2E`);
    await closeAll([admin, p]);
  }
});
