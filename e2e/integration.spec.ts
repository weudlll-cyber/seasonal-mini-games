/**
 * @file   e2e/integration.spec.ts
 * @module e2e
 * @brief  Journeys 30–32: the admin's Integration area — an identity provider, an embed origin
 *         and a webhook endpoint each created, changed and removed in the admin app.
 *
 * Responsibility: the admin signs in to the admin app (development sign-in, port 5411) and
 *                 opens Integration. Journey 30: a provider with a pinned key is added, renamed
 *                 (the key stays pinned without being pasted again), disabled through the
 *                 confirm dialog and removed. Journey 31: an origin is added, its label and
 *                 handoff flag changed, and it is removed. Journey 32: an endpoint is added and
 *                 its secret shown once, its events changed, it is disabled and removed. Each
 *                 journey uses its own `.e2e.invalid` names and removes what is left in the end
 *                 through the API, so the allowlist and providers are as before (the spec runs
 *                 in TIMING: the allowlist is shared by every page).
 * Depends on:     @playwright/test, node:crypto, ./devStack, ./play
 * Spec:           docs/spec/09-testing-strategy.md §4 (journeys 30–32); docs/spec/07-integration.md
 *                 §1, §3.2; Bingo 11 §1
 */
import { generateKeyPairSync } from 'node:crypto';

import { expect, test, type Page } from '@playwright/test';

import { ADMIN_URL } from './devStack.js';
import { attempt, type Person } from './play.js';

let admin: Person;

test.beforeEach(async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: `${ADMIN_URL}/` });
  const page = await ctx.newPage();
  await page.goto('./');
  await page.getByTestId('dev-admin').click();
  await expect(page.getByRole('navigation', { name: 'Areas' })).toBeVisible();
  await page.getByRole('link', { name: 'Integration' }).click();
  admin = { who: 'admin', ctx, page };
});

test.afterEach(async () => {
  await admin.ctx.close();
});

async function tab(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name, exact: true }).click();
}

// Confirms the open dialog after checking its sentence.
async function confirmWith(page: Page, effect: string): Promise<void> {
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByTestId('confirm-effect')).toContainText(effect);
  await dialog.getByTestId('confirm-action').click();
  await expect(dialog).toBeHidden();
}

test('journey 30: an identity provider added, renamed with its key kept, disabled, removed', async () => {
  const issuer = 'https://journey30.e2e.invalid';
  const pem = generateKeyPairSync('ed25519')
    .publicKey.export({ type: 'spki', format: 'pem' })
    .toString();
  const { page } = admin;
  const row = page.getByTestId(`provider-${issuer}`);
  try {
    await page.getByRole('button', { name: 'New identity provider' }).click();
    await page.getByLabel('Name').fill('Journey 30');
    await page.getByLabel("Issuer (the token's iss)").fill(issuer);
    await page.getByLabel(/^Pinned public key/).fill(pem);
    await page.getByLabel(/^Role mapping/).fill('organizers = organizer');
    await page.getByRole('button', { name: 'Save provider' }).click();
    await expect(row).toContainText('pinned key');
    await expect(row).toContainText('organizers = organizer');
    await expect(page.locator('body')).not.toContainText('BEGIN PUBLIC KEY');

    await row.getByRole('button', { name: 'Change' }).click();
    await expect(page.getByLabel(/^Pinned public key/)).toHaveValue('');
    await page.getByLabel('Name').fill('Journey 30 renamed');
    await page.getByRole('button', { name: 'Save provider' }).click();
    await expect(row).toContainText('Journey 30 renamed');
    await expect(row).toContainText('pinned key');

    await row.getByRole('button', { name: 'Disable' }).click();
    await confirmWith(page, 'are refused until it is enabled again');
    await expect(row).toContainText('disabled');
    await row.getByRole('button', { name: 'Remove' }).click();
    await confirmWith(page, 'every account link to it are deleted');
    await expect(row).toBeHidden();
  } finally {
    const listed = await attempt(admin, 'GET', '/admin/identity-providers');
    const left = (listed.body as { providers: { id: string; issuer: string }[] }).providers;
    for (const p of left.filter((x) => x.issuer === issuer))
      await attempt(admin, 'DELETE', `/admin/identity-providers/${p.id}`);
  }
});

test('journey 31: an embed origin added, changed and removed', async () => {
  const origin = 'https://journey31.e2e.invalid';
  const { page } = admin;
  const row = page.getByTestId(`origin-${origin}`);
  try {
    await tab(page, 'Embed origins');
    await page.getByRole('button', { name: 'New embed origin' }).click();
    await page.getByLabel(/^Origin \(scheme/).fill(`${origin}/path`);
    await page.getByLabel('Label').fill('Journey 31');
    await page.getByRole('button', { name: 'Save origin' }).click();
    await expect(page.getByRole('alert')).toContainText('Origin:');
    await page.getByLabel(/^Origin \(scheme/).fill(origin);
    await page.getByRole('button', { name: 'Save origin' }).click();
    await expect(row).toContainText('Journey 31');
    await expect(row).toContainText('no');

    await row.getByRole('button', { name: 'Change' }).click();
    await page.getByLabel('Label').fill('Journey 31 changed');
    await page.getByLabel(/^May hand off a sign-in/).check();
    await page.getByRole('button', { name: 'Save origin' }).click();
    await expect(row).toContainText('Journey 31 changed');
    await expect(row).toContainText('allowed');

    await row.getByRole('button', { name: 'Remove' }).click();
    await confirmWith(page, 'can no longer frame the game');
    await expect(row).toBeHidden();
  } finally {
    await attempt(admin, 'DELETE', `/admin/embed-origins?origin=${encodeURIComponent(origin)}`);
  }
});

test('journey 32: a webhook endpoint added with its secret shown once, changed, disabled, removed', async () => {
  const url = 'https://journey32.e2e.invalid/hook';
  const { page } = admin;
  const row = page.getByTestId(`webhook-${url}`);
  try {
    await tab(page, 'Webhooks');
    await page.getByRole('button', { name: 'New webhook endpoint' }).click();
    await page.getByLabel('Address (https)').fill(url);
    await page.getByLabel('round.ended').check();
    await page.getByRole('button', { name: 'Save endpoint' }).click();
    const secret = (await page.getByTestId('webhook-secret').textContent()) ?? '';
    expect(secret.length).toBeGreaterThan(20);
    await page.getByRole('button', { name: 'I have stored it' }).click();
    await expect(page.getByTestId('webhook-secret')).toBeHidden();
    await expect(row).toContainText('round.ended · enabled');

    await row.getByRole('button', { name: 'Change' }).click();
    await page.getByLabel('match.closed').check();
    await page.getByRole('button', { name: 'Save endpoint' }).click();
    await expect(row).toContainText('round.ended, match.closed');
    await page.reload();
    await tab(page, 'Webhooks');
    await expect(row).toBeVisible();
    await expect(page.locator('body')).not.toContainText(secret);

    await row.getByRole('button', { name: 'Disable' }).click();
    await confirmWith(page, `No event is queued for ${url}`);
    await expect(row).toContainText('disabled');
    await row.getByRole('button', { name: 'Remove' }).click();
    await confirmWith(page, 'its secret and delivery history are deleted');
    await expect(row).toBeHidden();
  } finally {
    const listed = await attempt(admin, 'GET', '/admin/webhooks');
    const left = (listed.body as { endpoints: { id: string; url: string }[] }).endpoints;
    for (const w of left.filter((x) => x.url === url))
      await attempt(admin, 'DELETE', `/admin/webhooks/${w.id}`);
  }
});
