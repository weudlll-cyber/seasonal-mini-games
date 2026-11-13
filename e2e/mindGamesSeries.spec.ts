/**
 * @file   e2e/mindGamesSeries.spec.ts
 * @module e2e
 * @brief  Journey 39: a series of three Seasonal Mind Games rounds.
 *
 * Responsibility: 09 §4 journey 39 as far as the platform lets a page play it (chain MG-N2), in
 *                 a match made by hand without bots, so every choice is a pre-pick and the
 *                 standings are known: three rounds with pause 5 s and short timings; the result
 *                 shows "Round 1 of 3 · Next round in 5 s"; the host's Start next round now starts
 *                 round 2 at once; a second player who joins in the pause plays round 2 by a
 *                 pre-pick; with All on in round 3 (saved as the next round's settings) the host's
 *                 All scores 2; the standings add up over the rounds (host 1 + 1 + 2, player 1
 *                 + 0 + 1); after round 3 the match summary says "All 3 rounds are played.", also
 *                 after a reload. Not here (morning sheet G1): the third player who joins during
 *                 round 2's join time and plays it with a click.
 * Depends on:     @playwright/test, ./mindGames, ./play
 * Spec:           docs/spec/09-testing-strategy.md §4 (journey 39); docs/spec/02e-game-mind-games.md §2
 */
import { expect, test } from '@playwright/test';

import { abortMatch, call, closeAll, person, playerRow, visit, type Person } from './play.js';

const WIDE = { width: 1280, height: 720 };

const settings = (all: boolean) => ({
  'mind.totalS': 30,
  'mind.delayS': 5,
  'mind.rounds': 3,
  'mind.pauseS': 5,
  'mind.allOption': all,
  'round.countdownS': 3,
  // In Season may be unavailable on the day the test runs: the host picks winter.
  'round.seasonSource': 'manual',
});

const prefs = (p: Person, code: string, picks: Readonly<Record<string, string>>) =>
  call(p, 'PUT', `/matches/${code}/prefs`, { prefs: { picks } });

// The match standings' row of a player: their points and wins.
const standing = (host: Person, name: string) =>
  host.page.getByTestId('match-standings').locator('tr', { hasText: name });

test('journey 39: a series of three Mind Games rounds, the standings add up', async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const host = await person(browser, 'host', WIDE);
  const one = await person(browser, 'player-1', WIDE);
  const two = await person(browser, 'player-2', WIDE);
  const m = await call<{ code: string }>(host, 'POST', '/matches', {
    gameId: 'mind-games',
    title: 'e2e series',
    maxPlayers: 10,
  });
  try {
    await call(one, 'POST', `/matches/${m.code}/join`, {});
    await prefs(host, m.code, { '1': 'spring', '2': 'summer', '3': 'all' });
    await prefs(one, m.code, { '1': 'winter', '2': 'winter', '3': 'winter' });
    for (const p of [host, one]) await visit(p, m.code);
    // A player counts for the first round's minimum once their page watches the match.
    await expect(playerRow(host, 'dev-player-1')).toContainText('online');
    await call(host, 'POST', `/matches/${m.code}/rounds`, {
      season: 'winter',
      settings: settings(false),
      startNow: true,
    });
    // Round 1: Spring and Winter once each, both least chosen.
    await expect(host.page.getByText(/Round 1 of 3 · Next round in \d s/)).toBeVisible({
      timeout: 40_000,
    });
    await call(two, 'POST', `/matches/${m.code}/join`, {});
    await prefs(two, m.code, { '2': 'winter' });
    await host.page.getByRole('button', { name: 'Start next round now' }).first().click();
    await expect(host.page.getByTestId('round-intro')).toBeVisible({ timeout: 4_000 });
    await call(host, 'PUT', `/matches/${m.code}/next-round`, {
      season: 'winter',
      settings: settings(true),
    });
    // Round 2: the second player plays by their pre-pick, named in the feed one delay late.
    await expect(host.page.locator('.round-main')).toContainText(/dev-player-2\s*chose Winter/, {
      timeout: 20_000,
    });
    await expect(host.page.getByText(/Round 2 of 3/)).toBeVisible({ timeout: 40_000 });
    // Round 3 opens by itself after the pause; then the match closes after its pause.
    await expect(host.page.getByText('All 3 rounds are played.')).toBeVisible({ timeout: 70_000 });
    await expect(standing(host, 'dev-host')).toContainText(/4\s*3/);
    await expect(standing(host, 'dev-player-1')).toContainText(/2\s*2/);
    await host.page.reload();
    await expect(host.page.getByText('All 3 rounds are played.')).toBeVisible();
  } finally {
    await abortMatch(host, m.code);
    await closeAll([host, one, two]);
  }
});
