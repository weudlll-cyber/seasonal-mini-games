/**
 * @file   e2e/buildBadge.spec.ts
 * @module e2e
 * @brief  Journey 42: the build badge on every kind of page, covering nothing.
 *
 * Responsibility: at 1280 × 720 and 390 × 844, in light and dark, the badge
 *                 ("Mini Games · dev · <branch> · <commit> · <date>", DECISIONS T346) shows at
 *                 the page's right edge on the lobby, in a running round in focus mode (the view
 *                 still one screen) with its Chat panel open, and on the round's result page;
 *                 on none of them is it drawn over a button, a link, a field, the round view or
 *                 the chat (where one of those lies over the badge, the badge covers nothing).
 *                 The match is aborted.
 * Depends on:     @playwright/test, ./guessGames, ./play, ./screens
 * Spec:           docs/spec/09-testing-strategy.md §4 (journey 42); docs/spec/10-repository-structure.md §4
 */
import { expect, test, type Page } from '@playwright/test';

import { direct, WIDE } from './guessGames.js';
import { abortMatch, closeAll, fitsScreen, hostMenu, person, roundOpen } from './play.js';
import { PHONE, setTheme } from './screens.js';

// The development build's label: dev, the branch (or "detached HEAD"), the commit, the day.
const LABEL = /^Mini Games · dev · .+ · [0-9a-f]{7} · \d{4}-\d{2}-\d{2}$/;
const COVERABLE =
  'button, a, input, select, textarea, [role="button"], [data-testid="round-view"], [role="dialog"], .round-chat';

// The badge at the right edge, and drawn over none of COVERABLE: for each one its box meets,
// the topmost element in the middle of the shared part is not the badge.
async function coversNothing(page: Page, where: string): Promise<void> {
  const badge = page.getByTestId('build-badge');
  await expect(badge, where).toBeVisible();
  await expect(badge, where).toHaveText(LABEL);
  const found = await badge.evaluate((el, selector) => {
    const b = el.getBoundingClientRect();
    const over = [...document.querySelectorAll(selector)].filter((o) => {
      const r = o.getBoundingClientRect();
      const x0 = Math.max(b.left, r.left);
      const x1 = Math.min(b.right, r.right);
      const y0 = Math.max(b.top, r.top);
      const y1 = Math.min(b.bottom, r.bottom);
      if (x1 <= x0 || y1 <= y0) return false;
      const top = document.elementFromPoint((x0 + x1) / 2, (y0 + y1) / 2);
      return top !== null && el.contains(top);
    });
    return {
      right: window.innerWidth - b.right,
      over: over.map((o) => o.outerHTML.slice(0, 80)),
    };
  }, COVERABLE);
  expect(found.over, `${where}: drawn over`).toEqual([]);
  expect(found.right, `${where}: at the right edge`).toBeLessThan(40);
}

test('journey 42: the build badge covers nothing', async ({ browser }) => {
  test.setTimeout(150_000);
  const host = await person(browser, 'player-1', WIDE);
  let code = '';
  try {
    // A slow round, so the bot does not end it while the sizes and themes are looked at.
    code = (await direct(host, { gameId: 'guess-the-number', cooldownS: 30 })).matchCode;
    for (const size of [WIDE, PHONE]) {
      await host.page.setViewportSize(size);
      for (const theme of ['light', 'dark']) {
        const where = `${String(size.width)} ${theme}`;
        await host.page.goto('./');
        await setTheme(host.page, theme);
        await coversNothing(host.page, `${where} lobby`);
        await host.page.goto(`./#/match/${code}`);
        await roundOpen(host.page);
        await setTheme(host.page, theme);
        await fitsScreen(host.page);
        await coversNothing(host.page, `${where} round`);
        await host.page.getByTestId('focus-chat').click();
        await coversNothing(host.page, `${where} round with Chat`);
        await host.page.keyboard.press('Escape');
      }
    }
    // The result page: the host ends the round.
    await host.page.setViewportSize(WIDE);
    await hostMenu(host);
    await host.page.getByTestId('host-console').getByTestId('end-round').click();
    await expect(host.page.getByTestId('result')).toBeVisible({ timeout: 15_000 });
    for (const size of [WIDE, PHONE]) {
      await host.page.setViewportSize(size);
      for (const theme of ['light', 'dark']) {
        await setTheme(host.page, theme);
        await coversNothing(host.page, `${String(size.width)} ${theme} result`);
      }
    }
  } finally {
    if (code !== '') await abortMatch(host, code);
    await closeAll([host]);
  }
});
