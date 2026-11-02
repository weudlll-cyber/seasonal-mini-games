/**
 * @file   e2e/focus.spec.ts
 * @module e2e
 * @brief  Journeys 24–27: each game's round in focus mode at 1280 × 720 and 390 × 844 (O46).
 *
 * Responsibility: for Guess The Number (24), Safecracker (25), Bomb Defusal (26) and Seasonal
 *                 Target (27), a shared summer round started at once: at each size the app
 *                 header is hidden and the round's bar is one slim row (56 px on a desktop,
 *                 64 px on a phone); Chat and Players open as panels and close with Escape
 *                 (the focus back on their button) and with Close; the page has no scrollbar;
 *                 one guess is played and comes back as the viewer's own row. Guess The Number
 *                 keeps room for at least 12 guess rows at 1280 × 720; Seasonal Target is
 *                 played on the phone through the loupe. The matches are aborted.
 * Depends on:     @playwright/test, ./guessGames, ./play, ./screens
 * Spec:           docs/spec/09-testing-strategy.md §4 (journeys 24–27); docs/spec/02-game-guess-the-number.md §12
 */
import { expect, test, type Browser, type Page } from '@playwright/test';

import { direct, WIDE } from './guessGames.js';
import { abortMatch, closeAll, fitsScreen, ownRows, person, roundOpen } from './play.js';
import { PHONE } from './screens.js';

type Size = typeof WIDE;
// One guess of the game, different at each size (`n` is 0 on the desktop, 1 on the phone).
type Play = (page: Page, n: number) => Promise<void>;

// A panel from the bar: open, Escape (focus back on its button), open, Close.
async function panel(page: Page, button: string, name: string): Promise<void> {
  const opener = page.getByTestId(button);
  const dialog = page.getByRole('dialog', { name });
  await opener.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
  await opener.click();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
}

async function slimBar(page: Page, size: Size): Promise<void> {
  await expect(page.locator('.shell-bar')).toBeHidden();
  const bar = await page.getByTestId('round-banner').boundingBox();
  expect(bar?.height ?? Infinity, 'the round bar').toBeLessThanOrEqual(size === WIDE ? 56 : 64);
}

async function focusJourney(
  browser: Browser,
  gameId: string,
  play: Play,
  // The round's own settings: slow enough that the bot does not end it before the player.
  round: Readonly<Record<string, unknown>> = {},
): Promise<void> {
  const p = await person(browser, 'player-1', WIDE);
  const codes: string[] = [];
  try {
    codes.push((await direct(p, { gameId, season: 'summer', ...round })).matchCode);
    for (const [n, size] of [WIDE, PHONE].entries()) {
      await p.page.setViewportSize(size);
      await p.page.reload();
      await roundOpen(p.page);
      await slimBar(p.page, size);
      await panel(p.page, 'focus-chat', 'Chat');
      await panel(p.page, 'focus-players', 'Players');
      await fitsScreen(p.page);
      // The cooldown of the guess before has run out.
      await expect(p.page.getByTestId('cooldown')).toHaveAttribute('aria-label', 'Ready to guess', {
        timeout: 40_000,
      });
      await play(p.page, n);
      await expect(ownRows(p.page).first()).toBeVisible({ timeout: 10_000 });
      await fitsScreen(p.page);
    }
  } finally {
    for (const code of codes) await abortMatch(p, code);
    await closeAll([p]);
  }
}

test('journey 24: Guess The Number in focus mode', async ({ browser }) => {
  test.setTimeout(120_000);
  await focusJourney(browser, 'guess-the-number', async (page, n) => {
    if (n === 0) {
      // Room for 12 guess rows (a row with its comment on a second line) at 1280 × 720: the
      // list's box, which a special's banner shares for 3 s at a time.
      const room = await page.locator('.round-main').evaluate((main) => {
        const s = getComputedStyle(main);
        return main.clientHeight - parseFloat(s.paddingTop) - parseFloat(s.paddingBottom);
      });
      await page.getByTestId('guess-input').fill('40');
      await page.getByTestId('guess-button').click();
      const row = await ownRows(page).first().boundingBox();
      expect(room / Math.max(row?.height ?? 40, 40), 'guess rows in view').toBeGreaterThanOrEqual(
        12,
      );
      return;
    }
    await page.getByTestId('guess-input').fill('60');
    await page.getByTestId('guess-button').click();
  });
});

test('journey 25: Safecracker in focus mode', async ({ browser }) => {
  test.setTimeout(120_000);
  await focusJourney(browser, 'safecracker', async (page, n) => {
    await page.getByTestId('code-box-0').click();
    await page.keyboard.type(n === 0 ? '0123' : '4567');
    await page.getByTestId('guess-button').click();
  });
});

test('journey 26: Bomb Defusal in focus mode', async ({ browser }) => {
  test.setTimeout(120_000);
  // Eight wires and six cuts: the bot does not defuse the bomb before the player plays (as in
  // journey 21).
  const wires = ['red', 'blue', 'yellow', 'green', 'white', 'black', 'orange', 'purple'];
  await focusJourney(
    browser,
    'bomb-defusal',
    async (page, n) => {
      const order = n === 0 ? wires.slice(0, 6) : wires.slice(2);
      for (const wire of order) await page.getByTestId(`wire-${wire}`).click();
      await page.getByTestId('cut-button').click();
    },
    { settings: { 'bomb.wires': 8, 'bomb.cuts': 6 } },
  );
});

test('journey 27: Seasonal Target in focus mode, the loupe on a phone', async ({ browser }) => {
  test.setTimeout(120_000);
  await focusJourney(
    browser,
    'seasonal-target',
    async (page, n) => {
      const tile = (x: number, y: number) =>
        page.locator(`[data-testid="tile"][data-x="${String(x)}"][data-y="${String(y)}"]`);
      if (n === 0) {
        await tile(4, 4).click();
        await expect(page.getByTestId('selected')).toHaveText('Selected: column 4, row 4');
        await page.getByTestId('guess-button').click();
        return;
      }
      // A phone: the first tap opens the loupe around the tile; a tap in it selects.
      await tile(15, 15).click();
      const loupe = page.getByTestId('loupe');
      await expect(loupe).toBeVisible();
      const pick = loupe.locator('[data-testid="loupe-tile"][data-x="16"][data-y="14"]');
      const box = await pick.boundingBox();
      expect(Math.min(box?.width ?? 0, box?.height ?? 0), 'a loupe tile').toBeGreaterThanOrEqual(
        44,
      );
      await pick.click();
      await expect(page.getByTestId('selected')).toHaveText('Selected: column 16, row 14');
      await page.getByTestId('guess-button').click();
      await expect(loupe).toBeHidden();
    },
    // The bot found a 20 × 20 target by its distances within two cooldowns of 20 s (CI): on a
    // 30 × 30 grid with warm/cold only it needs many more guesses, so the round stays open.
    { cooldownS: 10, settings: { 'target.size': 30, 'target.feedback': 'closeness' } },
  );
});
