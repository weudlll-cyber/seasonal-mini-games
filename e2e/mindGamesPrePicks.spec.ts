/**
 * @file   e2e/mindGamesPrePicks.spec.ts
 * @module e2e
 * @brief  Journey 40: a player's pre-picks play for them while they are away.
 *
 * Responsibility: 09 §4 journey 40: a
 *                 second player sets pre-picks for rounds 1–3 in the waiting area's panel (All
 *                 for round 2, where All is off) and closes their browser; their first choice
 *                 appears in the feed one delay after each opening with their name and no mark;
 *                 round 2 gives them no choice, and after reconnecting they read "Your pre-pick All
 *                 was not offered in round 2."; their points count in the standings; the host's
 *                 match details never hold them.
 * Depends on:     @playwright/test, ./mindGames, ./play
 * Spec:           docs/spec/09-testing-strategy.md §4 (journey 40); docs/spec/02e-game-mind-games.md §7
 */
import { expect, test } from '@playwright/test';

import { prePick } from './mindGames.js';
import { abortMatch, call, closeAll, person, playerRow, visit, type Person } from './play.js';

const WIDE = { width: 1280, height: 720 };
const DELAY_MS = 5_000;
const settings = {
  'mind.totalS': 30,
  'mind.delayS': 5,
  'mind.rounds': 3,
  'mind.pauseS': 5,
  'round.countdownS': 3,
  'round.seasonSource': 'manual',
};

const prefs = (p: Person, code: string, picks: Readonly<Record<string, string>>) =>
  call(p, 'PUT', `/matches/${code}/prefs`, { prefs: { picks } });

test('journey 40: pre-picks play for an away player, seen by nobody else', async ({ browser }) => {
  test.setTimeout(240_000);
  const host = await person(browser, 'host', WIDE);
  const one = await person(browser, 'player-1', WIDE);
  const away = await person(browser, 'player-2', WIDE);
  const m = await call<{ code: string }>(host, 'POST', '/matches', {
    gameId: 'mind-games',
    title: 'e2e pre-picks',
    maxPlayers: 10,
  });
  try {
    for (const p of [one, away]) await call(p, 'POST', `/matches/${m.code}/join`, {});
    for (const p of [host, one, away]) await visit(p, m.code);
    await prePick(away.page, { 1: 'summer', 2: 'all', 3: 'autumn' });
    await away.ctx.close();
    await prefs(host, m.code, { '1': 'spring', '2': 'spring', '3': 'spring' });
    await prefs(one, m.code, { '1': 'winter', '2': 'winter', '3': 'winter' });
    // The host's own details hold the host's value only.
    const details = await call<{ myPrefs: unknown }>(host, 'GET', `/matches/${m.code}`);
    expect(details.myPrefs).toEqual({ picks: { '1': 'spring', '2': 'spring', '3': 'spring' } });
    expect(JSON.stringify(details)).not.toMatch(/summer|autumn|"all"/);
    await expect(playerRow(host, 'dev-player-1')).toContainText('online');
    await call(host, 'POST', `/matches/${m.code}/rounds`, {
      season: 'winter',
      settings,
      startNow: true,
    });
    const list = host.page.locator('.round-main');
    await expect(host.page.locator('[data-testid="round-view"][data-status="open"]')).toBeVisible({
      timeout: 15_000,
    });
    const opened = Date.now();
    await expect(list).toContainText(/dev-player-2\s*chose Summer/, { timeout: 15_000 });
    expect(Date.now() - opened).toBeGreaterThan(DELAY_MS - 1_000);
    // Round 2: All is off, so the away player has no choice in it.
    await expect(host.page.getByText(/Round 1 of 3/)).toBeVisible({ timeout: 40_000 });
    await expect(list).toContainText(/dev-player-1\s*chose Winter/, { timeout: 30_000 });
    await expect(list).not.toContainText('dev-player-2');
    // Back in round 2, the away player reads why they have no choice in it (02e §7).
    const back = await person(browser, 'player-2', WIDE);
    await visit(back, m.code);
    await expect(
      back.page.getByText('Your pre-pick All was not offered in round 2.'),
    ).toBeVisible();
    await back.ctx.close();
    await expect(host.page.getByText('All 3 rounds are played.')).toBeVisible({ timeout: 120_000 });
    // Rounds 1 and 3: three options once each, all least chosen: a point each time.
    const row = host.page.getByTestId('match-standings').locator('tr', { hasText: 'dev-player-2' });
    await expect(row).toContainText(/2\s*2/);
  } finally {
    await abortMatch(host, m.code);
    await closeAll([host, one]);
  }
});
