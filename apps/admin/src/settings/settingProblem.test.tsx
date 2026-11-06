// @vitest-environment jsdom
/**
 * @file   apps/admin/src/settings/settingProblem.test.tsx
 * @module admin/settings
 * @brief  A refused save shows the setting's sentence in that setting's row (O74).
 *
 * Responsibility: the server refuses a save with 422 SETTING_INVALID naming the setting
 *                 (`field`) and its sentence (`detail`); the settings page shows the sentence
 *                 under that row's editor, announced, and nowhere in the other rows, and the
 *                 save's line under the table says what failed.
 * Depends on:     vitest, @testing-library/react, @smg/game-sdk, ./SettingsPage
 * Spec:           docs/spec/08-admin-settings.md §1, §3
 */
import { PLATFORM_ROUND_SETTINGS } from '@smg/game-sdk';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SettingsPage } from './SettingsPage.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const PAIR = 'The warning must be shorter than the limit.';
const defs = PLATFORM_ROUND_SETTINGS.filter((d) => d.key.startsWith('round.inactivity'));
const doc = {
  id: 'game.guess-the-number',
  version: 3,
  updatedAt: null,
  defs,
  overrides: {},
  values: { 'round.inactivityLimitS': 60, 'round.inactivityWarnS': 30 },
  editable: defs.map((d) => d.key),
};

// The server: the document, its history, and a refused save.
function serve(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: { method?: string }) => {
      const json = (status: number, body: unknown) =>
        Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
      if (init?.method === 'PUT') {
        return json(422, { code: 'SETTING_INVALID', detail: PAIR, field: 'round.inactivityWarnS' });
      }
      if (url.endsWith('/admin/settings')) return json(200, { ids: [doc.id] });
      if (url.endsWith('/versions')) return json(200, { items: [] });
      return json(200, doc);
    }),
  );
}

const settle = () =>
  act(async () => {
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  });

describe('a refused settings save (O74)', () => {
  it("shows the setting's sentence in its row and the failure under the table", async () => {
    serve();
    render(<SettingsPage />);
    await settle();
    fireEvent.click(screen.getByTestId('save-settings'));
    await settle();
    const problem = screen.getByTestId('setting-problem');
    expect(problem.textContent).toBe(PAIR);
    expect(problem.getAttribute('role')).toBe('alert');
    expect(screen.getByTestId('setting-round.inactivityWarnS').contains(problem)).toBe(true);
    expect(screen.getByRole('status').textContent).toBe(PAIR);
  });
});
