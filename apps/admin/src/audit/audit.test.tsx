// @vitest-environment jsdom
/**
 * @file   apps/admin/src/audit/audit.test.tsx
 * @module admin/audit
 * @brief  The audit log screen: its entries, a table a keyboard can scroll, the chain check.
 *
 * Responsibility: the entries the server sends are listed with who, what and on what; the
 *                 table's wrapper is a named region that takes the focus (nothing inside it
 *                 does, so a keyboard scrolls a wide table that way, audit B4); "Check the
 *                 chain" shows the server's answer in words.
 * Depends on:     vitest, @testing-library/react, @smg/contracts, ./AuditPage,
 *                 ../integration/fakeServer
 * Spec:           docs/spec/05-security-threat-model.md §8
 */
import type { AuditEntryView } from '@smg/contracts';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { click, fakeServer, flush } from '../integration/fakeServer.js';
import { AuditPage } from './AuditPage.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const ENTRY: AuditEntryView = {
  id: 'e1',
  occurredAt: '2026-11-22T10:00:00.000Z',
  actor: 'dev-admin',
  actorRoles: ['admin'],
  action: 'settings.update',
  targetType: 'settings',
  targetId: 'game.safecracker',
  diff: { cooldownS: [10, 8] },
  hash: 'ab',
};

describe('the audit log screen', () => {
  it('lists the entries in a region a keyboard reaches, and checks the chain', async () => {
    fakeServer((c) =>
      c.path.startsWith('/admin/audit/verify')
        ? { status: 200, body: { brokenAt: -1 } }
        : { status: 200, body: { items: [ENTRY] } },
    );
    render(<AuditPage />);
    await flush();
    const region = screen.getByRole('region', { name: 'Audit entries' });
    expect(region.getAttribute('tabindex')).toBe('0');
    expect(screen.getByTestId('audit-table').textContent).toContain('settings.update');
    expect(screen.getByTestId('audit-table').textContent).toContain('game.safecracker');
    await click('Check the chain');
    expect(screen.getByRole('status').textContent).toBe('The chain is intact.');
  });
});
