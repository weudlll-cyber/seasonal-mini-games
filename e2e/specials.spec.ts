/**
 * @file   e2e/specials.spec.ts
 * @module e2e
 * @brief  Journeys 3 and 4: each season special once, and a halving round on a halving day.
 *
 * Responsibility: journey 3 — in Quick Test rounds of the fast test profile, Spring Herald's
 *                 free hint appears, Heatwave's cooldown drops, Leaf Fall strikes numbers and
 *                 Frost shows "answer arriving", readable on the light page. Journey 4 — with today entered as a halving
 *                 day, a halving round's range halves, and a guess outside the new range is
 *                 refused without cost. The halving day and the matches are removed or aborted.
 * Depends on:     @playwright/test, ./contrast, ./play
 * Spec:           docs/spec/09-testing-strategy.md §4 (journeys 3, 4); docs/spec/03-seasonal-specials.md §2, §4
 */
import { expect, test, type Page } from '@playwright/test';

import { readable } from './contrast.js';
import {
  abortMatch,
  call,
  closeAll,
  NUMBER,
  ownRows,
  person,
  roundOpen,
  shownNumber,
  type Person,
} from './play.js';

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
  await roundOpen(p.page);
  return started.matchCode;
}

// The cooldown in force, from the ring at the input (the bar no longer shows it, O47).
async function cooldownSeconds(page: Page): Promise<number> {
  return Number(await page.getByTestId('cooldown').getAttribute('data-cooldown-ms')) / 1_000;
}

test('journey 3: each season special shows itself', async ({ browser }) => {
  test.setTimeout(120_000);
  const p = await person(browser, 'player-1');
  const codes: string[] = [];
  try {
    codes.push(await quickRound(p, { season: 'spring' }));
    await expect(p.page.getByTestId('hint')).toContainText(
      /Free hint: the number is (odd|even)\./,
      {
        timeout: 10_000,
      },
    );

    codes.push(await quickRound(p, { season: 'summer', cooldownS: 8 }));
    await expect.poll(() => cooldownSeconds(p.page), { timeout: 15_000 }).toBeLessThan(8);
    // Announced once (O47): one row however many steps follow.
    await expect(p.page.getByTestId('guess-list')).toContainText('Heatwave: waiting time is now');
    await expect(p.page.getByTestId('guess-list').getByText(/^Heatwave:/)).toHaveCount(1);

    codes.push(await quickRound(p, { season: 'autumn' }));
    await expect(p.page.getByTestId('fallen')).toHaveText(/^Fallen numbers \([1-9]\d*\)$/, {
      timeout: 15_000,
    });
    await expect(p.page.getByTestId('guess-list')).toContainText('Leaf Fall:');

    codes.push(await quickRound(p, { season: 'winter' }));
    await expect(p.page.getByTestId('guess-button')).toBeEnabled({ timeout: 10_000 });
    await p.page.getByTestId('guess-input').fill('250000');
    await p.page.getByTestId('guess-button').click();
    await expect(ownRows(p.page)).toContainText('answer arriving…');
    // Frost's line in the winter colour on the light page (night run 2, N2).
    await readable(p.page, 'Frost round', ['light']);
    // The answer and its comment arrive together after the delay (O21).
    await expect(ownRows(p.page).locator('.round-answer')).toBeVisible({ timeout: 10_000 });
    await expect(ownRows(p.page).locator('.round-comment')).not.toBeEmpty();
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
    // The helper's range of 1–1 000 000: with 1–1 000 the bot, which searches inside the
    // halved range, could win the round before the journey was done (night run 2, N1).
    code = await quickRound(p, { season: 'spring', halving: true });
    await expect(p.page.getByTestId('round-banner')).toContainText('Halving round');
    // After the first halving (fast profile: 6 s) the range has 500 000 numbers.
    const bounds = async (): Promise<[number, number]> => {
      // Bounded: once the round is over the range is gone, and an unbounded read would make
      // the poll report the last range it saw instead of saying so.
      const text = (await p.page.getByTestId('range').textContent({ timeout: 2_000 })) ?? '';
      const m = new RegExp(`between (${NUMBER}) and (${NUMBER})`).exec(text);
      return m === null ? [0, -1] : [shownNumber(m[1] ?? ''), shownNumber(m[2] ?? '')];
    };
    await expect
      .poll(
        async () => {
          const [low, high] = await bounds();
          return high - low + 1;
        },
        { timeout: 20_000 },
      )
      .toBe(500_000);
    const [low] = await bounds();
    const outside = low > 1 ? 1 : 1_000_000;
    const before = await ownRows(p.page).count();
    await expect(p.page.getByTestId('guess-button')).toBeEnabled();
    await p.page.getByTestId('guess-input').fill(String(outside));
    await p.page.getByTestId('guess-button').click();
    await expect(p.page.locator('.gtn-message')).toContainText('outside the range');
    await expect(ownRows(p.page)).toHaveCount(before);
  } finally {
    if (code !== null) await abortMatch(p, code);
    await call(admin, 'DELETE', `/admin/halving-days/${today}/E2E`);
    await closeAll([admin, p]);
  }
});
