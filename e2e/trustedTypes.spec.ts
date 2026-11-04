/**
 * @file   e2e/trustedTypes.spec.ts
 * @module e2e
 * @brief  The built admin app works under the server's admin CSP with Trusted Types enforced.
 *
 * Responsibility: the admin app, built for production and served with the headers the server
 *                 sends for /admin (./builtAdmin), carries `require-trusted-types-for 'script'`;
 *                 signed in as the development admin, every area opens with its heading, the
 *                 Integration area's tabs and a form open, and the page reports no CSP or
 *                 Trusted Types violation and logs no error to the console.
 * Depends on:     @playwright/test, ./builtAdmin
 * Spec:           Bingo 03 §7; docs/security-pass.md; DECISIONS T178, T179
 */
import { expect, test } from '@playwright/test';

import { serveBuiltAdmin, type BuiltAdmin } from './builtAdmin.js';

const AREAS = [
  ['Live', 'Live rounds'],
  ['Settings', 'Settings'],
  ['Accounts', 'Accounts'],
  ['Seasons', 'Seasons'],
  ['Moderation', 'Moderation'],
  ['Abuse', 'Abuse'],
  ['Audit log', 'Audit log'],
  ['Integration', 'Integration'],
  ['Two-factor', 'Two-factor sign-in'],
] as const;

let admin: BuiltAdmin;

test.beforeAll(async () => {
  test.setTimeout(180_000);
  admin = await serveBuiltAdmin();
});

test.afterAll(async () => {
  await admin.close();
});

test('the built admin app runs with Trusted Types enforced and no violation', async ({
  browser,
}) => {
  expect(admin.csp).toContain("require-trusted-types-for 'script'");
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`page: ${e.message}`));
  // Every violation of the page's policy, also those the console words differently.
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      console.error(`violation ${e.violatedDirective}: ${e.sample}`);
    });
  });
  const signedIn = await ctx.request.post(new URL('../api/v1/dev/sign-in', admin.url).href, {
    data: { as: 'admin' },
  });
  expect(signedIn.ok()).toBe(true);
  await page.goto(admin.url);
  const nav = page.getByRole('navigation', { name: 'Areas' });
  for (const [link, heading] of AREAS) {
    await nav.getByRole('link', { name: link, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  }
  await nav.getByRole('link', { name: 'Integration' }).click();
  for (const tab of ['Embed origins', 'Webhooks', 'Identity providers']) {
    await page.getByRole('button', { name: tab, exact: true }).click();
  }
  await page.getByRole('button', { name: 'New identity provider' }).click();
  await page.getByLabel('Name').fill('Trusted Types check');
  await page.getByRole('button', { name: 'Save provider' }).click();
  await expect(page.getByRole('alert')).toContainText('Issuer:');
  expect(problems).toEqual([]);
  await ctx.close();
});
