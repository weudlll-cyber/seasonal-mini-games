/**
 * @file   e2e/chat.spec.ts
 * @module e2e
 * @brief  Journey 13: two players chat in a match, a moderator mutes and bans, the provider
 *         switched to none removes the panel.
 *
 * Responsibility: two players of a match write in its chat and read each other; the admin
 *                 (super_admin, so chat.moderate) mutes one from the message's actions with a
 *                 reason, and that player's next message is refused in a plain sentence; once
 *                 the mute is lifted the player writes again; a ban refuses the same way; with
 *                 `integrations.chatProvider` set to none the panel is gone after a reload. The
 *                 settings changed here (new-account slow mode off, the provider) are put back
 *                 and every sanction lifted in `finally`; the match is aborted. It changes
 *                 platform-wide settings, so it runs with the timing specs, one at a time.
 * Depends on:     @playwright/test, ./play
 * Spec:           docs/spec/07-integration.md §2; Bingo 06 §7, Bingo 03 §12; docs/spec/09-testing-strategy.md §4
 */
import { expect, test, type Page } from '@playwright/test';

import { abortMatch, call, closeAll, openMatch, person, visit, type Person } from './play.js';

type Overrides = Record<string, { value: unknown }>;

// Sets overrides of a settings document as the admin; the answer puts the old ones back.
async function setSettings(admin: Person, doc: string, overrides: Overrides) {
  const read = () =>
    call<{ version: number; overrides: Overrides }>(admin, 'GET', `/admin/settings/${doc}`);
  const before = await read();
  await call(admin, 'PUT', `/admin/settings/${doc}`, {
    version: before.version,
    overrides: { ...before.overrides, ...overrides },
  });
  return async () => {
    const now = await read();
    await call(admin, 'PUT', `/admin/settings/${doc}`, {
      version: now.version,
      overrides: before.overrides,
    });
  };
}

async function say(page: Page, text: string): Promise<void> {
  await page.getByTestId('chat-input').fill(text);
  await page.getByTestId('chat-input').press('Enter');
}

// The admin opens a message's actions, picks one, gives the reason and confirms.
async function moderate(admin: Person, text: string, action: string): Promise<void> {
  const line = admin.page.getByTestId('chat-messages').locator('li', { hasText: text });
  await line.getByRole('button', { name: 'Moderate' }).click();
  await line.getByRole('button', { name: action }).click();
  await line.getByLabel('Reason').fill('journey 13');
  await line.getByRole('button', { name: 'Confirm' }).click();
}

async function liftAll(admin: Person): Promise<void> {
  const { items } = await call<{ items: { id: string; liftedAt: number | null }[] }>(
    admin,
    'GET',
    '/admin/chat/sanctions',
  );
  for (const s of items.filter((x) => x.liftedAt === null)) {
    await call(admin, 'POST', `/admin/chat/sanctions/${s.id}/lift`, {});
  }
}

test('journey 13: a match chat, a mute and a ban by a moderator, and no chat with none', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const host = await person(browser, 'host');
  const one = await person(browser, 'player-1');
  const two = await person(browser, 'player-2');
  const admin = await person(browser, 'admin');
  const restore: (() => Promise<void>)[] = [];
  let code = '';
  try {
    // Dev accounts are new: their new-account slow mode would make every step wait 10 s.
    restore.push(
      await setSettings(admin, 'chat', { 'chat.newAccountSlowModeHours': { value: 0 } }),
    );
    code = await openMatch(host, [one, two], 'journey 13');
    await visit(admin, code);
    await say(one.page, 'Hello from one');
    await expect(two.page.getByTestId('chat-messages')).toContainText('Hello from one');
    await say(two.page, 'Hi one, good luck');
    await expect(one.page.getByTestId('chat-messages')).toContainText('Hi one, good luck');

    await moderate(admin, 'Hello from one', 'Mute 5 min');
    await expect(admin.page.getByText('dev-player-1 is muted.')).toBeVisible();
    await say(one.page, 'Am I muted?');
    await expect(one.page.getByTestId('chat-refusal')).toHaveText(/You are muted for/);
    await expect(two.page.getByTestId('chat-messages')).not.toContainText('Am I muted?');

    await liftAll(admin);
    await say(one.page, 'Back again');
    await expect(two.page.getByTestId('chat-messages')).toContainText('Back again');

    await moderate(admin, 'Back again', 'Ban');
    await expect(admin.page.getByText('dev-player-1 is banned from the chat.')).toBeVisible();
    await say(one.page, 'Still here');
    await expect(one.page.getByTestId('chat-refusal')).toHaveText('You are banned from the chat.');

    restore.push(
      await setSettings(admin, 'integrations', { 'integrations.chatProvider': { value: 'none' } }),
    );
    await one.page.reload();
    await expect(one.page.getByTestId('match')).toBeVisible();
    await expect(one.page.getByTestId('chat-panel')).toHaveCount(0);
  } finally {
    for (const r of restore.reverse()) await r();
    await liftAll(admin);
    if (code !== '') await abortMatch(host, code);
    await closeAll([host, one, two, admin]);
  }
});
