/**
 * @file   e2e/target.spec.ts
 * @module e2e
 * @brief  Journey 22: Seasonal Target through the lobby on its tile grid, two answer modes, one screen.
 *
 * Responsibility: a shared spring round from the Quick Test form through the lobby on the
 *                 20 × 20 tile grid (O45): the intro names the grid, Spring's two quarters are
 *                 tinted on the grid, each with its "Hint" tag (O61; a bot's guess on a tag's
 *                 tile takes its place, T144); a click selects a tile, an
 *                 arrow button behind "Type coordinates" (O51, in the loupe on a touch screen) and an
 *                 arrow key move the selection, its coordinates show as text, Guess sends and
 *                 the own tile and row appear with warm/cold only, the default (O53): no
 *                 distance in the row, the tile filled in its closeness colour and framed as
 *                 the viewer's, without a number; then an individual autumn round with
 *                 distance only, set explicitly, on a 60 s cooldown: fallen tiles are hatched,
 *                 then the row and the tile carry the distance. Each round view fits
 *                 1280 × 720 and 390 × 844, the grid left of the column on the desktop (O51);
 *                 on a 375 × 667 phone, and with its keyboard open (375 × 367), the bar, the
 *                 board, the list and the dock lie in order without overlapping, the dock on
 *                 the screen, the board as wide as the screen while it has the room (O111).
 *                 The matches are aborted.
 * Depends on:     @playwright/test, ./guessGames, ./play
 * Spec:           docs/spec/09-testing-strategy.md §4 (journey 22); docs/spec/02d-game-seasonal-target.md
 */
import { expect, test, type Page } from '@playwright/test';

import { direct, fitsBoth, fromLobby, WIDE } from './guessGames.js';
import { abortMatch, closeAll, ownRows, person, roundOpen } from './play.js';

// Distance only (O43): the tiles away ("9 away" in the list) and no compass direction.
const DISTANCE = /^\d+ away$|correct/;

// Select by click, move by an arrow button and by an arrow key; the coordinates as text. The
// arrows are behind "Type coordinates" (O51); on a touch screen with tiles under 44 px the
// tap opens the loupe, which holds them instead.
async function selectByHand(page: Page): Promise<void> {
  const selected = page.getByTestId('selected');
  await page.locator('[data-testid="tile"][data-x="3"][data-y="3"]').click();
  await expect(selected).toHaveText('Selected: column 3, row 3');
  const loupe = page.getByTestId('loupe');
  const viaLoupe = await loupe.isVisible();
  if (!viaLoupe) await page.getByRole('button', { name: 'Type coordinates' }).click();
  await (viaLoupe ? loupe : page).getByRole('button', { name: /Move south/i }).click();
  await expect(selected).toHaveText('Selected: column 3, row 4');
  if (viaLoupe) await loupe.getByRole('button', { name: 'Close' }).click();
  await page.getByTestId('tile-grid').press('ArrowRight');
  await expect(selected).toHaveText('Selected: column 4, row 4');
}

// A selected tile still standing (a fallen one is refused), moved by key: a tap opens the
// loupe on a touch screen.
async function standingSelected(page: Page): Promise<void> {
  const fallen = page.locator('[data-testid="tile"][data-selected="true"][data-fallen="true"]');
  for (let i = 0; i < 8 && (await fallen.count()) > 0; i += 1) {
    await page.getByTestId('tile-grid').press('ArrowRight');
  }
  await expect(fallen).toHaveCount(0);
}

// Two quarters, the target's and a decoy, each with its tag (O61). The bot guesses at random
// from the start: a guess on a tag's tile takes the tag's place (T144), as CI saw once on
// Firefox, so one tag with a guessed tile in a quarter also holds.
async function twoHints(page: Page): Promise<void> {
  const tags = page.getByTestId('hint-tag');
  const inQuarter = page.locator('[data-testid="tile"][data-quarter="true"][data-who]');
  await expect
    .poll(async () => {
      const n = await tags.count();
      return n === 2 || (n === 1 && (await inQuarter.count()) > 0);
    })
    .toBe(true);
  await expect(tags.first()).toHaveText('Hint');
}

// The phone round's parts top to bottom (bar, board, list, dock), the grid's and the stage's
// width and how far the page scrolls; a missing part counts as past the screen.
async function phoneParts(page: Page) {
  return page.evaluate(() => {
    const rows = ['.focus-bar', '.round-stage', '.round-main', '.round-input'].map((s) =>
      document.querySelector(s)?.getBoundingClientRect(),
    );
    const width = (s: string) => document.querySelector(s)?.getBoundingClientRect().width ?? 0;
    return {
      tops: rows.map((r) => r?.top ?? 1e9),
      bottoms: rows.map((r) => r?.bottom ?? 1e9),
      gridWidth: width('[data-testid="tile-grid"]'),
      stageWidth: width('.round-stage'),
      pageScroll: (document.scrollingElement?.scrollHeight ?? 0) - window.innerHeight,
    };
  });
}

// A small phone, and the same with its on-screen keyboard open (300 px less): the bar, the
// board, the list and the dock never overlap, the dock stays on the screen and the page does
// not scroll; with the room, the board keeps the screen's width (O111, T394).
async function smallPhone(page: Page): Promise<void> {
  for (const height of [667, 367]) {
    await page.setViewportSize({ width: 375, height });
    await page.reload();
    await roundOpen(page);
    const at = `${String(height)} px`;
    const parts = await phoneParts(page);
    // Each part's top at or under the one before's bottom (1 px of rounding).
    for (let i = 1; i < parts.tops.length; i += 1) {
      expect(parts.tops[i], `${at}: in order, no overlap`).toBeGreaterThanOrEqual(
        (parts.bottoms[i - 1] ?? 0) - 1,
      );
    }
    expect(parts.bottoms.at(-1), `${at}: the dock on the screen`).toBeLessThanOrEqual(height);
    expect(parts.pageScroll, `${at}: no page scroll`).toBeLessThanOrEqual(0);
    if (height === 667) expect(parts.gridWidth).toBeGreaterThanOrEqual(parts.stageWidth - 20);
  }
  await page.setViewportSize(WIDE);
}

test('journey 22: Seasonal Target, warm/cold only (the default) and distance only', async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const p = await person(browser, 'player-1', WIDE);
  const codes: string[] = [];
  const own = p.page.locator('[data-testid="tile"][data-own="true"]');
  try {
    codes.push(await fromLobby(p, 'seasonal-target', 'spring'));
    await expect(p.page.getByTestId('intro-secret')).toHaveText('Shared target on a 20 × 20 grid');
    await roundOpen(p.page);
    await expect(p.page.locator('[data-testid="tile"][data-quarter="true"]').first()).toBeVisible();
    await twoHints(p.page);
    // The grid on the left of the list (the board layout).
    const grid = await p.page.getByTestId('tile-grid').boundingBox();
    const list = await p.page.locator('.round-log').boundingBox();
    expect((grid?.x ?? 0) < (list?.x ?? 0)).toBe(true);
    await selectByHand(p.page);
    await p.page.getByTestId('guess-button').click();
    // Warm/cold only, the default (O53): a tier word, no distance; the own tile its colour step
    // and its frame, but no number.
    const first = ownRows(p.page).first().locator('.round-answer');
    await expect(first).not.toHaveText('', { timeout: 10_000 });
    await expect(first).not.toHaveText(/away/);
    await expect(own).toHaveCount(1);
    await expect(own).toHaveAttribute('data-step', /^([1-5]|k[1-7]|correct)$/);
    await expect(own).not.toHaveText(/\d/);
    await fitsBoth(p.page);

    // Individual, autumn, distance only (set explicitly): tiles fall, then the distance in the
    // answer and on the tile. The fall before any guess: a fall takes only tiles that fit
    // every answer so far, and two distance answers to two targets leave almost none; a 60 s
    // cooldown keeps the bot from finding its target and ending the round (CI, night 6).
    const started = await direct(p, {
      gameId: 'seasonal-target',
      mode: 'individual',
      season: 'autumn',
      cooldownS: 60,
      settings: { 'target.feedback': 'distance' },
    });
    codes.push(started.matchCode);
    await expect(p.page.locator('[data-testid="tile"][data-fallen="true"]').first()).toBeVisible({
      timeout: 30_000,
    });
    await standingSelected(p.page);
    await p.page.getByTestId('guess-button').click();
    await expect(ownRows(p.page).first().locator('.round-answer')).toHaveText(DISTANCE, {
      timeout: 10_000,
    });
    await expect(own).toHaveAttribute('data-step', /^([1-5]|k[1-7]|correct)$/);
    await expect(own).toHaveText(/\d/);
    await fitsBoth(p.page);
    await smallPhone(p.page);
  } finally {
    for (const code of codes) await abortMatch(p, code);
    await closeAll([p]);
  }
});
