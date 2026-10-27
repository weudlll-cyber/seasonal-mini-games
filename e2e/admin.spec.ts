/**
 * @file   e2e/admin.spec.ts
 * @module e2e
 * @brief  Journey 14: the admin changes a special's default, sees the diff, rolls it back, and
 *         aborts a running Quick Test round from Live; the player sees the staff abort.
 *
 * Responsibility: the admin signs in to the admin app (development sign-in, port 5411);
 *                 changes Leaf Fall's default in the game's settings document; finds the new
 *                 version in the history with its diff; rolls back to the version before
 *                 through the confirm dialog (a new version, the diff the other way round);
 *                 opens the player's running Quick Test round in Live and aborts it with a
 *                 reason; the player's page shows "aborted: by staff (reason)". The match is
 *                 aborted at the end, never deleted (CLAUDE.md).
 * Depends on:     @playwright/test, ./devStack, ./play
 * Spec:           docs/spec/11-roadmap.md (Phase 6); docs/spec/08-admin-settings.md §1;
 *                 docs/spec/06-data-model-api-realtime.md §3.2; Bingo 11 §1, §3.2
 */
import { expect, test, type Page } from '@playwright/test';

import { ADMIN_URL } from './devStack.js';
import { abortMatch, call, closeAll, person, visit } from './play.js';

const LEAF_FALL = 'Leaf Fall stops at: default';

// The version number the game's document shows in its heading.
async function versionOf(page: Page): Promise<number> {
  const heading = page.getByRole('heading', { level: 2, name: /Game: guess-the-number/ });
  const text = (await heading.locator('small').textContent()) ?? '';
  return Number(/version (\d+)/.exec(text)?.[1] ?? Number.NaN);
}

async function changeAndRollBack(page: Page): Promise<void> {
  await page.goto('./#/settings');
  await page.getByRole('button', { name: 'Game: guess-the-number' }).click();
  const before = await versionOf(page);
  expect(before).toBeGreaterThanOrEqual(1);
  const field = page.getByLabel(LEAF_FALL);
  await field.fill('12');
  await field.blur();
  await page.getByLabel('Comment', { exact: true }).fill('journey 14');
  await page.getByTestId('save-settings').click();
  await expect(page.getByRole('status')).toHaveText('Saved as a new version.');
  await expect.poll(() => versionOf(page)).toBe(before + 1);
  const saved = page.getByTestId(`version-${String(before + 1)}`);
  await expect(saved).toContainText('journey 14');
  await expect(saved).toContainText(/autumn\.minRemaining: .* → 12/);

  // Rollback through the confirm dialog: a new version with the values of the one before.
  await page
    .getByTestId(`version-${String(before)}`)
    .getByRole('button', { name: 'Roll back to this version' })
    .click();
  const dialog = page.getByRole('dialog', { name: `Roll back to version ${String(before)}` });
  await expect(dialog.getByTestId('confirm-effect')).toContainText(
    `A new version ${String(before + 2)} is saved`,
  );
  await dialog.getByLabel('Comment (goes into the audit log)').fill('journey 14 undo');
  await dialog.getByTestId('confirm-action').click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => versionOf(page)).toBe(before + 2);
  await expect(page.getByTestId(`version-${String(before + 2)}`)).toContainText(
    /autumn\.minRemaining: 12 → /,
  );
}

async function abortFromLive(page: Page, code: string): Promise<void> {
  await page.goto('./#/live');
  const row = page.getByTestId(`live-${code}`);
  await expect(row).toBeVisible({ timeout: 10_000 });
  await row.getByRole('button', { name: 'Open' }).click();
  const panel = page.getByTestId('round-panel');
  await panel.getByRole('button', { name: 'Abort round' }).click();
  const dialog = page.getByRole('dialog', { name: 'Abort this round' });
  await expect(dialog.getByTestId('confirm-effect')).toContainText('aborted by staff');
  await dialog.getByLabel('Reason (goes into the audit log)').fill('journey 14');
  await dialog.getByTestId('confirm-action').click();
  await expect(panel.getByRole('status')).toContainText('aborted by staff (journey 14)');
}

test('journey 14: a special default changed and rolled back, a live round aborted by staff', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const adminCtx = await browser.newContext({ baseURL: `${ADMIN_URL}/` });
  const admin = await adminCtx.newPage();
  const player = await person(browser, 'player-1');
  const started = await call<{ matchCode: string }>(player, 'POST', '/dev/quicktest', {
    bots: 1,
    season: 'autumn',
    cooldownS: 10,
    rangeHigh: 1_000_000,
  });
  try {
    await admin.goto('./');
    await admin.getByTestId('dev-admin').click();
    await expect(admin.getByRole('navigation', { name: 'Areas' })).toBeVisible();
    await changeAndRollBack(admin);
    await visit(player, started.matchCode);
    await abortFromLive(admin, started.matchCode);
    await expect(player.page.getByText('The round was aborted: by staff (journey 14)')).toBeVisible(
      {
        timeout: 10_000,
      },
    );
  } finally {
    await abortMatch(player, started.matchCode);
    await closeAll([player]);
    await adminCtx.close();
  }
});
