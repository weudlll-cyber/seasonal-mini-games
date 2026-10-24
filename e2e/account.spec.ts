/**
 * @file   e2e/account.spec.ts
 * @module e2e
 * @brief  Register, sign out, sign in, change the password, sign out; wrong password; too many tries.
 *
 * Responsibility: a new account registers from the top bar, signs out, signs in again,
 *                 changes its password on the account page and signs out; a wrong password
 *                 and an unknown e-mail get the same plain answer; repeated failures for one
 *                 account get the rate-limit message (Chromium only, so the full suite stays
 *                 under the per-address login limit). The test deletes its account
 *                 (DELETE /me), also when a step fails. In Chromium it saves the register,
 *                 sign-in and account screens (both sizes and themes) to reports/screens/latest/.
 *                 Taken over from Bingo; the match step moved to the round journeys.
 * Depends on:     @playwright/test, ./screens
 * Spec:           docs/spec/09-testing-strategy.md §4; Bingo 05 §2.1; Bingo 03 §2.1, §13
 */
import { expect, test, type Page } from '@playwright/test';

import { captureLook, SHOTS_DIR } from './screens.js';

const PASSWORD = 'correct horse battery staple';
const NEW_PASSWORD = 'another long passphrase';

// Teardown: deletes the test account; a failed sign-in or deletion fails the test, so no
// account is left behind unnoticed.
async function deleteAccount(page: Page, email: string, password: string): Promise<void> {
  const login = await page.request.post('/api/v1/auth/login', { data: { email, password } });
  expect(login.status(), 'teardown signs in as the test account').toBe(200);
  const session = (await (await page.request.get('/api/v1/session')).json()) as {
    csrfToken: string | null;
  };
  const r = await page.request.delete('/api/v1/me', {
    headers: { 'x-csrf-token': session.csrfToken ?? '' },
    data: { password },
  });
  expect(r.status(), 'test account deleted').toBe(204);
}

async function signInWithForm(page: Page, email: string, password: string): Promise<void> {
  await page.getByTestId('open-sign-in').click();
  await page.getByTestId('sign-in-email').fill(email);
  await page.getByTestId('sign-in-password').fill(password);
  await page.getByTestId('sign-in-submit').click();
}

test('register, sign out, sign in, change the password, sign out', async ({ page }, info) => {
  test.setTimeout(120_000);
  const shots = info.project.name === 'chromium';
  const name = `e2e${Date.now().toString(36)}`;
  const email = `${name}@example.com`;
  let password: string | null = null;
  try {
    await page.goto('/#/');
    await page.getByTestId('open-register').click();
    await page.getByTestId('register-displayName').fill(name);
    await page.getByTestId('register-email').fill(email);
    await page.getByTestId('register-password').fill(PASSWORD);
    if (shots) await captureLook(page, SHOTS_DIR, 'register');
    await page.getByTestId('register-submit').click();
    await expect(page.getByTestId('signed-in-as')).toContainText(`${name} (player)`);
    password = PASSWORD;
    await page.getByTestId('sign-out').click();
    await expect(page.getByTestId('open-sign-in')).toBeVisible();
    if (shots) {
      await page.getByTestId('open-sign-in').click();
      await captureLook(page, SHOTS_DIR, 'sign-in');
      await page.goto('/#/');
    }
    await signInWithForm(page, email, PASSWORD);
    await page.getByTestId('signed-in-as').click();
    await page.getByTestId('password-current').fill(PASSWORD);
    await page.getByTestId('password-next').fill(NEW_PASSWORD);
    await page.getByTestId('password-again').fill(NEW_PASSWORD);
    await page.getByTestId('password-submit').click();
    await expect(page.getByTestId('password-done')).toBeVisible();
    password = NEW_PASSWORD;
    if (shots) await captureLook(page, SHOTS_DIR, 'account');
    await page.getByTestId('sign-out').click();
    await expect(page.getByTestId('open-sign-in')).toBeVisible();
  } finally {
    if (password !== null) await deleteAccount(page, email, password);
  }
});

test('a wrong password and an unknown e-mail get the same plain answer', async ({ page }) => {
  await page.goto('/#/');
  await signInWithForm(page, `nobody${Date.now().toString(36)}@example.com`, 'not the password');
  await expect(page.getByTestId('sign-in-error')).toHaveText('Wrong e-mail or password.');
});

test('too many tries for one account get the rate-limit message', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium', 'Chromium only: the login limit is per address');
  const email = `limit${Date.now().toString(36)}@example.com`;
  await page.goto('/#/');
  await page.getByTestId('open-sign-in').click();
  for (let i = 0; i < 6; i += 1) {
    await page.getByTestId('sign-in-email').fill(email);
    await page.getByTestId('sign-in-password').fill('not the password');
    await page.getByTestId('sign-in-submit').click();
    await expect(page.getByTestId('sign-in-error')).toBeVisible();
  }
  await expect(page.getByTestId('sign-in-error')).toHaveText(
    'Too many tries. Please wait a minute and try again.',
  );
});
