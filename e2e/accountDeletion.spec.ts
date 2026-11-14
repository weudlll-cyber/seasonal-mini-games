/**
 * @file   e2e/accountDeletion.spec.ts
 * @module e2e
 * @brief  Journey 29: an account the website's handoff made deletes itself on the account page;
 *         the next handoff makes a fresh account.
 *
 * Responsibility: the test host site (./host-page) is registered as in journey 8 (./hostSite);
 *                 its user is signed in by the handoff inside the embedded game, opens the game
 *                 directly at #/account, finds no "Change password" (the account has none,
 *                 T201), opens "Delete my account", sees what is deleted and
 *                 what stays, finds Delete off with the name typed in the wrong case, types the
 *                 display name and deletes; the page says the account is gone and the session
 *                 is signed out; the profile answers 404 and the admin search no longer finds the
 *                 account; the host page signs the same user in again, as a new account. The
 *                 test deletes that account (DELETE /me with the typed name), also when a step
 *                 fails, then the provider and the origin.
 * Depends on:     @playwright/test, ./testStack, ./hostSite, ./play
 * Spec:           docs/spec/09-testing-strategy.md §4 (journey 29); docs/spec/07-integration.md §4;
 *                 DECISIONS T105, T170, T201
 */
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import { CLIENT_URL, HOST_PAGE_URL } from './testStack.js';
import { registerHostSite, removeHostSite } from './hostSite.js';
import { call, person, type Person } from './play.js';

interface SessionView {
  readonly account: { readonly id: string; readonly displayName: string } | null;
  readonly csrfToken: string | null;
}

let admin: Person;
let providerId = '';

test.beforeAll(async ({ browser, request }) => {
  admin = await person(browser, 'admin');
  providerId = await registerHostSite(admin, request);
});

test.afterAll(async () => {
  await removeHostSite(admin, providerId);
  await admin.ctx.close();
});

async function sessionOf(ctx: BrowserContext): Promise<SessionView> {
  return (await (await ctx.request.get(`${CLIENT_URL}/api/v1/session`)).json()) as SessionView;
}

// The host page signs its user in inside the frame; answers the game account's id.
async function signInThroughHost(page: Page, user: string): Promise<string> {
  await page.goto(`${HOST_PAGE_URL}/?user=${user}&view=lobby`);
  const frame = page.frameLocator('iframe[title="Seasonal Mini Games"]');
  await expect(frame.getByTestId('embed-signed-in')).toHaveText(`Signed in as ${user}`);
  const session = await sessionOf(page.context());
  expect(session.account?.displayName).toBe(user);
  return session.account?.id ?? '';
}

// Teardown: a handoff account still signed in deletes itself with its typed display name.
async function deleteIfSignedIn(ctx: BrowserContext): Promise<void> {
  const session = await sessionOf(ctx);
  if (session.account === null) return;
  const r = await ctx.request.delete(`${CLIENT_URL}/api/v1/me`, {
    headers: { 'x-csrf-token': session.csrfToken ?? '' },
    data: { confirm: session.account.displayName },
  });
  expect(r.status(), 'test account deleted').toBe(204);
}

async function deleteOnAccountPage(page: Page, user: string): Promise<void> {
  await page.goto(`${CLIENT_URL}/#/account`);
  // A website account has no password: no form to change it, the line that says why (T201).
  await expect(page.getByTestId('account-no-password')).toContainText('through the website');
  await expect(page.getByTestId('password-form')).toHaveCount(0);
  await page.getByTestId('delete-account-open').click();
  const effects = page.getByTestId('delete-account-effects');
  await expect(effects).toContainText('What is deleted');
  await expect(effects).toContainText('What stays');
  await page.getByTestId('delete-account-name').fill(user.toUpperCase());
  await expect(page.getByTestId('delete-account-submit')).toBeDisabled();
  await page.getByTestId('delete-account-name').fill(user);
  await page.getByTestId('delete-account-submit').click();
  await expect(page.getByTestId('account-deleted')).toContainText(
    'Your account was deleted and you are signed out.',
  );
  await expect(page.getByTestId('signed-in-as')).toHaveCount(0);
}

test('a website account deletes itself; the next handoff makes a fresh account', async ({
  browser,
}) => {
  // Lower case: the profile route looks the name up as typed.
  const user = `gone${String(Date.now() % 1_000_000)}`;
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    const first = await signInThroughHost(page, user);
    expect((await ctx.request.get(`${CLIENT_URL}/api/v1/players/${user}`)).status()).toBe(200);
    await deleteOnAccountPage(page, user);
    // Gone on the server: no session, no profile, not in the admin's account search.
    expect((await sessionOf(ctx)).account).toBeNull();
    expect((await ctx.request.get(`${CLIENT_URL}/api/v1/players/${user}`)).status()).toBe(404);
    const found = await call<{ items: { id: string }[] }>(
      admin,
      'GET',
      `/admin/accounts?query=${user}`,
    );
    expect(found.items.map((a) => a.id)).not.toContain(first);
    // The same website user again: a new, empty account.
    const second = await signInThroughHost(page, user);
    expect(second).not.toBe(first);
  } finally {
    await deleteIfSignedIn(ctx);
    await ctx.close();
  }
});
