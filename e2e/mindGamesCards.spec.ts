/**
 * @file   e2e/mindGamesCards.spec.ts
 * @module e2e
 * @brief  Journey 45: a click anywhere in a Seasonal Mind Games card chooses its season.
 *
 * Responsibility: 09 §4 journey 45 (the owner's finding of 2026-11-17): in a Quick Test round
 *                 with All on, every card is clicked at its top (icon), its middle (the flight
 *                 band) and its bottom (the count), at 1280 × 800 and then at 390 × 844, and
 *                 each click chooses that card's season, whatever flies in the band; once
 *                 choices close, a click in a card's middle chooses nothing. At most 4 choices
 *                 a second per account (`rate.guessPerAccountPerS`), so the clicks are paced.
 *                 The page reloads after the switch to the phone size (WebKit keeps the old scale).
 * Depends on:     @playwright/test, ./mindGames, ./play, ./screens
 * Spec:           docs/spec/09-testing-strategy.md §4 (journey 45); docs/spec/02e-game-mind-games.md §11
 */
import { expect, test, type Page } from '@playwright/test';

import { mindQuickTest, startRound } from './mindGames.js';
import { abortMatch, closeAll, person, roundOpen } from './play.js';
import { DESKTOP, PHONE } from './screens.js';

const OPTIONS = ['spring', 'summer', 'autumn', 'winter', 'all'] as const;
const PLACES = ['top', 'middle', 'bottom'] as const;

const card = (page: Page, c: string) => page.locator(`.mg-frame[data-choice="${c}"]`);
const radio = (page: Page, c: string) => page.locator(`.mg-choice[data-choice="${c}"]`);

// A click at a card's top, middle or bottom, inside its frame.
async function clickIn(page: Page, c: string, place: (typeof PLACES)[number]): Promise<void> {
  // The pause first: the card is measured right before the click, so a layout change in
  // between (the first counts arriving) cannot move it from under the pointer.
  await page.waitForTimeout(300);
  const box = await card(page, c).boundingBox();
  expect(box, `${c}'s card`).not.toBeNull();
  const { x, y, width, height } = box ?? { x: 0, y: 0, width: 0, height: 0 };
  const at = { top: y + 8, middle: y + height / 2, bottom: y + height - 5 }[place];
  await page.mouse.click(x + width / 2, at);
}

// Every card at each place, each choosing its own season.
async function everyCard(page: Page, size: string): Promise<void> {
  for (const place of PLACES)
    for (const c of OPTIONS) {
      await clickIn(page, c, place);
      await expect(radio(page, c), `${size}: ${c} clicked at its ${place}`).toHaveAttribute(
        'aria-checked',
        'true',
      );
    }
}

test('journey 45: a click anywhere in a Mind Games card chooses its season', async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const p = await person(browser, 'host', DESKTOP);
  let code = '';
  try {
    code = await mindQuickTest(p, { fields: { 'Total length': '60', All: 'on' }, bots: 3 });
    await startRound(p);
    await roundOpen(p.page);
    await everyCard(p.page, '1280 × 800');
    // A reload after the resize, as the other phone checks do: WebKit's phone emulation keeps
    // the desktop's scale after the switch, so no card is where the page says it is.
    await p.page.setViewportSize(PHONE);
    await p.page.reload();
    await roundOpen(p.page);
    await everyCard(p.page, '390 × 844');
    // Choices close at 50 s (total 60 − delay 10, room for the reload): then a card
    // chooses nothing.
    await expect(radio(p.page, 'spring')).toBeDisabled({ timeout: 40_000 });
    for (const c of ['spring', 'summer', 'autumn', 'winter'] as const)
      await clickIn(p.page, c, 'middle');
    await p.page.waitForTimeout(1_000);
    await expect(radio(p.page, 'all'), 'still All after the clicks').toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(p.page.locator('.mg-choice[aria-checked="true"]')).toHaveCount(1);
  } finally {
    if (code !== '') await abortMatch(p, code);
    await closeAll([p]);
  }
});
