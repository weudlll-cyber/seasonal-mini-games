/**
 * @file   e2e/seasons.spec.ts
 * @module e2e
 * @brief  Journeys 16 and 17: each season's intro and special in view, and a match without teams.
 *
 * Responsibility: journey 16, once per season with the range shown and the fast test
 *                 profile — the countdown is the intro screen with the season, its special
 *                 and its sentence, the secret line and the cooldown (O36), one screen at
 *                 1280 × 720 and at 390 × 844; once open, the top bar's chip names the special
 *                 and its info button tells what it does; the special's banner appears above
 *                 the guess list in the season colour (O35); Spring Herald's hint stays as a
 *                 highlighted line, Frost holds the player's answer with "answer arriving…";
 *                 the round view fits both sizes. Journey 17 — a Quick Test without teams
 *                 (O34): the waiting area has no team text, buttons or column, the round no
 *                 team tiles, the result no team result. Every match is aborted at the end.
 * Depends on:     @playwright/test, ./play, ./screens
 * Spec:           docs/spec/09-testing-strategy.md §4 (journeys 16, 17); docs/spec/03-seasonal-specials.md §2, §5, §6
 */
import { expect, test, type Page } from '@playwright/test';

import {
  abortMatch,
  call,
  closeAll,
  fitsScreen,
  hostMenu,
  person,
  playerRow,
  roundOpen,
  type Person,
} from './play.js';
import { PHONE } from './screens.js';

const WIDE = { width: 1280, height: 720 };

interface Season {
  readonly season: 'spring' | 'summer' | 'autumn' | 'winter';
  readonly name: string;
  readonly special: string;
  readonly rule: string;
  // The banner's text once the special fires.
  readonly banner: RegExp;
}

const SEASONS: readonly Season[] = [
  {
    season: 'spring',
    name: 'Spring',
    special: 'Spring Herald',
    rule: 'Everyone gets one free hint when the round opens.',
    banner: /^Spring Herald: everyone got a free hint\.$/,
  },
  {
    season: 'summer',
    name: 'Summer',
    special: 'Heatwave',
    rule: 'The waiting time between guesses gets shorter as the round goes on.',
    banner: /^Heatwave: waiting time is now \d+(\.\d)? s\.$/,
  },
  {
    season: 'autumn',
    name: 'Autumn',
    special: 'Leaf Fall',
    rule: 'Every so often, some wrong numbers fall out of the game.',
    banner: /^Leaf Fall: \d+ numbers? fell\.$/,
  },
  {
    season: 'winter',
    name: 'Winter',
    special: 'Frost',
    rule: 'Answers arrive a few seconds late.',
    banner: /^Frost: your answer arrives in \d s\.$/,
  },
];

// The intro fits the screen at both sizes; it ends back at the wide size.
async function introFits(page: Page, s: Season): Promise<void> {
  const intro = page.getByTestId('round-intro');
  await expect(intro).toBeVisible();
  await expect(intro.getByRole('heading', { level: 1 })).toHaveText(s.name);
  await expect(intro.getByTestId('intro-special')).toHaveText(`${s.special}${s.rule}`);
  await expect(intro.getByTestId('intro-secret')).toHaveText(
    'Shared number between 1 and 1,000,000',
  );
  await expect(intro).toContainText('Cooldown 8.0 s between guesses');
  await fitsScreen(page);
  await page.setViewportSize(PHONE);
  await expect(intro).toBeVisible();
  await fitsScreen(page);
  await page.setViewportSize(WIDE);
}

// What sets the special off where the round alone does not: Frost needs a guess of the player.
async function provoke(page: Page, s: Season): Promise<void> {
  if (s.season !== 'winter') return;
  await expect(page.getByTestId('guess-button')).toBeEnabled({ timeout: 10_000 });
  await page.getByTestId('guess-input').fill('500000');
  await page.getByTestId('guess-button').click();
  const own = page.locator('[data-testid="guess-list"] li[data-own="true"]');
  await expect(own.first()).toContainText('answer arriving…');
}

for (const s of SEASONS) {
  test(`journey 16 (${s.season}): the intro and ${s.special} in view, one screen`, async ({
    browser,
  }) => {
    test.setTimeout(90_000);
    const p = await person(browser, 'player-1', WIDE);
    let code = '';
    try {
      const started = await call<{ matchCode: string }>(p, 'POST', '/dev/quicktest', {
        season: s.season,
        bots: 1,
        rangeHigh: 1_000_000,
        rangeVisible: true,
        cooldownS: 8,
        countdownS: 10,
        fast: true,
      });
      code = started.matchCode;
      await p.page.goto(`./#/match/${code}`);
      await introFits(p.page, s);
      await roundOpen(p.page);
      await provoke(p.page, s);
      // The banner above the list, in the season colour (fast profile: within seconds;
      // Spring Herald's at the opening).
      const banner = p.page.getByTestId('special-banner').locator('p');
      await expect(banner).toHaveText(s.banner, { timeout: 15_000 });
      await expect(p.page.getByTestId('round-special')).toHaveText(s.special);
      await p.page.getByTestId('special-info').click();
      await expect(p.page.getByRole('note')).toHaveText(`${s.special}: ${s.rule}`);
      await p.page.keyboard.press('Escape');
      if (s.season === 'spring') {
        await expect(p.page.getByTestId('hint')).toHaveText(
          /^Free hint: the number is (odd|even)\.$/,
        );
      }
      await fitsScreen(p.page);
      await p.page.setViewportSize(PHONE);
      // A phone's chip names the season; the special is behind the info button.
      await expect(p.page.getByTestId('round-season')).toBeVisible();
      await expect(p.page.getByTestId('round-season')).toHaveText(s.name);
      await fitsScreen(p.page);
    } finally {
      if (code !== '') await abortMatch(p, code);
      await closeAll([p]);
    }
  });
}

test('journey 17: a match without teams shows no team anywhere', async ({ browser }) => {
  test.setTimeout(120_000);
  const p: Person = await person(browser, 'player-1', WIDE);
  let code = '';
  try {
    const started = await call<{ matchCode: string }>(p, 'POST', '/dev/quicktest', {
      season: 'spring',
      bots: 2,
      rangeHigh: 1_000_000,
      lobby: true,
      teamMatch: false,
    });
    code = started.matchCode;
    await p.page.goto(`./#/match/${code}`);
    const area = p.page.getByTestId('waiting-area');
    await expect(playerRow(p, 'bot-02')).toContainText('online', { timeout: 10_000 });
    await expect(area).not.toContainText(/team/i);
    await expect(p.page.getByRole('group', { name: 'Season team' })).toHaveCount(0);
    await expect(playerRow(p, 'dev-player-1')).toHaveText(/^dev-player-1\s+(online|away)$/);
    await hostMenu(p);
    await p.page.getByTestId('host-console').getByTestId('start-round').click();
    await roundOpen(p.page);
    await expect(p.page.getByTestId('team-tiles')).toHaveCount(0);
    // The host ends the round; its result has no team result.
    await hostMenu(p);
    await p.page.getByTestId('host-console').getByTestId('end-round').click();
    await expect(p.page.getByTestId('result')).toBeVisible({ timeout: 15_000 });
    await expect(p.page.getByTestId('team-result')).toHaveCount(0);
  } finally {
    if (code !== '') await abortMatch(p, code);
    await closeAll([p]);
  }
});
