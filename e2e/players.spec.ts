/**
 * @file   e2e/players.spec.ts
 * @module e2e
 * @brief  Journeys 5, 6 and 7: season teams, a reconnect mid-round, and a guest spectator.
 *
 * Responsibility: journey 5 — four players pick teams, teams are locked once the countdown
 *                 starts, and the team result names the winner's team after the round. Journey 6
 *                 — a reload during a Frost round keeps the cooldown, shows the guess once and
 *                 the held answer arrives after the reload. Journey 7 — a guest watching a round
 *                 under `own` sees that players guessed and never a number or an answer.
 * Depends on:     @playwright/test, ./play
 * Spec:           docs/spec/09-testing-strategy.md §4 (journeys 5, 6, 7); docs/spec/02-game-guess-the-number.md §6.2, §11;
 *                 docs/spec/03-seasonal-specials.md §2.4, §5
 */
import { expect, test } from '@playwright/test';

import {
  abortMatch,
  attempt,
  call,
  closeAll,
  hostRound,
  openMatch,
  person,
  search,
  visit,
} from './play.js';

test('journey 5: season teams lock during the round and the winner team scores', async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const host = await person(browser, 'host');
  const players = [
    await person(browser, 'player-1'),
    await person(browser, 'player-2'),
    await person(browser, 'player-3'),
    await person(browser, 'admin'),
  ];
  const code = await openMatch(host, players, 'journey 5');
  const teams = ['Spring', 'Summer', 'Autumn', 'Winter'];
  try {
    for (const [i, p] of players.entries()) {
      const team = p.page
        .getByRole('group', { name: 'Season team' })
        .getByRole('button', { name: teams[i] ?? 'Spring' });
      await team.click();
      await expect(team).toHaveAttribute('aria-pressed', 'true');
    }
    await hostRound(host, {
      Cooldown: '3',
      'Countdown before opening': '5',
      'Highest number': '20',
      Secret: 'shared',
    });
    const one = players[0];
    if (one === undefined) throw new Error('players');
    // The round view has no team picker; a change through the API is refused while it runs.
    const locked = await attempt(one, 'POST', `/matches/${code}/team`, { team: 'winter' });
    expect(locked.body).toMatchObject({ code: 'TEAMS_LOCKED' });
    await Promise.all(players.map((p) => search(p)));
    await expect(host.page.getByTestId('team-result')).toContainText('1 point — the winner’s team');
  } finally {
    await abortMatch(host, code);
    await closeAll([host, ...players]);
  }
});

test('journey 6: a reload mid-round keeps the cooldown and delivers the held answer', async ({
  browser,
}) => {
  const p = await person(browser, 'player-1');
  const started = await call<{ matchCode: string }>(p, 'POST', '/dev/quicktest', {
    bots: 1,
    season: 'winter',
    cooldownS: 10,
    rangeHigh: 1_000_000,
  });
  try {
    await visit(p, started.matchCode);
    await expect(p.page.getByTestId('guess-button')).toBeEnabled({ timeout: 10_000 });
    await p.page.getByTestId('guess-input').fill('333333');
    await p.page.getByTestId('guess-button').click();
    await expect(p.page.getByTestId('own-guesses')).toContainText('answer arriving in');
    await p.page.reload();
    await expect(p.page.getByTestId('cooldown')).not.toHaveText('Ready');
    await expect(p.page.getByTestId('own-guesses').locator('li')).toHaveCount(1);
    await expect(p.page.getByTestId('own-guesses')).toContainText('The number is', {
      timeout: 10_000,
    });
    await expect(p.page.getByTestId('own-guesses').locator('li')).toHaveCount(1);
  } finally {
    await abortMatch(p, started.matchCode);
    await closeAll([p]);
  }
});

test('journey 7: a guest sees guesses happen but no number under own', async ({ browser }) => {
  const p = await person(browser, 'player-1');
  const guest = await person(browser, 'guest');
  const started = await call<{ matchCode: string }>(p, 'POST', '/dev/quicktest', {
    bots: 3,
    visibility: 'own',
    cooldownS: 3,
    rangeHigh: 1_000_000,
  });
  try {
    await visit(guest, started.matchCode);
    const panel = guest.page.getByTestId('gtn-spectator');
    await expect(panel).toBeVisible({ timeout: 10_000 });
    await expect(guest.page.getByTestId('feed')).toContainText('guessed.', { timeout: 15_000 });
    const seen = `${(await panel.textContent()) ?? ''} ${(await guest.page.getByTestId('feed').textContent()) ?? ''}`;
    expect(seen).not.toMatch(/higher|lower|correct|guessed \d/);
    expect(seen).toMatch(/bot-01: \d+ guess/);
  } finally {
    await abortMatch(p, started.matchCode);
    await closeAll([p, guest]);
  }
});
