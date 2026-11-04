/**
 * @file   e2e/bombPicker.spec.ts
 * @module e2e
 * @brief  Journey 33: Seasonal Bomb Defusal's wire picker and its result without sideways scroll.
 *
 * Responsibility: a shared spring round with eight wires and six cuts: the help line above the
 *                 picker, one line at 1280 × 720 and at most two at 390 × 844; Spring's colour
 *                 locked in slot 1 (O60); a tapped filled slot empties just that one and the
 *                 next wire fills it; a cut; then the host ends the round and the result's
 *                 revealed sequence and history neither scroll sideways nor cut a colour at
 *                 1280 × 720, 1920 × 1080 and 390 × 844. The match is aborted.
 * Depends on:     @playwright/test, ./guessGames, ./play, ./screens
 * Spec:           docs/spec/09-testing-strategy.md §4 (journey 33); docs/spec/02c-game-bomb-defusal.md §9, §11
 */
import { expect, test, type Page } from '@playwright/test';

import { direct, WIDE } from './guessGames.js';
import { abortMatch, closeAll, hostMenu, ownRows, person } from './play.js';
import { PHONE } from './screens.js';

const WIRES = ['red', 'blue', 'yellow', 'green', 'white', 'black', 'orange', 'purple'];
const FULL_HD = { width: 1920, height: 1080 };

const tap = (page: Page, wire: string) => page.getByTestId(`wire-${wire}`).click();

// How many lines the help line takes: its height over its line height.
const helpLines = (page: Page) =>
  page
    .getByTestId('bd-help')
    .evaluate(
      (el) =>
        el.getBoundingClientRect().height / Number.parseFloat(getComputedStyle(el).lineHeight),
    );

// Nothing on the result page wider than its box: no sideways scroll, no colour cut.
async function noSidewaysOverflow(page: Page): Promise<void> {
  await expect(page.getByTestId('bd-result')).toBeVisible({ timeout: 15_000 });
  const wide = await page.evaluate(() => {
    const doc = document.scrollingElement;
    const out: string[] = doc !== null && doc.scrollWidth > doc.clientWidth ? ['the page'] : [];
    // Text for screen readers only is clipped to a pixel by design.
    const shown = '.bd-result *:not(.smg-visually-hidden), .bd-players *:not(.smg-visually-hidden)';
    for (const el of document.querySelectorAll<HTMLElement>(shown)) {
      if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible') {
        out.push(el.className || el.tagName);
      }
    }
    return out;
  });
  expect(wide, 'nothing scrolls sideways or is cut').toEqual([]);
}

test('journey 33: the Bomb Defusal picker, and its result without sideways scroll', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const p = await person(browser, 'player-1', WIDE);
  let code = '';
  try {
    code = (
      await direct(p, {
        gameId: 'bomb-defusal',
        season: 'spring',
        cooldownS: 30,
        settings: { 'bomb.wires': 8, 'bomb.cuts': 6 },
      })
    ).matchCode;
    const hint = (await p.page.getByTestId('hint').textContent()) ?? '';
    const first = WIRES.find((w) => hint.includes(w)) ?? '';
    // The help line, one line on a desktop; slot 1 holds the hint, locked.
    await expect(p.page.getByTestId('bd-help')).toHaveText(
      'Tap colours in cutting order: they fill 2 → 6. Tap a filled box to empty it; Clear starts over.',
    );
    expect(await helpLines(p.page)).toBeLessThan(1.5);
    await expect(p.page.getByLabel(`hint: ${first} in place 1`)).toBeVisible();
    // A tapped filled slot empties just that one; the next wire fills it.
    const [a = '', b = '', c = '', ...rest] = WIRES.filter((w) => w !== first);
    await tap(p.page, a);
    await tap(p.page, b);
    await p.page.getByRole('button', { name: `${a} in place 2, take it out` }).click();
    const slots = p.page.getByTestId('slots');
    await expect(slots).not.toContainText(a);
    await tap(p.page, c);
    await expect(
      p.page.getByRole('button', { name: `${c} in place 2, take it out` }),
    ).toBeVisible();
    for (const w of rest.slice(0, 3)) await tap(p.page, w);
    await p.page.getByTestId('cut-button').click();
    await expect(ownRows(p.page).first().locator('.round-answer')).not.toHaveText('', {
      timeout: 10_000,
    });
    await p.page.setViewportSize(PHONE);
    await p.page.reload();
    await expect(p.page.getByTestId('bd-help')).toBeVisible();
    expect(await helpLines(p.page)).toBeLessThan(2.5);

    await p.page.setViewportSize(WIDE);
    await hostMenu(p);
    await p.page.getByTestId('host-console').getByTestId('end-round').click();
    for (const size of [WIDE, FULL_HD, PHONE]) {
      await p.page.setViewportSize(size);
      await p.page.reload();
      await noSidewaysOverflow(p.page);
    }
  } finally {
    if (code !== '') await abortMatch(p, code);
    await closeAll([p]);
  }
});
