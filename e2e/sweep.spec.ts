/**
 * @file   e2e/sweep.spec.ts
 * @module e2e
 * @brief  Journey 47: the layout sweep (K67) over every screen.
 *
 * Responsibility: the kit's `sweep` with axe over the player's pages signed out and in, each
 *                 game's screens and the admin areas, at the kit's seven sizes (down to
 *                 320 × 568), at 100 % and 200 % root font, light and dark: no sideways scroll,
 *                 nothing outside the window, no cut text, no control under 44 px, no clipped
 *                 fitted screen and no axe violation. A signed-in test signs in afresh before
 *                 each screen, within the server's request limit. Chromium only: the same
 *                 layout engine runs 28 looks a screen.
 * Depends on:     @playwright/test, @axe-core/playwright, @seasonal/kit/testing, ./play,
 *                 ./sweepScreens, ./testStack
 * Spec:           docs/spec/09-testing-strategy.md §4 (journey 47); kit docs, K67
 */
import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { axeFinder, sweep, type SweepOptions, type SweepScreen } from '@seasonal/kit/testing';

import { abortMatch, closeAll, FROM_THE_PAGE, person, type Person } from './play.js';
import { ADMIN_SCREENS, gameScreens, PLAYER_PAGES, SIGNED_OUT } from './sweepScreens.js';
import { ADMIN_URL, CLIENT_URL } from './testStack.js';

const LOOKS: SweepOptions = { axe: axeFinder(AxeBuilder) };

// A new session for the same person: the server allows a session 120 requests a minute (03
// §13), which a fast runner's looks would pass over several screens.
async function freshSession(p: Person): Promise<void> {
  await p.ctx.clearCookies();
  const r = await p.ctx.request.post('api/v1/dev/sign-in', {
    data: { as: p.who },
    headers: FROM_THE_PAGE,
  });
  expect(r.ok(), `${p.who} signed in again`).toBe(true);
}

// Each screen swept on its own: the kit's sweep ends at the first screen that does not open,
// which would hide every screen after it. One run reports all.
async function sweepAll(
  page: Page,
  screens: readonly SweepScreen[],
  between: () => Promise<void> = () => Promise.resolve(),
): Promise<void> {
  const failed: string[] = [];
  for (const screen of screens) {
    await between();
    try {
      await sweep(page, [screen], LOOKS);
    } catch (error) {
      failed.push(`${screen.name}: ${String(error)}`);
    }
  }
  expect(failed, failed.join('\n\n')).toEqual([]);
}
const GAMES = ['guess-the-number', 'safecracker', 'bomb-defusal', 'seasonal-target', 'mind-games'];

// A screen takes up to four minutes for its 28 looks (Seasonal Target's 400 tiles), so the
// tests run side by side; they change no shared setting. No trace: hundreds of looks make one
// too large to keep, and the sweep's report names each finding.
test.describe.configure({ mode: 'parallel' });
test.setTimeout(1_500_000);
test.use({ trace: 'off' });

test('journey 47: the player pages pass the sweep, signed out', async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: `${CLIENT_URL}/` });
  try {
    await sweepAll(await ctx.newPage(), SIGNED_OUT);
  } finally {
    await ctx.close();
  }
});

test('journey 47: the player pages pass the sweep, signed in', async ({ browser }) => {
  const p = await person(browser, 'player-1');
  try {
    await sweepAll(p.page, PLAYER_PAGES, () => freshSession(p));
  } finally {
    await closeAll([p]);
  }
});

for (const game of GAMES) {
  test(`journey 47: ${game} passes the sweep`, async ({ browser }) => {
    const p = await person(browser, 'host');
    const codes: string[] = [];
    try {
      await sweepAll(p.page, gameScreens(p, game, codes), () => freshSession(p));
    } finally {
      await freshSession(p);
      for (const code of codes) await abortMatch(p, code);
      await closeAll([p]);
    }
  });
}

test('journey 47: the admin areas pass the sweep', async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: `${ADMIN_URL}/` });
  try {
    const admin = await ctx.newPage();
    await admin.goto('./');
    await admin.getByTestId('dev-admin').click();
    await expect(admin.getByRole('navigation', { name: 'Areas' })).toBeVisible();
    await sweepAll(admin, ADMIN_SCREENS);
  } finally {
    await ctx.close();
  }
});
