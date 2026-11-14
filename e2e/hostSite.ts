/**
 * @file   e2e/hostSite.ts
 * @module e2e
 * @brief  The test host site (./host-page) registered as an identity provider and an allowed
 *         embed origin, and removed again.
 *
 * Responsibility: `registerHostSite` reads the host page's public key (a new one at every
 *                 start of the page), creates the identity provider for its issuer or gives an
 *                 earlier run's provider the new key, puts the page's origin on the embed
 *                 allowlist with the handoff allowed, and answers the provider's id;
 *                 `removeHostSite` deletes both (the accounts' website links go with the
 *                 provider). The same steps as journey 8's setup (./embed.spec).
 * Depends on:     @playwright/test (types), ./testStack, ./play
 * Used by:        ./accountDeletion.spec
 * Spec:           docs/spec/07-integration.md §1, §4; docs/spec/09-testing-strategy.md §4 (journey 29)
 */
import type { APIRequestContext } from '@playwright/test';

import { HOST_PAGE_URL } from './testStack.js';
import { call, type Person } from './play.js';

export async function registerHostSite(admin: Person, request: APIRequestContext): Promise<string> {
  const key = (await (await request.get(`${HOST_PAGE_URL}/public-key`)).json()) as {
    issuer: string;
    publicKey: string;
  };
  const body = {
    name: 'Test host site',
    issuer: key.issuer,
    allowedAlgs: ['EdDSA'],
    jwksUrl: null,
    pinnedPublicKey: key.publicKey,
    roleMapping: {},
    enabled: true,
  };
  const listed = await call<{ providers: { id: string; issuer: string }[] }>(
    admin,
    'GET',
    '/admin/identity-providers',
  );
  let providerId = listed.providers.find((p) => p.issuer === key.issuer)?.id;
  if (providerId === undefined) {
    providerId = (await call<{ id: string }>(admin, 'POST', '/admin/identity-providers', body)).id;
  } else {
    await call(admin, 'PUT', `/admin/identity-providers/${providerId}`, body);
  }
  await call(admin, 'POST', '/admin/embed-origins', {
    origin: HOST_PAGE_URL,
    label: 'Test host site',
    allowAuthHandoff: true,
  });
  return providerId;
}

export async function removeHostSite(admin: Person, providerId: string): Promise<void> {
  await call(admin, 'DELETE', `/admin/identity-providers/${providerId}`);
  await call(admin, 'DELETE', `/admin/embed-origins?origin=${encodeURIComponent(HOST_PAGE_URL)}`);
}
