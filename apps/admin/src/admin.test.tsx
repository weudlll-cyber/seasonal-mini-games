// @vitest-environment jsdom
/**
 * @file   apps/admin/src/admin.test.tsx
 * @module admin
 * @brief  The admin app: settings rows with default, bounds, role and effect; areas by right.
 *
 * Responsibility: a setting row shows the catalogue default, the value in force, the bounds
 *                 narrowed by the document, who may change it and when it applies, and offers
 *                 an editor only when the viewer may edit; the words for roles, effects and
 *                 sources follow 08 §2; the app opens only the areas the account's
 *                 permissions allow, and asks to sign in without an account.
 * Depends on:     vitest, @testing-library/react, @smg/contracts, ./App, ./settings/*
 * Spec:           docs/spec/08-admin-settings.md §1, §2
 */
import { PLATFORM_SETTINGS } from '@smg/contracts';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from './App.js';
import { chainText } from './audit/AuditPage.js';
import { SettingRow } from './settings/SettingRow.js';
import { documentName, runningText, statusText, whoText } from './settings/settingText.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const maxPlayers = (PLATFORM_SETTINGS.matchmaking ?? []).find((d) => d.key === 'match.maxPlayers');

function row(editable: boolean) {
  if (maxPlayers === undefined) throw new Error('no match.maxPlayers');
  render(
    <table>
      <tbody>
        <SettingRow
          def={maxPlayers}
          value={300}
          override={{ value: 300, max: 800 }}
          editable={editable}
          change={() => undefined}
        />
      </tbody>
    </table>,
  );
  return [...screen.getByTestId('setting-match.maxPlayers').querySelectorAll('td')].map(
    (td) => td.textContent,
  );
}

describe('a setting row', () => {
  it('shows default, value, narrowed bounds, who, when and source', () => {
    const cells = row(false);
    expect(cells.slice(1)).toEqual([
      '500',
      '300',
      '2',
      '800',
      'host per round; default by game admin',
      'the next time it is read',
      'owner (O15)',
      'view only',
    ]);
  });

  it('offers an editor for the value and both bounds when the viewer may edit', () => {
    row(true);
    expect(screen.getByLabelText('Players per match at most: default')).toBeTruthy();
    expect(screen.getByLabelText('Players per match at most: lowest allowed')).toBeTruthy();
    expect(screen.getByLabelText('Players per match at most: highest allowed')).toBeTruthy();
  });
});

describe('the words', () => {
  it('name roles, effects, sources and documents as 08 §2 does', () => {
    const security = (PLATFORM_SETTINGS.security ?? [])[0];
    if (security === undefined) throw new Error('no security setting');
    expect(whoText(security)).toBe('security admin');
    expect(runningText({ ...security, running: 'frozen' })).toBe('frozen into each new round');
    expect(statusText({ ...security, status: 'proposal' })).toBe('proposal');
    expect(documentName('game.guess-the-number')).toBe('Game: guess-the-number');
    expect(documentName('rate_limits')).toBe('Rate limits');
    expect(chainText(-1)).toBe('The chain is intact.');
    expect(chainText(0)).toBe('The chain breaks at entry 1, counted from the oldest.');
  });
});

function serve(session: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            url.endsWith('/session')
              ? session
              : { ids: [], items: [], days: [], inSeason: null, fetchedAt: null, lastError: null },
          ),
        ),
      ),
    ),
  );
}

async function renderApp(): Promise<void> {
  render(<App dev={false} />);
  await act(async () => {
    await Promise.resolve();
  });
}

describe('the app', () => {
  it('asks to sign in without an account', async () => {
    serve({ account: null, permissions: [], csrfToken: null });
    await renderApp();
    expect(await screen.findByRole('heading', { name: 'Admin sign-in' })).toBeTruthy();
    expect(screen.queryByTestId('dev-admin')).toBeNull();
  });

  it('opens only the areas the permissions allow', async () => {
    serve({
      account: { id: 'm', displayName: 'mod' },
      permissions: ['admin.view', 'abuse.view'],
      csrfToken: 'x',
    });
    await renderApp();
    const nav = await screen.findByRole('navigation', { name: 'Areas' });
    expect([...nav.querySelectorAll('a')].map((a) => a.textContent)).toEqual(['Settings', 'Abuse']);
  });
});
