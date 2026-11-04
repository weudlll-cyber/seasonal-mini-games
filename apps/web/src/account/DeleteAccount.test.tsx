// @vitest-environment jsdom
/**
 * @file   apps/web/src/account/DeleteAccount.test.tsx
 * @module web/account
 * @brief  "Delete my account": what it says, the typed confirmation, the server's answers.
 *
 * Responsibility: the account page's danger button opens the form with what is deleted and
 *                 what stays; Delete stays off until the display name is typed exactly, Cancel
 *                 closes the form; a confirmed deletion sends DELETE /me with `{ confirm }` and
 *                 the CSRF token, refreshes the session (signed out) and shows the notice at
 *                 #/account/deleted; PASSWORD_REQUIRED brings a password field whose value
 *                 goes along on the next try; CONFIRMATION_REQUIRED reads as a sentence.
 * Depends on:     @testing-library/react, vitest, ./AccountPage, ./DeleteAccount, ../shell/*
 * Spec:           DECISIONS T105, T170; docs/spec/07-integration.md §4
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { hrefOf, parseRoute } from '../shell/router.js';
import { SessionProvider } from '../shell/session.js';
import { AccountPage } from './AccountPage.js';
import { AccountDeleted } from './DeleteAccount.js';

const NAME = 'Embed42';

interface Sent {
  readonly method: string;
  readonly body: unknown;
  readonly csrf: string | null;
}

// A server with one signed-in account; `refusals` answer the DELETE calls in turn, then 204.
function serve(refusals: readonly string[] = []): Sent[] {
  const sent: Sent[] = [];
  let signedIn = true;
  const left = [...refusals];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      if (url.endsWith('/me')) {
        const headers = init.headers as Record<string, string>;
        sent.push({
          method: init.method ?? 'GET',
          body: JSON.parse(init.body as string),
          csrf: headers['x-csrf-token'] ?? null,
        });
        const code = left.shift();
        if (code !== undefined) {
          return Promise.resolve(new Response(JSON.stringify({ code }), { status: 403 }));
        }
        signedIn = false;
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      const session = signedIn
        ? { signedIn, account: { id: 'a1', displayName: NAME }, permissions: [], csrfToken: 't' }
        : { signedIn, account: null, permissions: [], csrfToken: null };
      return Promise.resolve(new Response(JSON.stringify(session)));
    }),
  );
  return sent;
}

async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function openForm(): Promise<void> {
  render(
    <SessionProvider>
      <AccountPage />
    </SessionProvider>,
  );
  await settle();
  fireEvent.click(screen.getByTestId('delete-account-open'));
}

const type = (testId: string, value: string): void => {
  fireEvent.change(screen.getByTestId(testId), { target: { value } });
};
const submit = (): HTMLElement => screen.getByTestId('delete-account-submit');

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.location.hash = '';
});

describe('the deletion form', () => {
  it('says what is deleted and what stays, and waits for the exact display name', async () => {
    serve();
    await openForm();
    const effects = screen.getByTestId('delete-account-effects');
    expect(effects.textContent).toMatch(/cannot be undone/);
    expect(effects.textContent).toMatch(/league points/);
    expect(effects.textContent).toMatch(/keep their history/);
    expect(submit()).toHaveProperty('disabled', true);
    type('delete-account-name', NAME.toLowerCase());
    expect(submit()).toHaveProperty('disabled', true);
    type('delete-account-name', ` ${NAME} `);
    expect(submit()).toHaveProperty('disabled', false);
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByTestId('delete-account-form')).toBeNull();
  });

  it('deletes with the typed name, signs out and shows the notice', async () => {
    const sent = serve();
    await openForm();
    type('delete-account-name', NAME);
    fireEvent.click(submit());
    await settle();
    expect(sent).toEqual([{ method: 'DELETE', body: { confirm: NAME }, csrf: 't' }]);
    expect(window.location.hash).toBe('#/account/deleted');
    // Signed out: the account page now points to Sign in.
    expect(screen.getByText(/to see your account/)).toBeTruthy();
  });

  it('asks for the password when the account has one, and sends it on the next try', async () => {
    const sent = serve(['PASSWORD_REQUIRED']);
    await openForm();
    type('delete-account-name', NAME);
    fireEvent.click(submit());
    await settle();
    expect(screen.getByTestId('delete-account-error').textContent).toMatch(/has a password/);
    expect(submit()).toHaveProperty('disabled', true);
    type('delete-account-password', 'correct horse battery');
    fireEvent.click(submit());
    await settle();
    expect(sent.map((s) => s.body)).toEqual([
      { confirm: NAME },
      { confirm: NAME, password: 'correct horse battery' },
    ]);
    expect(window.location.hash).toBe('#/account/deleted');
  });

  it('reads a refused confirmation as a sentence and stays open', async () => {
    serve(['CONFIRMATION_REQUIRED']);
    await openForm();
    type('delete-account-name', NAME);
    fireEvent.click(submit());
    await settle();
    expect(screen.getByTestId('delete-account-error').textContent).toBe(
      'The name you typed is not your display name.',
    );
    expect(submit()).toHaveProperty('disabled', false);
  });
});

describe('after the deletion', () => {
  it('has its own address and says the account is gone', () => {
    expect(parseRoute('#/account/deleted')).toEqual({ name: 'accountDeleted' });
    expect(hrefOf({ name: 'accountDeleted' })).toBe('#/account/deleted');
    expect(parseRoute('#/account/other')).toEqual({ name: 'account' });
    render(<AccountDeleted />);
    expect(screen.getByRole('status').textContent).toMatch(/deleted and you are signed out/);
  });
});
