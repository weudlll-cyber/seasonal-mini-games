/**
 * @file   apps/web/src/account/AccountPage.tsx
 * @module web/account
 * @brief  The own account: change the password, delete the account.
 *
 * Responsibility: for an account with a password (the session says so, T201), a form with
 *                 the current password and the new one twice; the rules are checked before
 *                 sending (./accountText), the server's refusal shows as a sentence; on
 *                 success the page says that every other device was signed out. An account
 *                 the website's handoff made has no password: no form, one line saying it
 *                 signs in through the website. Below either "Delete my account"
 *                 (./DeleteAccount). Signed out, the page points to Sign in.
 * Depends on:     react, ../shell/http, ../shell/router, ../shell/session, ./formParts,
 *                 ./accountText, ./DeleteAccount, ./account.css
 * Used by:        ../shell/AppShell
 * Spec:           docs/spec/05-security-threat-model.md §1; Bingo 03 §2.1; DECISIONS T105, T201
 */
import { useState, type ReactElement, type SyntheticEvent } from 'react';

import { api } from '../shell/http.js';
import { hrefOf } from '../shell/router.js';
import { useSession } from '../shell/session.js';
import { accountError, passwordText } from './accountText.js';
import { DeleteAccount } from './DeleteAccount.js';
import { AccountField, FormError } from './formParts.js';
import './account.css';

interface Passwords {
  readonly current: string;
  readonly next: string;
  readonly again: string;
}

const EMPTY: Passwords = { current: '', next: '', again: '' };

function problem(p: Passwords): string | null {
  const length = p.next.length < 12 ? 'tooShort' : p.next.length > 128 ? 'tooLong' : null;
  return passwordText(length) ?? (p.next === p.again ? null : 'The two new passwords differ.');
}

export function AccountPage(): ReactElement {
  const { session } = useSession();
  const account = session?.account ?? null;
  if (account === null) {
    return (
      <p className="smg-panel">
        <a href={hrefOf({ name: 'signIn' })}>Sign in</a> to see your account.
      </p>
    );
  }
  const heading = (
    <>
      <h1>Your account</h1>
      <p className="smg-muted">Signed in as {account.displayName}.</p>
    </>
  );
  return (
    <div className="smg-stack">
      {account.hasPassword ? (
        <ChangePassword heading={heading} />
      ) : (
        // A website account has no password to change (T201): it signs in through the website.
        <div className="smg-panel account-form" data-testid="account-no-password">
          {heading}
          <p>You sign in through the website, so this account has no password here.</p>
        </div>
      )}
      <DeleteAccount displayName={account.displayName} />
    </div>
  );
}

function ChangePassword({ heading }: { readonly heading: ReactElement }): ReactElement {
  const [values, setValues] = useState<Passwords>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const submit = (event: SyntheticEvent): void => {
    event.preventDefault();
    const found = problem(values);
    setError(found);
    setDone(false);
    if (found !== null) return;
    api('/me/password', { method: 'POST', body: { current: values.current, next: values.next } })
      .then(() => {
        setDone(true);
        setValues(EMPTY);
      })
      .catch((e: unknown) => {
        setError(accountError(e));
      });
  };
  return (
    <form className="smg-panel account-form" onSubmit={submit} data-testid="password-form">
      {heading}
      <h2>Change password</h2>
      <PasswordFields values={values} onChange={setValues} />
      <FormError text={error} testId="password-error" />
      {done ? (
        <p role="status" data-testid="password-done">
          Password changed. Every other device was signed out.
        </p>
      ) : null}
      <button type="submit" className="smg-btn smg-btn--primary" data-testid="password-submit">
        Change password
      </button>
    </form>
  );
}

function PasswordFields(p: {
  readonly values: Passwords;
  readonly onChange: (next: Passwords) => void;
}): ReactElement {
  const set = (key: keyof Passwords) => (value: string) => {
    p.onChange({ ...p.values, [key]: value });
  };
  return (
    <>
      <AccountField
        label="Current password"
        type="password"
        autoComplete="current-password"
        value={p.values.current}
        testId="password-current"
        onChange={set('current')}
      />
      <AccountField
        label="New password"
        type="password"
        autoComplete="new-password"
        value={p.values.next}
        testId="password-next"
        hint="At least 12 characters."
        onChange={set('next')}
      />
      <AccountField
        label="New password again"
        type="password"
        autoComplete="new-password"
        value={p.values.again}
        testId="password-again"
        onChange={set('again')}
      />
    </>
  );
}
