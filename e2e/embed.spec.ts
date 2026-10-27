/**
 * @file   e2e/embed.spec.ts
 * @module e2e
 * @brief  Journey 8: embedded on a host site, the host's sign-in carries into the game; a site
 *         that is not on the allowlist is refused.
 *
 * Responsibility: the admin registers the test host site (./host-page, 127.0.0.1:5420) as an
 *                 identity provider with its public key and puts its origin on the embed
 *                 allowlist with handoff allowed; the host page embeds the game with embed.js,
 *                 the frame asks for a sign-in, the host's backend signs a handoff token and the
 *                 player is signed in inside the frame (single sign-on), which sizes itself; the
 *                 same page from localhost:5420 (not on the list) cannot frame the game
 *                 (frame-ancestors) and its handoff is refused. The accounts the handoff made are
 *                 removed (in the database, as they have no password), then the provider and origin.
 * Depends on:     @playwright/test, node:child_process, ./devStack, ./play
 * Spec:           docs/spec/09-testing-strategy.md §4 (journey 8); docs/spec/07-integration.md §1;
 *                 Bingo 07 §2.2, §3.3, §3.4
 */
import { execFileSync } from 'node:child_process';

import { expect, test } from '@playwright/test';

import {
  CLIENT_URL,
  COMPOSE_FILE,
  ENV_FILE,
  HOST_PAGE_URL,
  REPO_ROOT,
  SERVER_URL,
  databaseUrl,
} from './devStack.js';
import { call, person, type Person } from './play.js';

const HOST_ORIGIN = HOST_PAGE_URL;
const OTHER_ORIGIN = 'http://localhost:5420';

interface HostKey {
  readonly issuer: string;
  readonly publicKey: string;
}

let admin: Person;
let host: HostKey;
let providerId = '';

// One statement against the dev database, inside its container (handoff accounts have no
// password, so DELETE /me cannot remove them).
function sql(statement: string): void {
  const db = new URL(databaseUrl());
  execFileSync(
    'docker',
    [
      'compose',
      '--env-file',
      ENV_FILE,
      '-f',
      COMPOSE_FILE,
      'exec',
      '-T',
      'postgres',
      'psql',
      '-U',
      decodeURIComponent(db.username),
      '-d',
      db.pathname.slice(1),
      '-c',
      statement,
    ],
    { cwd: REPO_ROOT, stdio: 'pipe' },
  );
}

test.beforeAll(async ({ browser, request }) => {
  host = (await (await request.get(`${HOST_PAGE_URL}/public-key`)).json()) as HostKey;
  admin = await person(browser, 'admin');
  const body = {
    name: 'Test host site',
    issuer: host.issuer,
    allowedAlgs: ['EdDSA'],
    jwksUrl: null,
    pinnedPublicKey: host.publicKey,
    roleMapping: {},
    enabled: true,
  };
  // The host page draws a new key at every start: an earlier run's provider gets the new one.
  const listed = await call<{ providers: { id: string; issuer: string }[] }>(
    admin,
    'GET',
    '/admin/identity-providers',
  );
  const known = listed.providers.find((p) => p.issuer === host.issuer);
  if (known === undefined) {
    providerId = (await call<{ id: string }>(admin, 'POST', '/admin/identity-providers', body)).id;
  } else {
    providerId = known.id;
    await call(admin, 'PUT', `/admin/identity-providers/${providerId}`, body);
  }
  await call(admin, 'POST', '/admin/embed-origins', {
    origin: HOST_ORIGIN,
    label: 'Test host site',
    allowAuthHandoff: true,
  });
});

test.afterAll(async () => {
  sql(
    `DELETE FROM smg.accounts WHERE id IN (SELECT ei.account_id FROM smg.external_identities ei
     JOIN smg.identity_providers p ON p.id = ei.provider_id WHERE p.issuer = '${host.issuer}')`,
  );
  await call(admin, 'DELETE', `/admin/identity-providers/${providerId}`);
  await call(admin, 'DELETE', `/admin/embed-origins?origin=${encodeURIComponent(HOST_ORIGIN)}`);
  await admin.ctx.close();
});

test('the host site signs its user in inside the embedded game (single sign-on)', async ({
  browser,
}) => {
  const user = `Embed${String(Date.now() % 1_000_000)}`;
  // A fresh browser: no session of the game yet.
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${HOST_PAGE_URL}/?user=${user}&view=lobby`);
  const frame = page.frameLocator('iframe[title="Seasonal Mini Games"]');
  await expect(frame.getByTestId('embed-signed-in')).toHaveText(`Signed in as ${user}`);
  await expect(page.getByTestId('host-events')).toContainText('smg:ready');
  // The frame sized itself to its content (smg:resize), away from the loader's first height.
  const iframe = page.locator('iframe[title="Seasonal Mini Games"]');
  await expect.poll(async () => (await iframe.boundingBox())?.height ?? 0).not.toBe(480);
  // The sandbox and the permissions the loader gives the frame (Bingo 07 §3.2).
  await expect(iframe).toHaveAttribute(
    'sandbox',
    'allow-scripts allow-same-origin allow-popups allow-forms',
  );
  // The game's own cookie is first-party: the game, opened directly, knows the player too.
  const direct = await ctx.newPage();
  const session = await direct.request.get(`${CLIENT_URL}/api/v1/session`);
  expect(((await session.json()) as { account: { displayName: string } }).account.displayName).toBe(
    user,
  );
  await ctx.close();
});

test('a site that is not on the allowlist can neither frame the game nor hand off a sign-in', async ({
  browser,
  browserName,
  request,
}) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${OTHER_ORIGIN}/?user=Intruder&view=lobby`);
  await expect(page.locator('iframe')).toHaveCount(1);
  // frame-ancestors: the browser refuses to load the game in that page's frame (Chromium shows
  // its error page there); had it loaded, the game itself would show its refusal line.
  if (browserName === 'chromium') {
    await expect
      .poll(() => page.frames().some((f) => f.url().startsWith('chrome-error://')), {
        timeout: 15_000,
      })
      .toBe(true);
  } else {
    await page.waitForTimeout(3_000);
  }
  const frame = page.frameLocator('iframe');
  await expect(frame.getByTestId('embed')).toHaveCount(0);
  await expect(frame.getByTestId('embed-refused')).toHaveCount(0);
  // The handoff from that origin is refused before its token is looked at.
  const token = (
    (await (await request.get(`${OTHER_ORIGIN}/handoff-token?user=Intruder`)).json()) as {
      token: string;
    }
  ).token;
  // Straight to the server: the Vite dev server adds CORS headers of its own for loopback pages.
  const answer = await request.post(`${SERVER_URL}/api/v1/auth/handoff`, {
    headers: { origin: OTHER_ORIGIN },
    data: { token },
  });
  expect(answer.status()).toBe(403);
  expect(await answer.json()).toEqual({ code: 'ORIGIN_NOT_ALLOWED' });
  expect(answer.headers()['access-control-allow-origin']).toBeUndefined();
  await ctx.close();
});
