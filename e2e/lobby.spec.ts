/**
 * @file   e2e/lobby.spec.ts
 * @module e2e
 * @brief  Journey 12: the Quick Test through the lobby, two rounds, End match and the summary.
 *
 * Responsibility: the player starts the Quick Test from its form with "Start from the lobby"
 *                 on (O24) and lands in the waiting area (O23); the bots join one after another
 *                 and show as online with a team; the player picks a team, which shows pressed;
 *                 the host menu starts the round with the normal Start; the round runs with the
 *                 bots playing; the result names the closest miss (O22), or the margin when a
 *                 second correct guess came in its window; the waiting area for the next round
 *                 follows the result with the player's team kept and no team buttons (O26); a
 *                 second round from the host menu; then End match with its confirm sentence and
 *                 the match summary with both rounds, the players and the way back (O27), on one
 *                 screen at 1280 × 720 and 390 × 844; beside the result the chat is a panel of
 *                 its own, apart from "Next round". Journey 19: the summary of a match of 12
 *                 players fits one screen at both sizes.
 * Depends on:     @playwright/test, ./play
 * Spec:           docs/spec/09-testing-strategy.md §4 (journey 12); docs/spec/02-game-guess-the-number.md §2, §9
 */
import { expect, test, type Page } from '@playwright/test';

import {
  abortMatch,
  call,
  closeAll,
  fitsScreen,
  hostMenu,
  hostRound,
  person,
  playerRow,
  roundOpen,
  search,
  type Person,
} from './play.js';
import { PHONE } from './screens.js';

const WIDE = { width: 1280, height: 720 };

// The summary fits one screen at both sizes, the standings scrolling inside their own box.
async function summaryFits(page: Page): Promise<void> {
  for (const size of [WIDE, PHONE]) {
    await page.setViewportSize(size);
    await expect(page.getByTestId('match-summary')).toBeVisible();
    await fitsScreen(page);
    await expect(page.getByRole('link', { name: 'Back to Play' })).toBeInViewport();
  }
}

// The result, with the closest miss unless a second correct guess set the margin (O13, O22).
async function resultShown(page: Page): Promise<void> {
  const result = page.getByTestId('result');
  await expect(result).toBeVisible({ timeout: 60_000 });
  if ((await result.getByTestId('margin').count()) === 0) {
    await expect(result.getByTestId('closest-miss')).toHaveText(
      /^Closest miss besides the winner: .+, (missed by just [12]|\d+ away) \(\d+\)\.$/,
    );
  }
}

// From the form with "Start from the lobby" on to a team picked; the match code.
async function startFromLobby(p: Person): Promise<string> {
  await p.page.goto('./#/quick-test');
  const form = p.page.getByTestId('quick-test');
  await expect(form.getByTestId('quick-lobby')).toBeChecked();
  await form.getByTestId('seed').fill('acorn');
  await form.getByLabel('Lowest number').and(form.locator('input')).fill('1');
  await form.getByLabel('Highest number').and(form.locator('input')).fill('100');
  await form.getByTestId('start-quick-test').click();
  await expect(p.page.getByTestId('waiting-area')).toBeVisible();
  const code = /#\/match\/(\w+)/.exec(p.page.url())?.[1] ?? '';
  // The bots arrive one after another, each with a team, and online.
  for (const bot of ['bot-01', 'bot-02', 'bot-03'])
    await expect(playerRow(p, bot)).toContainText('online', { timeout: 10_000 });
  await expect(p.page.getByTestId('match-players').locator('li img')).toHaveCount(3);
  // The team column is a named icon (T212); no team yet is a named dash.
  await expect(
    playerRow(p, 'dev-player-1').getByRole('img', { name: 'no team yet' }),
  ).toBeVisible();
  const summer = p.page
    .getByRole('group', { name: 'Season team' })
    .getByRole('button', { name: 'Summer' });
  await summer.click();
  await expect(summer).toHaveAttribute('aria-pressed', 'true');
  await expect(p.page.getByTestId('waiting-state')).toContainText('set up');
  return code;
}

// End match from the host menu, and the summary of the two rounds (O27).
async function endMatch(p: Person): Promise<void> {
  await hostMenu(p);
  await p.page.getByTestId('end-match').click();
  await expect(p.page.getByTestId('end-match-confirm')).toHaveText(
    'End this match for everyone? A running round is aborted.',
  );
  await p.page.getByTestId('end-match-yes').click();
  const summary = p.page.getByTestId('match-summary');
  await expect(summary).toBeVisible();
  await expect(summary.getByTestId('match-end')).toHaveText('The host ended the match.');
  await expect(summary).toContainText('2 rounds played.');
  await expect(summary.getByTestId('match-standings').locator('tbody tr')).toHaveCount(4);
  await expect(summary.getByRole('link', { name: 'Back to Play' })).toBeVisible();
  await summaryFits(p.page);
  // The closed match stays readable at its address.
  await p.page.reload();
  await expect(p.page.getByTestId('match-summary')).toBeVisible();
}

// The waiting area beside the result: "Next round" with its status and players, and the chat
// as a panel of its own, not inside it (on a phone behind its "Chat" button).
async function chatApart(page: Page): Promise<void> {
  const waiting = page.getByTestId('waiting-area');
  await expect(waiting.getByTestId('round-chat')).toHaveCount(0);
  await expect(page.getByTestId('round-chat')).toBeVisible();
  await expect(page.getByTestId('round-chat').getByRole('heading', { name: 'Chat' })).toBeVisible();
}

test('journey 12: the Quick Test through the lobby, two rounds, End match and the summary', async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const p = await person(browser, 'player-1');
  let code = '';
  try {
    code = await startFromLobby(p);
    // The normal Start in the host menu.
    await hostMenu(p);
    await p.page.getByTestId('host-console').getByTestId('start-round').click();
    // The intro with the form's countdown (the setting's default), then the round (O36).
    await expect(p.page.getByTestId('round-intro')).toContainText('Spring Herald');
    await roundOpen(p.page);
    await search(p);
    await resultShown(p.page);
    // The next round's area: the team is kept for the match, no buttons any more (O26).
    const teams = p.page.getByRole('group', { name: 'Season team' });
    await expect(p.page.getByTestId('waiting-area')).toContainText('Next round');
    await chatApart(p.page);
    await expect(teams).toHaveCount(0);
    await expect(
      playerRow(p, 'dev-player-1').getByRole('img', { name: 'Team Summer' }),
    ).toBeVisible();
    // A second round from the host menu, then End match.
    await hostRound(p, { 'Highest number': '100' });
    await search(p);
    await resultShown(p.page);
    await expect(teams).toHaveCount(0);
    await endMatch(p);
  } finally {
    // An ended match is left as it is; abort only one still running.
    if (code !== '' && !(await p.page.getByTestId('match-summary').isVisible()))
      await abortMatch(p, code);
    await closeAll([p]);
  }
});

test('journey 19: the summary of a 12-player match fits one screen', async ({ browser }) => {
  test.setTimeout(120_000);
  const p = await person(browser, 'player-1', WIDE);
  let code = '';
  try {
    const started = await call<{ matchCode: string }>(p, 'POST', '/dev/quicktest', {
      season: 'autumn',
      bots: 11,
      rangeHigh: 1_000_000,
    });
    code = started.matchCode;
    await p.page.goto(`./#/match/${code}`);
    await roundOpen(p.page);
    // The host ends the round, then the match.
    await hostMenu(p);
    await p.page.getByTestId('host-console').getByTestId('end-round').click();
    await expect(p.page.getByTestId('result')).toBeVisible({ timeout: 15_000 });
    await hostMenu(p);
    await p.page.getByTestId('end-match').click();
    await p.page.getByTestId('end-match-yes').click();
    const rows = p.page.getByTestId('match-standings').locator('tbody tr');
    await expect(rows).toHaveCount(12);
    await summaryFits(p.page);
    await p.page.setViewportSize(WIDE);
    await expect(rows.last()).toBeInViewport();
  } finally {
    if (code !== '' && !(await p.page.getByTestId('match-summary').isVisible()))
      await abortMatch(p, code);
    await closeAll([p]);
  }
});
