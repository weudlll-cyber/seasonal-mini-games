/**
 * @file   e2e/mindGamesPhone.spec.ts
 * @module e2e
 * @brief  Journey 43: Seasonal Mind Games on a phone, the round and the result above the chat bar.
 *
 * Responsibility: 09 §4 journey 43 (the owner's reference of 2026-11-15, MG-N8): at 390 × 844 a
 *                 Quick Test round with 12 bots; during the round and on its result the screen
 *                 has one scrolling area only (the content), the chat bar's top edge lies on or
 *                 below the content's bottom edge, and the bar holds a field with Send; on the
 *                 result the winners, the cards and the next round's countdown show above the
 *                 bar without scrolling, the standings start with the viewer's own line, and
 *                 after scrolling to the end the last standings row is whole above the bar; a
 *                 message sent from the bar's field arrives without opening the chat's sheet.
 * Depends on:     @playwright/test, ./mindGames, ./play, ./screens
 * Spec:           docs/spec/09-testing-strategy.md §4 (journey 43); docs/spec/02e-game-mind-games.md §9, §11
 */
import { expect, test, type Page } from '@playwright/test';

import { mindQuickTest, startRound } from './mindGames.js';
import { abortMatch, closeAll, person, roundOpen } from './play.js';
import { PHONE } from './screens.js';

// Every box that scrolls now (its content taller than it and its overflow scrolling).
const scrollers = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('*')]
      .filter((e) => {
        const s = getComputedStyle(e);
        return (
          /(auto|scroll)/.test(s.overflowY) &&
          e.scrollHeight > e.clientHeight + 1 &&
          e.offsetParent !== null &&
          e.closest('[hidden], details:not([open])') === null
        );
      })
      .map((e) => e.className),
  );

// The content's and the bar's edges, and the page's own scroll.
const edges = (page: Page) =>
  page.evaluate(() => {
    const main = document.querySelector('.sk-docked-main')?.getBoundingClientRect();
    const bar = document.querySelector('[data-testid="chat-dock"]')?.getBoundingClientRect();
    return {
      mainBottom: main?.bottom ?? 0,
      barTop: bar?.top ?? 0,
      page: document.scrollingElement?.scrollHeight ?? 0,
    };
  });

async function oneScreen(page: Page, where: string): Promise<void> {
  const e = await edges(page);
  expect(e.page, `${where}: the page itself does not scroll`).toBeLessThanOrEqual(PHONE.height);
  expect(e.barTop, `${where}: the chat bar lies under the content`).toBeGreaterThanOrEqual(
    e.mainBottom - 0.5,
  );
  const s = await scrollers(page);
  expect(
    s.every((c) => c.includes('sk-docked-main')),
    `${where}: only the content scrolls (${s.join(', ')})`,
  ).toBe(true);
}

// Above the chat bar without scrolling.
async function aboveBar(page: Page, testId: string): Promise<void> {
  const box = await page.getByTestId(testId).boundingBox();
  const { barTop } = await edges(page);
  expect(box, testId).not.toBeNull();
  expect((box?.y ?? 0) + (box?.height ?? 0), `${testId} above the chat bar`).toBeLessThanOrEqual(
    barTop,
  );
}

test('journey 43: a phone has one scrolling area above the chat bar', async ({ browser }) => {
  test.setTimeout(150_000);
  const p = await person(browser, 'host', PHONE);
  let code = '';
  try {
    code = await mindQuickTest(p, { fields: { 'Total length': '40' }, bots: 12 });
    await startRound(p);
    await roundOpen(p.page);
    await p.page.getByRole('radio', { name: /^Winter/ }).click();
    await oneScreen(p.page, 'the round');
    const field = p.page.getByTestId('chat-dock').getByPlaceholder('Write a message…');
    await field.fill('sent from the bar');
    await p.page.getByTestId('chat-dock').getByRole('button', { name: 'Send' }).click();
    await expect(field).toHaveValue('');
    await expect(p.page.getByTestId('chat-bar')).toHaveAttribute('aria-expanded', 'false');
    await expect(p.page.getByTestId('chat-bar')).toContainText('sent from the bar');
    await expect(p.page.getByTestId('result')).toBeVisible({ timeout: 60_000 });
    await oneScreen(p.page, 'the result');
    for (const id of ['winners', 'series-countdown']) await aboveBar(p.page, id);
    await expect(p.page.getByTestId('own-standing')).toContainText(/^\d+You · place \d+/);
    await p.page.locator('.sk-docked-main').evaluate((m) => {
      m.scrollTop = m.scrollHeight;
    });
    const last = await p.page.locator('.round-standing').last().boundingBox();
    const { barTop } = await edges(p.page);
    expect(
      (last?.y ?? 0) + (last?.height ?? 0),
      'the last row whole above the bar',
    ).toBeLessThanOrEqual(barTop);
  } finally {
    if (code !== '') await abortMatch(p, code);
    await closeAll([p]);
  }
});
