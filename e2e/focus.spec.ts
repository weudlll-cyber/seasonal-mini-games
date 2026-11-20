/**
 * @file   e2e/focus.spec.ts
 * @module e2e
 * @brief  Journeys 24–27: each game's round in focus mode at 1280 × 720 and 390 × 844 (O46).
 *
 * Responsibility: for Guess The Number (24), Safecracker (25), Bomb Defusal (26) and Seasonal
 *                 Target (27), a shared summer round started at once: at each size the app
 *                 header is hidden and the round's bar is one slim row without a waiting time
 *                 (44 px on a desktop, 52 px on a phone, O47); the list games' chat is docked
 *                 under the round without a Chat button (on a desktop the dock with its field
 *                 under the round view, on a phone the one-line bar under the input row whose
 *                 tap opens the chat with its field above it, O109), Seasonal Target's is a
 *                 panel; Chat (Target), Players, the whole list ("All") and on a phone the
 *                 game's panel behind the info line (T141) open as panels and close with Escape
 *                 (the focus back on their button) and with Close; while each is open the
 *                 game's action button (Guess, Cut, Try) is visible and enabled or waiting, the
 *                 panel covers nothing of the game on a desktop and ends above the action dock
 *                 on a phone (O48), and the page has no scrollbar; one guess is played and
 *                 comes back as the viewer's own row; the guess list has room for its game's
 *                 rows at each size (T142, O109: Guess The Number 26 and 18 in two columns,
 *                 Safecracker 20 and 10, Bomb Defusal 16 and 11), Seasonal Target's 20 × 20
 *                 tiles at least 30 px and 18 px apart (T144); Seasonal Target is played on
 *                 the phone through the loupe. The round's bot
 *                 waits 60 s after each of its tries, so it cannot end the round while the
 *                 journey runs, however slow the machine (T373). The matches are aborted.
 * Depends on:     @playwright/test, ./guessGames, ./play, ./screens
 * Spec:           docs/spec/09-testing-strategy.md §4 (journeys 24–27); docs/spec/02-game-guess-the-number.md §12
 */
import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';

import { direct, WIDE } from './guessGames.js';
import { abortMatch, closeAll, fitsScreen, listRoom, ownRows, person, roundOpen } from './play.js';
import { PHONE } from './screens.js';

type Size = typeof WIDE;
// What each size must reach (T141–T144): rows the guess list has room for, a tile's size.
interface Targets {
  readonly rows?: readonly [number, number];
  readonly tile?: readonly [number, number];
}
// One guess of the game, different at each size (`n` is 0 on the desktop, 1 on the phone).
type Play = (page: Page, n: number) => Promise<void>;

type Box = { x: number; y: number; width: number; height: number };
const overlap = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

// While a panel is open the game stays playable (O48): the action button visible and enabled
// or waiting ("Wait 6 s"); on a desktop the panel overlaps no part of the game, on a phone it
// ends above the input row.
async function stillPlayable(page: Page, dialog: Box, size: Size): Promise<void> {
  const action = page.getByTestId('guess-button').or(page.getByTestId('cut-button'));
  await expect(action).toBeVisible();
  // Disabled only while waiting, or until the input is complete (Safecracker's whole code,
  // Bomb Defusal's chosen wires): then it still reads its own word.
  if (!(await action.isEnabled())) {
    await expect(action).toHaveText(/^(Wait \d+ s|Try code|Cut)$/);
  }
  // The parts of the round (T141): which ones there are depends on the game and the layout.
  const parts = ['.round-stage', '.round-column', '.round-main', '.round-line', '.round-input'];
  for (const part of parts) {
    // Count first: a bounding box would wait for a part this layout does not have.
    const found = page.locator(part);
    if ((await found.count()) === 0) continue;
    const box = await found.first().boundingBox();
    if (box === null) continue;
    if (size === WIDE) expect(overlap(dialog, box), `the panel over ${part}`).toBe(false);
    else if (part === '.round-input') {
      expect(dialog.y + dialog.height, 'the sheet ends above the dock').toBeLessThanOrEqual(
        box.y + 1,
      );
    }
  }
  await fitsScreen(page);
}

// The top and the bottom edge of what a locator shows (0 for nothing).
async function edges(target: Locator): Promise<{ top: number; bottom: number }> {
  const box = (await target.boundingBox()) ?? { y: 0, height: 0 };
  return { top: box.y, bottom: box.y + box.height };
}

// On a phone the docked chat's one-line bar, no field in it, opens the chat with its field as a
// sheet above the bar; Escape (focus back on the bar), then Close.
async function chatSheet(page: Page, barTop: number): Promise<void> {
  const bar = page.getByTestId('chat-dock-bar');
  await expect(page.getByTestId('chat-dock').locator(':scope > .chat-writer')).toHaveCount(0);
  const sheet = page.getByRole('dialog', { name: 'Chat' });
  await bar.click();
  await expect(sheet.getByRole('textbox')).toBeVisible();
  expect((await edges(sheet)).bottom, 'the sheet above the bar').toBeLessThanOrEqual(barTop + 1);
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(bar).toBeFocused();
  await bar.click();
  await sheet.getByRole('button', { name: 'Close' }).click();
  await expect(sheet).toBeHidden();
}

// The list games' chat, docked under the round (O109): no Chat button; on a desktop the dock
// with its field under the round view; on a phone the bar under the input row, nothing behind
// it (./chatSheet).
async function dockedChat(page: Page, size: Size): Promise<void> {
  await expect(page.getByTestId('focus-chat')).toHaveCount(0);
  const dock = page.getByTestId('chat-dock');
  await expect(dock).toBeVisible();
  const top = (await edges(dock)).top;
  const wide = size === WIDE;
  const above = wide ? page.getByTestId('round-view') : page.locator('.round-input');
  expect((await edges(above)).bottom, 'the chat under the round').toBeLessThanOrEqual(top + 1);
  if (!wide) return chatSheet(page, top);
  await expect(page.getByTestId('chat-dock-bar')).toHaveCount(0);
  await expect(dock.getByRole('textbox')).toBeVisible();
}

// A panel from the bar: open (the game still playable), Escape (focus back on its button),
// open, Close.
async function panel(page: Page, button: string, name: string, size: Size): Promise<void> {
  const opener = page.getByTestId(button);
  const dialog = page.getByRole('dialog', { name });
  await opener.click();
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  if (box !== null) await stillPlayable(page, box, size);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
  await opener.click();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
}

async function slimBar(page: Page, size: Size): Promise<void> {
  await expect(page.locator('.shell-bar')).toBeHidden();
  const bar = page.getByTestId('round-banner');
  const box = await bar.boundingBox();
  expect(box?.height ?? Infinity, 'the round bar').toBeLessThanOrEqual(size === WIDE ? 44 : 52);
  // No waiting time in the bar: the ring and the button at the input show it (O47).
  await expect(bar).not.toContainText(/Wait/);
}

// The measured sizes at one screen size against the game's targets.
async function reaches(page: Page, targets: Targets, n: number): Promise<void> {
  const rows = targets.rows?.[n];
  if (rows !== undefined)
    expect(await listRoom(page), 'guess rows in view').toBeGreaterThanOrEqual(rows);
  const tile = targets.tile?.[n];
  if (tile !== undefined) {
    // A tile's pitch, its fill and one gap: the grid's width over its columns (T144).
    const pitch = await page.getByTestId('tile-grid').evaluate((grid) => {
      const columns = grid.querySelectorAll('[data-testid="tile"][data-y="1"]').length;
      return grid.getBoundingClientRect().width / Math.max(1, columns);
    });
    expect(pitch, 'a tile').toBeGreaterThanOrEqual(tile);
  }
}

async function focusJourney(
  browser: Browser,
  gameId: string,
  play: Play,
  // The sizes to reach, the round's own settings, and where the chat is (a list game's docked
  // under the round, O109; Seasonal Target's a panel from the bar).
  opts: {
    readonly targets: Targets;
    readonly round?: Readonly<Record<string, unknown>>;
    readonly chat: 'dock' | 'panel';
  },
): Promise<void> {
  const { targets, round = {} } = opts;
  const p = await person(browser, 'player-1', WIDE);
  const codes: string[] = [];
  try {
    // The bot plays at most one try a minute: at its cooldown alone it opened Safecracker's
    // code in 5 tries (15 s) and ended the round under a slow journey (T373).
    const body = { gameId, season: 'summer', botDelayS: 60, ...round };
    codes.push((await direct(p, body)).matchCode);
    for (const [n, size] of [WIDE, PHONE].entries()) {
      await p.page.setViewportSize(size);
      await p.page.reload();
      await roundOpen(p.page);
      await slimBar(p.page, size);
      if (opts.chat === 'dock') await dockedChat(p.page, size);
      else await panel(p.page, 'focus-chat', 'Chat', size);
      await panel(p.page, 'focus-players', 'Players', size);
      await panel(p.page, 'list-all', 'Guesses and events', size);
      // A phone's game panel lies behind its info line (T141).
      if (size === PHONE) await panel(p.page, 'info-line', 'This round', size);
      await fitsScreen(p.page);
      // The cooldown of the guess before has run out.
      await expect(p.page.getByTestId('cooldown')).toHaveAttribute('aria-label', 'Ready', {
        timeout: 40_000,
      });
      await play(p.page, n);
      await expect(ownRows(p.page).first()).toBeVisible({ timeout: 10_000 });
      await reaches(p.page, targets, n);
      await fitsScreen(p.page);
    }
  } finally {
    for (const code of codes) await abortMatch(p, code);
    await closeAll([p]);
  }
}

test('journey 24: Guess The Number in focus mode', async ({ browser }) => {
  test.setTimeout(120_000);
  // Room for 26 guess rows in the stage's two columns at 1280 × 720 with the chat docked under
  // the round, 18 on a phone above the chat's bar (O109; T142's 22 and 10 before).
  await focusJourney(
    browser,
    'guess-the-number',
    async (page, n) => {
      await page.getByTestId('guess-input').fill(n === 0 ? '40' : '60');
      await page.getByTestId('guess-button').click();
    },
    { targets: { rows: [26, 18] }, chat: 'dock' },
  );
});

test('journey 25: Safecracker in focus mode', async ({ browser }) => {
  test.setTimeout(120_000);
  await focusJourney(
    browser,
    'safecracker',
    async (page, n) => {
      await page.getByTestId('code-box-0').click();
      await page.keyboard.type(n === 0 ? '0123' : '4567');
      await page.getByTestId('guess-button').click();
    },
    { targets: { rows: [20, 10] }, chat: 'dock' },
  );
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
    // Its larger picker: 11 rows on a phone above the chat bar (O109); on a desktop, its help line
    // (T193) and the 150 px chat dock leave two columns of 8, 16 of the spec's 14 or more (02c).
    {
      targets: { rows: [16, 11] },
      round: { settings: { 'bomb.wires': 8, 'bomb.cuts': 6 } },
      chat: 'dock',
    },
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
    // 20 × 20 tiles: about 30 px at 1280 × 720 and at least 18 px on a phone (T144). The bot
    // found a 20 × 20 target by its distances within two cooldowns of 20 s (CI); with
    // warm/cold only and a 30 s cooldown it needs many more of them. Its first guess is a
    // random cell, though, and once in CI it was the target (1 in 400): individual secrets,
    // so a bot's solve never ends the player's round.
    {
      targets: { tile: [30, 18] },
      chat: 'panel',
      round: {
        mode: 'individual',
        cooldownS: 30,
        settings: { 'target.size': 20, 'target.feedback': 'closeness' },
      },
    },
  );
});
