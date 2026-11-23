/**
 * @file   e2e/access.spec.ts
 * @module e2e
 * @brief  Journey 9: accessibility — axe on every screen at two sizes; guessing by keyboard only.
 *
 * Responsibility: no serious or critical axe violation (WCAG 2.2 AA rules) on the lobby, a
 *                 running round and its result; a player reaches the guess field with Tab,
 *                 types a number and sends it with Enter, without a mouse (02 §12). Journey 9b:
 *                 the same check on every other screen at 1280 × 720 and 390 × 844, the
 *                 leaderboard, a profile, the account page (and on a phone the header's menu),
 *                 every admin area, focus mode with its Players panel, and a docked match's
 *                 chat (on a phone its sheet); the WCAG 2.2 AA tags hold axe's `target-size`,
 *                 24 px pointer targets (kit DECISIONS K33, WCAG 2.5.8).
 * Depends on:     @playwright/test, @axe-core/playwright, ./play, ./testStack
 * Spec:           docs/spec/09-testing-strategy.md §4 (journey 9); docs/spec/02-game-guess-the-number.md §12
 */
import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Browser, type Page } from '@playwright/test';

import { abortMatch, call, closeAll, hostMenu, ownRows, person } from './play.js';
import { ADMIN_URL } from './testStack.js';

async function noSeriousViolations(page: Page, where: string): Promise<void> {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const serious = result.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
  expect(serious, `axe on the ${where}`).toEqual([]);
}

test('journey 9: lobby, round and result pass axe; a guess by keyboard only', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const p = await person(browser, 'player-1');
  await noSeriousViolations(p.page, 'lobby');
  const started = await call<{ matchCode: string }>(p, 'POST', '/dev/quicktest', {
    bots: 1,
    cooldownS: 3,
    rangeHigh: 1_000_000,
    fast: false,
  });
  try {
    await p.page.goto(`./#/match/${started.matchCode}`);
    const input = p.page.getByTestId('guess-input');
    await expect(p.page.getByTestId('guess-button')).toBeEnabled({ timeout: 10_000 });
    await noSeriousViolations(p.page, 'round');
    // Keyboard only: Tab until the guess field has the focus, type, Enter.
    for (
      let i = 0;
      i < 60 && !(await input.evaluate((el) => el === document.activeElement));
      i += 1
    ) {
      await p.page.keyboard.press('Tab');
    }
    await expect(input).toBeFocused();
    await p.page.keyboard.type('10');
    await p.page.keyboard.press('Enter');
    await expect(ownRows(p.page).first()).toContainText('10');
    // The Quick Test player hosts the round: End round in the host menu brings the result.
    await hostMenu(p);
    await p.page.getByTestId('end-round').click();
    await expect(p.page.getByTestId('result')).toBeVisible({ timeout: 10_000 });
    await noSeriousViolations(p.page, 'result');
  } finally {
    await abortMatch(p, started.matchCode);
    await closeAll([p]);
  }
});

// The two sizes every other screen is checked at; axe's wcag22aa tag set holds `target-size`,
// the 24 px pointer targets (kit DECISIONS K33, WCAG 2.5.8).
const SIZES = [
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
] as const;
type Size = (typeof SIZES)[number];
const at = (size: Size, where: string) =>
  `${where} at ${String(size.width)} × ${String(size.height)}`;

// The boards, a profile and the account page; on a phone also the header's folded menu.
async function boardsAndAccount(browser: Browser, size: Size): Promise<void> {
  const p = await person(browser, 'player-1', size);
  try {
    await p.page.goto('./#/leaderboard');
    await expect(p.page.getByTestId('leaderboard')).toBeVisible();
    await noSeriousViolations(p.page, at(size, 'leaderboard'));
    await p.page.goto('./#/players/dev-player-1');
    await expect(
      p.page.getByTestId('profile-facts').or(p.page.getByTestId('profile-missing')),
    ).toBeVisible();
    await noSeriousViolations(p.page, at(size, 'profile'));
    await p.page.goto('./#/account');
    await expect(
      p.page.getByTestId('account-no-password').or(p.page.getByTestId('password-form')),
    ).toBeVisible();
    await noSeriousViolations(p.page, at(size, 'account settings'));
    if (size.width < 640) {
      await p.page.getByTestId('menu-button').click();
      await expect(p.page.getByTestId('signed-in-as')).toBeVisible();
      await noSeriousViolations(p.page, at(size, "header's menu"));
    }
  } finally {
    await closeAll([p]);
  }
}

// Every area of the admin app, signed in as the development admin.
async function adminPages(browser: Browser, size: Size): Promise<void> {
  const ctx = await browser.newContext({ baseURL: `${ADMIN_URL}/`, viewport: size });
  try {
    const admin = await ctx.newPage();
    await admin.goto('./');
    await admin.getByTestId('dev-admin').click();
    const areas = admin.getByRole('navigation', { name: 'Areas' });
    await expect(areas).toBeVisible();
    for (const label of await areas.getByRole('link').allTextContents()) {
      const link = areas.getByRole('link', { name: label, exact: true });
      await link.click();
      await expect(link).toHaveAttribute('aria-current', 'page');
      // Loaded: the area's content, no "Loading…" left (the live area keeps a socket open).
      const main = admin.locator('.admin-main');
      await expect(main).not.toBeEmpty();
      await expect(main).not.toContainText('Loading');
      await noSeriousViolations(admin, at(size, `admin ${label}`));
    }
  } finally {
    await ctx.close();
  }
}

// A running round in focus mode, its Players panel open.
async function focusMode(browser: Browser, size: Size): Promise<void> {
  const p = await person(browser, 'player-1', size);
  const started = await call<{ matchCode: string }>(p, 'POST', '/dev/quicktest', {
    bots: 1,
    cooldownS: 3,
    fast: false,
  });
  try {
    await p.page.goto(`./#/match/${started.matchCode}`);
    await expect(p.page.getByTestId('guess-button')).toBeEnabled({ timeout: 10_000 });
    await noSeriousViolations(p.page, at(size, 'focus mode'));
    await p.page.getByTestId('focus-players').click();
    await expect(p.page.getByTestId('players-drawer')).toBeVisible();
    await noSeriousViolations(p.page, at(size, "focus mode's Players panel"));
  } finally {
    await abortMatch(p, started.matchCode);
    await closeAll([p]);
  }
}

// A docked match (Seasonal Mind Games): the chat under the round, on a phone its sheet open.
async function dockedChat(browser: Browser, size: Size): Promise<void> {
  const p = await person(browser, 'player-1', size);
  const started = await call<{ matchCode: string }>(p, 'POST', '/dev/quicktest', {
    gameId: 'mind-games',
    bots: 1,
  });
  try {
    await p.page.goto(`./#/match/${started.matchCode}`);
    await expect(p.page.getByTestId('chat-dock')).toBeVisible({ timeout: 15_000 });
    await noSeriousViolations(p.page, at(size, 'docked chat'));
    if (size.width < 900) {
      await p.page.getByTestId('chat-bar').click();
      await expect(p.page.getByRole('dialog', { name: 'Chat' })).toBeVisible();
      await noSeriousViolations(p.page, at(size, "docked chat's sheet"));
    }
  } finally {
    await abortMatch(p, started.matchCode);
    await closeAll([p]);
  }
}

test('journey 9b: the other screens pass axe, 24 px targets included, at both sizes', async ({
  browser,
}) => {
  // Two sizes of four parts each, the admin's nine areas among them: about 3 min in Chromium.
  test.setTimeout(480_000);
  for (const size of SIZES) {
    await boardsAndAccount(browser, size);
    await adminPages(browser, size);
    await focusMode(browser, size);
    await dockedChat(browser, size);
  }
});
