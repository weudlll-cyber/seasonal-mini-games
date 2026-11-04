// @vitest-environment jsdom
/**
 * @file   apps/web/src/account/AccountPage.test.tsx
 * @module web/account
 * @brief  The account page offers "Change password" only to an account that has a password.
 *
 * Responsibility: a local account (the session's `hasPassword` true) sees the password form;
 *                 an account the website's handoff made (`hasPassword` false) sees no form and
 *                 no password field, only the line that it signs in through the website, and
 *                 still "Delete my account".
 * Depends on:     @testing-library/react, vitest, ./AccountPage, ../shell/session
 * Spec:           DECISIONS T105, T201; docs/spec/07-integration.md §4
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SessionProvider } from '../shell/session.js';
import { AccountPage } from './AccountPage.js';

// GET /session answers one signed-in account, with or without a password.
async function showPage(hasPassword: boolean): Promise<void> {
  const session = {
    signedIn: true,
    account: { id: 'a1', displayName: 'Embed42', hasPassword },
    permissions: [],
    csrfToken: 't',
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(JSON.stringify(session)))),
  );
  render(
    <SessionProvider>
      <AccountPage />
    </SessionProvider>,
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the account page', () => {
  it('offers "Change password" to an account with a password', async () => {
    await showPage(true);
    expect(screen.getByTestId('password-form')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Change password' })).toBeTruthy();
    expect(screen.queryByTestId('account-no-password')).toBeNull();
  });

  it('offers no password change to a website account, only its deletion', async () => {
    await showPage(false);
    expect(screen.queryByTestId('password-form')).toBeNull();
    expect(screen.queryByText('Change password')).toBeNull();
    expect(screen.queryByLabelText(/password/i)).toBeNull();
    expect(screen.getByTestId('account-no-password').textContent).toMatch(
      /sign in through the website/,
    );
    expect(screen.getByText(/Signed in as Embed42/)).toBeTruthy();
    expect(screen.getByTestId('delete-account-open')).toBeTruthy();
  });
});
