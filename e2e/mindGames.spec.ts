/**
 * @file   e2e/mindGames.spec.ts
 * @module e2e
 * @brief  Journey 38: one round of Seasonal Mind Games with the owner playing along.
 *
 * Responsibility: 09 §4 journey 38: a Quick Test through the lobby with seed `acorn`, 7 bots,
 *                 total 60 s, delay 10 s, join 30 s, switches `perPlayer`; the intro names the
 *                 rule and the timing; for the first 10 s the feed counts down to the first
 *                 choices and no count is on the page; the player chooses Winter by a click, sees
 *                 it pressed at once, and sees "You chose Winter" and the bots' named first
 *                 choices only once they are 10 s old, each with its age; with the box ticked a
 *                 switch changes only the counts, unticked it adds a line with from → to, and its
 *                 icon flies only once it is in the feed; with reduced motion nothing flies; after
 *                 30 s a second browser that joins the match finds the buttons off with "Joining
 *                 this round has closed …" and a choice it sends anyway is refused with
 *                 `JOIN_CLOSED`; from 40 s the feed says every change is now a switch; at 50 s the
 *                 buttons are off and the feed says choices are closed while the replay runs; the
 *                 result names the least chosen option, lights it up and lists the winners with
 *                 +1 and the viewer's line, the cards' points equal to the placings table's and
 *                 the match standings' (T340); the round view fits 1280 × 720 with the Chat panel
 *                 open, the flight band over no button, line or chat, and 390 × 844; every input
 *                 has a tooltip; axe passes.
 * Depends on:     @playwright/test, @axe-core/playwright, ./mindGames, ./play, ./screens
 * Spec:           docs/spec/09-testing-strategy.md §4 (journey 38); docs/spec/02e-game-mind-games.md
 */
import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import {
  feedHead,
  guessHttp,
  mindQuickTest,
  resultPoints,
  roundIdOf,
  startRound,
} from './mindGames.js';
import {
  abortMatch,
  call,
  closeAll,
  fitsScreen,
  person,
  roundOpen,
  visit,
  type Person,
} from './play.js';
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

// Records whether a winning option ever lights up: the light lasts about 2 s from the result's
// first frame, which may come before the journey looks.
async function watchLight(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { lit: boolean };
    w.lit = false;
    new MutationObserver(() => {
      if (document.querySelector('.mg-option.smg-anim-win') !== null) w.lit = true;
    }).observe(document.body, { subtree: true, childList: true, attributes: true });
  });
}

async function axeClean(page: Page): Promise<void> {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const serious = result.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(serious.map((v) => v.id)).toEqual([]);
}

// The first 10 s: the feed counts down and shows no count; the own choice is pressed at once;
// its line and the bots' named lines come only once they are 10 s old, each with its age.
async function delayedFirstChoices(p: Person, opened: number): Promise<void> {
  await expect(p.page.getByTestId('feed-note')).toHaveText(/^The first choices show in \d+ s\.$/);
  await expect(p.page.locator('.mg-count')).toHaveCount(0);
  await choice(p.page, 'Winter').click();
  await expect(choice(p.page, 'Winter')).toHaveAttribute('aria-checked', 'true');
  await expect(list(p.page)).not.toContainText('chose');
  // A row's name and its words are apart in the row: the list's text holds both.
  await expect(list(p.page)).toContainText(/You\s*chose Winter\s*· \d+ s ago/, { timeout: 15_000 });
  expect(Date.now() - opened, 'the own line only once it is 10 s old').toBeGreaterThan(9_000);
  await expect(list(p.page)).toContainText(/bot-0\d\s*chose/, { timeout: 40_000 });
  await expect(feedHead(p.page)).toHaveText(/^The round 10 s ago: \d+ players?$/);
}

// A hidden switch changes only the counts; a named one gets its line and its flight.
async function switches(p: Person): Promise<void> {
  const page = p.page;
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

// After the join time a second browser joins the match: it may not enter the round.
async function lateJoiner(late: Person, host: Person, code: string, opened: number) {
  await expect.poll(() => Date.now() - opened, { timeout: 40_000 }).toBeGreaterThan(31_000);
  await call(late, 'POST', `/matches/${code}/join`, {});
  await visit(late, code);
  await expect(late.page.locator('.mg-refusal')).toHaveText(
    'Joining this round has closed. You can play the next round.',
  );
  const radios = late.page.getByRole('radio');
  for (const r of await radios.all()) await expect(r).toBeDisabled();
  const refused = await guessHttp(late, await roundIdOf(host, code), 'summer');
  expect(refused.body).toMatchObject({ code: 'JOIN_CLOSED' });
}

// From 40 s the feed has passed the join time; at 50 s choices close and the replay runs.
async function lastPhases(p: Person, opened: number): Promise<void> {
  const note = p.page.getByTestId('feed-note');
  await expect.poll(() => Date.now() - opened, { timeout: 40_000 }).toBeGreaterThan(41_000);
  await expect(note).toHaveText(/^All \d+ players are in\. Every change now is a switch\.$/);
  await expect.poll(() => Date.now() - opened, { timeout: 40_000 }).toBeGreaterThan(51_000);
  await expect(note).toHaveText(/^Choices are closed\. Replay of the last 10 s of play/);
  for (const r of await p.page.getByRole('radio').all()) await expect(r).toBeDisabled();
}

// The result: the least chosen option named and lit, its winners with +1, the viewer's line.
async function result(p: Person): Promise<void> {
  await expect(p.page.getByTestId('result')).toBeVisible({ timeout: 20_000 });
  await expect(p.page.getByTestId('closest-miss')).toHaveText(
    /least chosen( place)? — \d+ players? wins?\./,
  );
  const options = p.page.getByTestId('mind-result');
  const lit = () => p.page.evaluate(() => (window as unknown as { lit: boolean }).lit);
  await expect.poll(lit, { message: 'a winning option lit up' }).toBe(true);
  await expect(options.getByText('✓ wins').first()).toBeVisible();
  await expect(options.locator('.mg-points').first()).toHaveText(/\+[12]/);
  await expect(options.locator('li[data-own="true"]')).toHaveText(/^You/);
  // The cards' points are the table's and, after one round, the match standings' (T340).
  await expect(p.page.getByTestId('match-standings')).toBeVisible();
  const got = await resultPoints(p.page);
  expect(
    Object.values(got.cards).some((n) => n > 0),
    'someone won points',
  ).toBe(true);
  expect(got.table, 'the placings table').toEqual(got.cards);
  expect(got.standings, 'the match standings').toEqual(got.cards);
}

test('journey 38: one round of Seasonal Mind Games, everything one delay late', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const p = await person(browser, 'host', WIDE);
  const calm = await person(browser, 'guest', WIDE);
  const late = await person(browser, 'player-2', WIDE);
  let code = '';
  try {
    code = await mindQuickTest(p, {
      fields: { 'Total length': '60', Delay: '10', Switches: 'perPlayer' },
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
    await lateJoiner(late, p, code, opened);
    await watchLight(p.page);
    await lastPhases(p, opened);
    await p.page.setViewportSize(PHONE);
    await fitsScreen(p.page);
    await bandClear(p.page);
    await p.page.setViewportSize(WIDE);
    await result(p);
  } finally {
    if (code !== '') await abortMatch(p, code);
    await closeAll([p, calm, late]);
  }
});
