// @vitest-environment jsdom
/**
 * @file   apps/admin/src/integration/origins.test.tsx
 * @module admin/integration
 * @brief  The embed origins screen: list, new, change, remove.
 *
 * Responsibility: the list shows each origin with its label and handoff flag; the form refuses
 *                 an origin with a path (the contract's rule, naming the field) and a new
 *                 origin already listed, and sends nothing then; a new origin and a change are
 *                 one save each; Remove goes through the confirm dialog with the origin in the
 *                 query.
 * Depends on:     vitest, @testing-library/react, @smg/contracts, ./OriginsPanel, ./fakeServer
 * Spec:           docs/spec/07-integration.md §1; Bingo 07 §3.4; Bingo 11 §1
 */
import type { EmbedOriginView } from '@smg/contracts';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { click, confirm, fakeServer, flush, type, writes } from './fakeServer.js';
import { OriginsPanel } from './OriginsPanel.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const SITE: EmbedOriginView = {
  origin: 'https://site.example',
  label: 'Site',
  allowAuthHandoff: true,
  createdAt: '2026-11-04T00:00:00.000Z',
};
const ORIGIN_FIELD = /^Origin \(scheme/;

async function screenWith(origins: readonly EmbedOriginView[]) {
  const calls = fakeServer((c) =>
    c.method === 'GET' ? { status: 200, body: { origins } } : undefined,
  );
  render(<OriginsPanel />);
  await flush();
  return calls;
}

describe('the embed origins screen', () => {
  it('lists the origins with label and handoff flag', async () => {
    await screenWith([SITE]);
    const row = screen.getByTestId('origin-https://site.example');
    expect(row.textContent).toContain('Site');
    expect(row.textContent).toContain('allowed');
  });

  it('refuses a path and a listed origin, then saves a new one', async () => {
    const calls = await screenWith([SITE]);
    await click('New embed origin');
    type(ORIGIN_FIELD, 'https://other.example/embed');
    type('Label', 'Other');
    await click('Save origin');
    expect(screen.getByRole('alert').textContent).toMatch(/^Origin: /);
    type(ORIGIN_FIELD, 'https://site.example');
    await click('Save origin');
    expect(screen.getByRole('alert').textContent).toBe(
      'Origin: already on the list; change it there.',
    );
    expect(writes(calls)).toEqual([]);
    type(ORIGIN_FIELD, 'https://other.example');
    await click('Save origin');
    expect(writes(calls)).toEqual([
      {
        method: 'POST',
        path: '/admin/embed-origins',
        body: { origin: 'https://other.example', label: 'Other', allowAuthHandoff: false },
      },
    ]);
  });

  it('changes a label and the handoff flag, and removes through the confirm dialog', async () => {
    const calls = await screenWith([SITE]);
    await click('Change');
    expect(screen.queryByLabelText(ORIGIN_FIELD)).toBeNull();
    type('Label', 'Site (renamed)');
    screen.getByLabelText(/^May hand off a sign-in/).click();
    await click('Save origin');
    expect(writes(calls)[0]?.body).toEqual({
      origin: SITE.origin,
      label: 'Site (renamed)',
      allowAuthHandoff: false,
    });
    await click('Remove');
    expect(await confirm()).toContain('can no longer frame the game');
    expect(writes(calls)[1]).toMatchObject({
      method: 'DELETE',
      path: '/admin/embed-origins?origin=https%3A%2F%2Fsite.example',
    });
  });
});
