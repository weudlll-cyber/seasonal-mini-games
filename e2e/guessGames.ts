/**
 * @file   e2e/guessGames.ts
 * @module e2e
 * @brief  Helpers for the journeys of the guess games (20–22): a Quick Test of a chosen game.
 *
 * Responsibility: start a game's Quick Test from the form through the lobby (O24, O41) and
 *                 start the round from the host menu, or start one directly through the API
 *                 (individual rounds, other seasons); check that the round view fits one
 *                 screen at 1280 × 720 and, after a reload at that size, at 390 × 844.
 * Depends on:     @playwright/test, ./play, ./screens
 * Used by:        ./safecracker.spec, ./bombDefusal.spec, ./target.spec
 * Spec:           docs/spec/09-testing-strategy.md §4 (journeys 20–22)
 */
import { expect, type Page } from '@playwright/test';

import { call, fitsScreen, hostMenu, playerRow, roundOpen, type Person } from './play.js';
import { PHONE } from './screens.js';

export const WIDE = { width: 1280, height: 720 };

type Season = 'spring' | 'summer' | 'autumn' | 'winter';

// The form: the game, the seed `acorn`, a season, fast specials (on by default), from the
// lobby (on by default); then the host's Start. The match code.
export async function fromLobby(p: Person, game: string, season: Season): Promise<string> {
  await p.page.goto('./#/quick-test');
  const form = p.page.getByTestId('quick-test');
  await form.getByTestId('quick-game').selectOption(game);
  await expect(form.getByTestId('quick-lobby')).toBeChecked();
  await form.getByTestId('seed').fill('acorn');
  // One bot: three could solve a short search with their first guesses, before the player.
  await form.getByLabel('Bots').fill('1');
  // The season's select: the one with the seasons among its options.
  await form.locator('select:has(option[value="spring"])').selectOption(season);
  await form.getByTestId('start-quick-test').click();
  await expect(p.page.getByTestId('waiting-area')).toBeVisible();
  await expect(p.page.getByTestId('match-game')).toBeVisible();
  const code = /#\/match\/(\w+)/.exec(p.page.url())?.[1] ?? '';
  // The bot arrives within about 2 s; a round needs two players.
  await expect(playerRow(p, 'bot-01')).toContainText('online', { timeout: 10_000 });
  await hostMenu(p);
  await p.page.getByTestId('host-console').getByTestId('start-round').click();
  await expect(p.page.getByTestId('round-intro')).toBeVisible();
  return code;
}

// A round started at once through the API, with the game's own settings; its match code.
export async function direct(
  p: Person,
  body: Readonly<Record<string, unknown>>,
): Promise<{ readonly matchCode: string; readonly roundId: string }> {
  const started = await call<{ matchCode: string; roundId: string }>(p, 'POST', '/dev/quicktest', {
    seedText: 'acorn',
    fast: true,
    bots: 1,
    cooldownS: 3,
    ...body,
  });
  await p.page.goto(`./#/match/${started.matchCode}`);
  await roundOpen(p.page);
  return started;
}

// The round view on one screen at both sizes (owner's screen rule).
export async function fitsBoth(page: Page): Promise<void> {
  await page.setViewportSize(WIDE);
  await fitsScreen(page);
  await page.setViewportSize(PHONE);
  await page.reload();
  await roundOpen(page);
  await fitsScreen(page);
  await page.setViewportSize(WIDE);
}
