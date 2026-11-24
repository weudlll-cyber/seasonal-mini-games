/**
 * @file   e2e/results.spec.ts
 * @module e2e
 * @brief  Journey 28: each game's result page under the slim bar, its first part on one screen.
 *
 * Responsibility: for Guess The Number, Safecracker, Bomb Defusal and Seasonal Target a round
 *                 started at once and ended by the host: the result page has the slim game bar
 *                 instead of the app header, at 1280 × 720 and 390 × 844, and its first part
 *                 (headline of at most two lines, the game's result, the top three placings,
 *                 the team line) ends inside the screen; the standings follow below it, where
 *                 the page may scroll (T145, O54). The list games (O110): the first part ends
 *                 above the docked chat, "Closest to winning" follows it with "All guesses",
 *                 which opens every guess; on a desktop the result and the column beside it
 *                 are one scroll area, the column has none of its own and the page never
 *                 scrolls; at 1536 × 768, 1280 × 720 and 375 × 667 the first part and all of
 *                 "Closest to winning" show without scrolling at the screen's scale, or the
 *                 scale stands at its floor, and no closest-miss line shows (O111). The
 *                 matches are aborted.
 * Depends on:     @playwright/test, ./guessGames, ./play, ./screens
 * Spec:           docs/spec/09-testing-strategy.md §4 (journey 28); docs/spec/02-game-guess-the-number.md §9
 */
import { expect, test, type Page } from '@playwright/test';

import { direct, WIDE } from './guessGames.js';
import { abortMatch, closeAll, hostMenu, person, roundOpen } from './play.js';
import { PHONE } from './screens.js';

// The first part inside the screen, the headline at most two lines, the bar not the header.
async function firstPartFits(page: Page): Promise<void> {
  await expect(page.getByTestId('app-header')).toBeHidden();
  await expect(page.getByTestId('result-bar')).toBeVisible();
  const first = page.getByTestId('result-first');
  await expect(first).toBeVisible();
  const fit = await first.evaluate((el) => {
    const h1 = el.querySelector('h1');
    const lines =
      h1 === null
        ? 0
        : h1.getBoundingClientRect().height / parseFloat(getComputedStyle(h1).lineHeight);
    return { bottom: el.getBoundingClientRect().bottom, inner: window.innerHeight, lines };
  });
  expect(fit.bottom, 'the first part ends inside the screen').toBeLessThanOrEqual(fit.inner + 1);
  expect(Math.round(fit.lines), 'the headline').toBeLessThanOrEqual(2);
}

// A list game's result with the chat docked (O110): the first part above the chat on a
// desktop, one scroll area, "Closest to winning" and its "All guesses".
async function closestDocked(page: Page, desktop: boolean): Promise<void> {
  const m = await page.evaluate(() => {
    const box = (s: string) => document.querySelector(s)?.getBoundingClientRect() ?? null;
    const side = document.querySelector('.match-after > .match-side');
    return {
      first: box('[data-testid="result-first"]')?.bottom ?? 0,
      chat: box('[data-testid="chat-dock"]')?.top ?? 0,
      page: (document.scrollingElement?.scrollHeight ?? 0) - window.innerHeight,
      side: side === null ? null : getComputedStyle(side).overflowY,
    };
  });
  expect(m.page, 'the page itself never scrolls').toBeLessThanOrEqual(0);
  if (desktop) {
    expect(m.first, 'the first part above the chat').toBeLessThanOrEqual(m.chat + 1);
    expect(m.side, 'no scroll of its own beside the result').toBe('visible');
  }
  const closest = page.getByTestId('result-closest');
  await closest.scrollIntoViewIfNeeded();
  await expect(closest.getByRole('heading', { name: 'Closest to winning' })).toBeVisible();
  await expect(page.getByTestId('result-history')).toHaveCount(0);
  await closest.getByTestId('all-guesses').click();
  await expect(page.getByTestId('result-history')).toBeVisible();
  await closest.getByTestId('all-guesses').click();
}

// The screen's scale (O111): at each size the first part and the whole of "Closest to winning"
// (its head and every row) show inside the result's scroll box without scrolling, or, where
// they cannot (a small phone), the scale stands at its floor; no closest-miss line.
const FIT_SIZES = [
  { width: 1536, height: 768 },
  { width: 1280, height: 720 },
  { width: 375, height: 667 },
];

async function closestInView(page: Page): Promise<void> {
  for (const size of FIT_SIZES) {
    await page.setViewportSize(size);
    await page.reload();
    // What the check reads: the docked layout (it follows the game list, which loads after the
    // page) and the result's fitted scale; before them the result can stand in no scroll box.
    await expect(page.getByTestId('chat-dock')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('result')).toHaveAttribute('data-sk-fit-scale', /\d/);
    await expect(page.getByTestId('result-closest').locator('li').first()).toBeVisible();
    const m = await page.getByTestId('result').evaluate((res) => {
      // The result's scroll box: the nearest ancestor that scrolls or clips, at most the root.
      let box = res.parentElement ?? document.documentElement;
      while (
        box !== document.documentElement &&
        !/(auto|scroll|hidden)/.test(getComputedStyle(box).overflowY)
      )
        box = box.parentElement ?? document.documentElement;
      const closest = res.querySelector('[data-testid="result-closest"]') as HTMLElement;
      return {
        scale: Number((res as HTMLElement).dataset['skFitScale']),
        left:
          box.getBoundingClientRect().top +
          box.clientHeight -
          closest.getBoundingClientRect().bottom,
        page: document.documentElement.scrollHeight - window.innerHeight,
      };
    });
    const at = `${String(size.width)} × ${String(size.height)}`;
    expect(m.page, `${at}: the page never scrolls`).toBeLessThanOrEqual(0);
    if (m.scale > 0.6) expect(m.left, `${at}: all of it in view`).toBeGreaterThanOrEqual(-1);
    await expect(page.getByTestId('closest-miss')).toHaveCount(0);
  }
}

for (const gameId of ['guess-the-number', 'safecracker', 'bomb-defusal', 'seasonal-target']) {
  test(`journey 28 (${gameId}): the result's first part fits one screen`, async ({ browser }) => {
    test.setTimeout(90_000);
    const p = await person(browser, 'player-1', WIDE);
    let code = '';
    try {
      const list = gameId !== 'seasonal-target';
      // A list game with twelve bots: their first guesses fill "Closest to winning" (ten rows).
      const bots = list ? 12 : 1;
      // Bomb Defusal's default 6 wires and 4 cuts are 360 sequences: one of twelve first
      // guesses hits now and then and ends the round before it is seen open; 8 and 6 are 20 160.
      const settings = gameId === 'bomb-defusal' ? { 'bomb.wires': 8, 'bomb.cuts': 6 } : {};
      code = (await direct(p, { gameId, season: 'summer', cooldownS: 30, bots, settings }))
        .matchCode;
      await roundOpen(p.page);
      if (list) {
        const rows = p.page.getByTestId('guess-list').locator('li');
        await expect.poll(() => rows.count(), { timeout: 15_000 }).toBeGreaterThanOrEqual(10);
      }
      await hostMenu(p);
      await p.page.getByTestId('host-console').getByTestId('end-round').click();
      await expect(p.page.getByTestId('result')).toBeVisible({ timeout: 15_000 });
      await firstPartFits(p.page);
      if (list) await closestDocked(p.page, true);
      await p.page.setViewportSize(PHONE);
      await p.page.reload();
      await expect(p.page.getByTestId('result')).toBeVisible({ timeout: 15_000 });
      await firstPartFits(p.page);
      if (list) await closestDocked(p.page, false);
      if (list) await closestInView(p.page);
    } finally {
      if (code !== '') await abortMatch(p, code);
      await closeAll([p]);
    }
  });
}
