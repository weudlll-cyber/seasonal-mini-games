/**
 * @file   e2e/mindGames.spec.ts
 * @module e2e
 * @brief  Journey 38: one round of Seasonal Mind Games with the owner playing along.
 *
 * Responsibility: 09 §4 journey 38 as far as the platform lets a page play it (chain MG-N2): a
 *                 Quick Test through the lobby with seed `acorn`, 7 bots, total 60 s, delay
 *                 10 s, join 30 s, switches `perPlayer`; the intro names the rule and the timing;
 *                 for the first 10 s the feed says when the first choices show; the player's
 *                 Winter, entered by a pre-pick, shows as "You chose Winter" and the bots'
 *                 named first choices only once they are 10 s old; with the box ticked a switch
 *                 changes only the counts, unticked it adds a line with from → to, and its icon
 *                 flies only once it is in the feed; with reduced motion nothing flies; after
 *                 50 s a click says "Choices are closed …"; the round view fits 1280 × 720 with the Chat
 *                 panel open, with the flight band over no button, line or chat, and 390 × 844;
 *                 every input has a tooltip; axe passes; the result page shows. Not here,
 *                 waiting for the owner (morning sheet G1, G2, G11): the first choice by a click
 *                 (G1), the buttons disabled by phase, "every change is now a switch" (G2), and
 *                 the result's least chosen option with its winners and light-up (G11). A Quick
 *                 Test match has seats for its bots and the host only (G12): the late second
 *                 player and its `JOIN_CLOSED` are journey 41's, in a match made by hand.
 * Depends on:     @playwright/test, @axe-core/playwright, ./mindGames, ./play, ./screens
 * Spec:           docs/spec/09-testing-strategy.md §4 (journey 38); docs/spec/02e-game-mind-games.md
 */
import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { feedHead, mindQuickTest, startRound } from './mindGames.js';
import { abortMatch, closeAll, fitsScreen, person, roundOpen, type Person } from './play.js';
import { PHONE } from './screens.js';

const WIDE = { width: 1280, height: 720 };
const list = (page: Page) => page.locator('.round-main');
const choice = (page: Page, name: string) => page.getByRole('radio', { name: new RegExp(name) });

// The flight band's box overlaps no button, no line of the list and no chat panel.
async function bandClear(page: Page): Promise<void> {
  const covered = await page.evaluate(() => {
    const band = document.querySelector('[data-testid="flight-band"]')?.getBoundingClientRect();
    if (band === undefined) return ['no band'];
    const parts = document.querySelectorAll(
      '.mg-choice, .round-main li, [data-testid="round-chat"]',
    );
    return [...parts]
      .filter((e) => {
        const o = e.getBoundingClientRect();
        return !(
          o.right <= band.left ||
          o.left >= band.right ||
          o.bottom <= band.top ||
          o.top >= band.bottom
        );
      })
      .map((e) => e.className);
  });
  expect(covered, 'the flight band covers nothing').toEqual([]);
}

// Counts every flight the page ever draws, however short.
async function countFlights(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { flights: number };
    w.flights = 0;
    new MutationObserver((records) => {
      for (const r of records)
        for (const n of r.addedNodes)
          if (n instanceof Element && n.matches('.mg-flight')) w.flights += 1;
    }).observe(document.body, { subtree: true, childList: true });
  });
}

const flightsSeen = (page: Page) =>
  page.evaluate(() => (window as unknown as { flights: number }).flights);

async function axeClean(page: Page): Promise<void> {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const serious = result.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(serious.map((v) => v.id)).toEqual([]);
}

// The first 10 s: nothing in the feed yet; then the own line and the bots' named lines.
async function delayedFirstChoices(p: Person, opened: number): Promise<void> {
  await expect(feedHead(p.page)).toHaveText('The first choices show 10 s after they are made.');
  await expect(list(p.page)).not.toContainText('chose');
  // A row's name and its words are apart in the row: the list's text holds both.
  await expect(list(p.page)).toContainText(/You\s*chose Winter/, { timeout: 15_000 });
  expect(Date.now() - opened, 'the own line only once it is 10 s old').toBeGreaterThan(9_000);
  await expect(list(p.page)).toContainText(/bot-0\d\s*chose/, { timeout: 40_000 });
  await expect(feedHead(p.page)).toHaveText(/^The round 10 s ago: \d+ players?$/);
}

// A hidden switch changes only the counts; a named one gets its line and its flight.
async function switches(p: Person): Promise<void> {
  const page = p.page;
  await expect(choice(page, 'Winter')).toHaveAttribute('aria-checked', 'true');
  await page.getByLabel('Hide my switches').check();
  await choice(page, 'Autumn').click();
  await expect(choice(page, 'Autumn')).toHaveAttribute('aria-checked', 'true');
  await page.getByLabel('Hide my switches').uncheck();
  await page.waitForTimeout(1_500);
  await choice(page, 'Spring').click();
  const flight = page.locator('.mg-flight[data-from="autumn"][data-to="spring"]');
  await expect(flight).toHaveCount(0);
  // The icon flies once the switch reaches the feed, 10 s later, with its line.
  await expect(flight).toHaveCount(1, { timeout: 15_000 });
  await expect(list(page)).toContainText(/You\s*switched Autumn → Spring/, { timeout: 15_000 });
  await expect(list(page)).not.toContainText(/switched Winter/);
}

test('journey 38: one round of Seasonal Mind Games, everything one delay late', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const p = await person(browser, 'host', WIDE);
  const calm = await person(browser, 'guest', WIDE);
  let code = '';
  try {
    code = await mindQuickTest(p, {
      fields: { 'Total length': '60', Delay: '10', Switches: 'perPlayer' },
      picks: { 1: 'winter' },
    });
    await startRound(p);
    await expect(p.page.getByTestId('round-intro')).toContainText(
      'Pick a season. The least chosen wins. Join within 0:30 · choices close at 0:50 · everyone sees the round 10 s late',
    );
    await roundOpen(p.page);
    const opened = Date.now();
    await calm.page.emulateMedia({ reducedMotion: 'reduce' });
    await calm.page.goto(`./#/match/${code}`);
    await countFlights(calm.page);
    await countFlights(p.page);
    await delayedFirstChoices(p, opened);
    for (const box of await p.page.locator('.mg-choice').all()) {
      expect(await box.getAttribute('title')).toMatch(/^Choose \w+\. You can switch until 0:50\.$/);
    }
    expect(await p.page.locator('label.mg-hide').getAttribute('title')).toBeTruthy();
    await switches(p);
    // The same waves flew on the player's page, none on the reduced-motion one.
    expect(await flightsSeen(p.page)).toBeGreaterThan(0);
    expect(await flightsSeen(calm.page)).toBe(0);
    await p.page.getByTestId('focus-chat').click();
    await fitsScreen(p.page);
    await bandClear(p.page);
    await p.page.keyboard.press('Escape');
    await axeClean(p.page);
    // After the play's end: a click is refused in words.
    await expect.poll(() => Date.now() - opened, { timeout: 40_000 }).toBeGreaterThan(51_000);
    await choice(p.page, 'Summer').click();
    await expect(p.page.getByText('Choices are closed for this round.')).toBeVisible();
    await p.page.setViewportSize(PHONE);
    await fitsScreen(p.page);
    await bandClear(p.page);
    await p.page.setViewportSize(WIDE);
    await expect(p.page.getByTestId('result')).toBeVisible({ timeout: 20_000 });
  } finally {
    if (code !== '') await abortMatch(p, code);
    await closeAll([p, calm]);
  }
});
