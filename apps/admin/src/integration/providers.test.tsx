// @vitest-environment jsdom
/**
 * @file   apps/admin/src/integration/providers.test.tsx
 * @module admin/integration
 * @brief  The identity providers screen: list, new, change, disable, enable, remove.
 *
 * Responsibility: the list names a pinned key without showing it; the form refuses what the
 *                 contract refuses (naming the field) and sends nothing; a new provider is sent
 *                 with its key, algorithms and role mapping; a change of a provider with a
 *                 pinned key leaves the key out unless one is pasted (DECISIONS T175); Disable
 *                 and Remove go through the confirm dialog, Enable does not.
 * Depends on:     vitest, @testing-library/react, @smg/contracts, ./ProvidersPanel, ./fakeServer
 * Spec:           docs/spec/07-integration.md §1; Bingo 07 §2.1; Bingo 11 §1
 */
import type { IdentityProviderView } from '@smg/contracts';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { click, confirm, fakeServer, flush, type, writes } from './fakeServer.js';
import { ProvidersPanel } from './ProvidersPanel.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const HOST: IdentityProviderView = {
  id: '6f1e0c2a-0000-4000-8000-000000000001',
  name: 'Host site',
  issuer: 'https://host.example',
  audience: 'seasonal-mini-games',
  allowedAlgs: ['EdDSA'],
  jwksUrl: null,
  hasPinnedKey: true,
  roleMapping: { organizers: 'organizer' },
  enabled: true,
};
const PEM = '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA\n-----END PUBLIC KEY-----';

async function screenWith(providers: readonly IdentityProviderView[]) {
  const calls = fakeServer((c) =>
    c.method === 'GET' ? { status: 200, body: { providers } } : { status: 200, body: HOST },
  );
  render(<ProvidersPanel />);
  await flush();
  return calls;
}

describe('the identity providers screen', () => {
  it('lists a provider with its key source named, never the key', async () => {
    await screenWith([HOST]);
    const row = screen.getByTestId('provider-https://host.example');
    expect(row.textContent).toContain('pinned key');
    expect(row.textContent).toContain('organizers = organizer');
    expect(row.textContent).toContain('enabled');
  });

  it('refuses a body the contract refuses, then sends a new provider', async () => {
    const calls = await screenWith([]);
    expect(screen.getByText('No identity provider yet.')).toBeTruthy();
    await click('New identity provider');
    type('Name', 'Partner');
    type("Issuer (the token's iss)", 'not an address');
    await click('Save provider');
    expect(screen.getByRole('alert').textContent).toMatch(/^Issuer: /);
    expect(writes(calls)).toEqual([]);
    type("Issuer (the token's iss)", 'https://partner.example');
    type(/^Pinned public key/, PEM);
    type(/^Role mapping/, 'staff = moderator\n\nmembers = player');
    await click('Save provider');
    expect(writes(calls)).toEqual([
      {
        method: 'POST',
        path: '/admin/identity-providers',
        body: {
          name: 'Partner',
          issuer: 'https://partner.example',
          allowedAlgs: ['EdDSA'],
          jwksUrl: null,
          pinnedPublicKey: PEM,
          roleMapping: { staff: 'moderator', members: 'player' },
          enabled: true,
        },
      },
    ]);
  });
});

describe('a change on the identity providers screen', () => {
  it('keeps the pinned key on a change unless a new one is pasted', async () => {
    const calls = await screenWith([HOST]);
    await click('Change');
    type('Name', 'Host site (renamed)');
    await click('Save provider');
    const [kept] = writes(calls);
    expect(kept?.method).toBe('PUT');
    expect(kept?.path).toBe(`/admin/identity-providers/${HOST.id}`);
    expect(kept?.body).not.toHaveProperty('pinnedPublicKey');
    expect(kept?.body).toMatchObject({
      name: 'Host site (renamed)',
      roleMapping: HOST.roleMapping,
    });
    await click('Change');
    type(/^Pinned public key/, PEM);
    await click('Save provider');
    expect(writes(calls)[1]?.body).toMatchObject({ pinnedPublicKey: PEM });
  });

  it('disables and removes through the confirm dialog, enables at once', async () => {
    const calls = await screenWith([
      HOST,
      { ...HOST, id: `${HOST.id.slice(0, -1)}2`, issuer: 'https://off.example', enabled: false },
    ]);
    const [disable] = screen.getAllByRole('button', { name: 'Disable' });
    disable?.click();
    await flush();
    expect(await confirm()).toContain('are refused until it is enabled again');
    expect(writes(calls)[0]?.body).toMatchObject({ enabled: false });
    expect(writes(calls)[0]?.body).not.toHaveProperty('pinnedPublicKey');
    await click('Enable');
    expect(writes(calls)[1]?.body).toMatchObject({ enabled: true });
    screen.getAllByRole('button', { name: 'Remove' })[0]?.click();
    await flush();
    expect(await confirm()).toContain('every account link to it are deleted');
    expect(writes(calls)[2]).toMatchObject({
      method: 'DELETE',
      path: `/admin/identity-providers/${HOST.id}`,
    });
  });
});
