// @vitest-environment jsdom
/**
 * @file   apps/admin/src/staff.test.tsx
 * @module admin
 * @brief  The confirm dialog, the step-up retry of a write, and a settings document's history.
 *
 * Responsibility: the confirm dialog states the effect, keeps its button off until the reason
 *                 is long enough, runs the action with the reason and closes, or shows the
 *                 refusal and stays open; Cancel closes without acting. A write answered
 *                 AUTH_STEP_UP_REQUIRED opens the step-up dialog, and after a right code the
 *                 write is sent again and succeeds. The history lists each version's diff as
 *                 "key: before → after" and rolls back through the confirm dialog.
 * Depends on:     vitest, @testing-library/react, ./ConfirmDialog, ./StepUp, ./http,
 *                 ./settings/History
 * Spec:           Bingo 11 §1; docs/spec/08-admin-settings.md §1
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConfirmDialog } from './ConfirmDialog.js';
import { api, ApiError } from './http.js';
import { History } from './settings/History.js';
import { StepUp } from './StepUp.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

const type = (label: string, value: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
};

const flush = () =>
  act(async () => {
    await new Promise((done) => setTimeout(done, 0));
  });

describe('the confirm dialog', () => {
  function dialog(action: (reason: string) => Promise<unknown>) {
    const onClose = vi.fn();
    render(
      <ConfirmDialog
        title="Abort this round"
        effect="The round ends at once for every player."
        confirmLabel="Abort round"
        danger
        ask={{ label: 'Reason', minLength: 3 }}
        action={action}
        onClose={onClose}
      />,
    );
    return onClose;
  }

  it('states the effect and acts only with a long enough reason', async () => {
    const action = vi.fn(() => Promise.resolve());
    const onClose = dialog(action);
    expect(screen.getByRole('dialog', { name: 'Abort this round' })).toBeTruthy();
    expect(screen.getByTestId('confirm-effect').textContent).toBe(
      'The round ends at once for every player.',
    );
    const button = screen.getByTestId<HTMLButtonElement>('confirm-action');
    type('Reason', 'no');
    expect(button.disabled).toBe(true);
    type('Reason', ' cheating ');
    fireEvent.click(button);
    await flush();
    expect(action).toHaveBeenCalledWith('cheating');
    expect(onClose).toHaveBeenCalledWith(true);
  });

  it('shows a refusal and stays open; Cancel closes without acting', async () => {
    const action = vi.fn(() => Promise.reject(new ApiError(403, 'FORBIDDEN')));
    const onClose = dialog(action);
    type('Reason', 'because');
    fireEvent.click(screen.getByTestId('confirm-action'));
    await flush();
    expect(screen.getByRole('alert').textContent).toBe(
      'Abort round failed: Your account may not do this.',
    );
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledWith(false);
  });
});

describe('the step-up', () => {
  it('asks for a code when a write needs one and sends the write again', async () => {
    let writes = 0;
    const fetch = vi.fn((url: string) => {
      if (url.endsWith('/me/2fa/step-up')) return json(200, { stepUpNeeded: false });
      writes += 1;
      return writes === 1 ? json(403, { code: 'AUTH_STEP_UP_REQUIRED' }) : json(200, { ok: true });
    });
    vi.stubGlobal('fetch', fetch);
    render(<StepUp />);
    await flush();
    const write = api<{ ok: boolean }>('/admin/settings/security', { method: 'PUT', body: {} });
    await flush();
    expect(screen.getByRole('dialog', { name: 'Confirm it is you' })).toBeTruthy();
    type('Code', '123456');
    fireEvent.click(screen.getByTestId('confirm-action'));
    expect(await write).toEqual({ ok: true });
    expect(writes).toBe(2);
    expect(fetch.mock.calls.map((c) => c[0].replace(/^.*api\/v1/, ''))).toEqual([
      '/admin/settings/security',
      '/me/2fa/step-up',
      '/admin/settings/security',
    ]);
    await flush();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('gives the refusal back when the step-up is cancelled', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => json(403, { code: 'AUTH_STEP_UP_REQUIRED' })),
    );
    render(<StepUp />);
    await flush();
    const write = api('/admin/rounds/x/abort', { method: 'POST', body: {} });
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await expect(write).rejects.toMatchObject({ code: 'AUTH_STEP_UP_REQUIRED' });
  });
});

describe('the settings history', () => {
  it('lists each version with its diff and rolls back with a comment', async () => {
    const posted: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        if (url.endsWith('/rollback')) {
          posted.push(JSON.parse(typeof init?.body === 'string' ? init.body : '{}'));
          return json(200, {});
        }
        return json(200, {
          items: [
            {
              version: 3,
              createdAt: '2026-10-27T10:00:00.000Z',
              by: 'dev-admin',
              comment: 'smaller',
              changes: [
                {
                  key: 'match.maxPlayers',
                  before: { value: 300 },
                  after: { value: 200, max: 400 },
                },
              ],
            },
            {
              version: 2,
              createdAt: '2026-10-27T09:00:00.000Z',
              by: 'dev-admin',
              comment: null,
              changes: [{ key: 'match.maxPlayers', before: null, after: { value: 300 } }],
            },
          ],
        });
      }),
    );
    const changed = vi.fn();
    render(<History id="matchmaking" current={3} canEdit changed={changed} />);
    await flush();
    expect(screen.getByTestId('version-3').querySelector('li')?.textContent).toBe(
      'match.maxPlayers: 300 → 200 (highest 400)',
    );
    expect(screen.getByTestId('version-2').querySelector('li')?.textContent).toBe(
      'match.maxPlayers: catalogue default → 300',
    );
    // The current version offers no rollback; the earlier one and the defaults (1) do.
    const back = screen.getAllByRole('button', { name: 'Roll back to this version' });
    expect(back).toHaveLength(2);
    fireEvent.click(back[0] as HTMLElement);
    expect(screen.getByTestId('confirm-effect').textContent).toContain('A new version 4');
    type('Comment (goes into the audit log)', 'back to 300');
    fireEvent.click(screen.getByTestId('confirm-action'));
    await flush();
    expect(posted).toEqual([{ version: 3, toVersion: 2, comment: 'back to 300' }]);
    expect(changed).toHaveBeenCalled();
  });
});
