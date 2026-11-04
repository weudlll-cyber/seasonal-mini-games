/**
 * @file   apps/web/src/account/DeleteAccount.tsx
 * @module web/account
 * @brief  "Delete my account" on the account page, and the notice shown once it is done.
 *
 * Responsibility: a danger button that opens the deletion form: what is deleted and what stays
 *                 (worded from what DELETE /me does: the account row goes, with what hangs on
 *                 it by cascade; matches, rounds and chat lines keep their history without the
 *                 link), the display name typed exactly to confirm (the button stays off until
 *                 it matches), Cancel. An account with a password is asked for it as well once
 *                 the server answers PASSWORD_REQUIRED (the client cannot tell beforehand).
 *                 Deleted, the server has ended every session; the client refreshes its session
 *                 (signed out) and shows `AccountDeleted`. The confirm pattern mirrors the
 *                 admin app's ConfirmDialog (effect first, Cancel beside a danger button that
 *                 stays off until the input is right, the refusal in words).
 * Depends on:     react, ../components/fields, ../shell/http, ../shell/router, ../shell/session,
 *                 ./accountText, ./formParts
 * Used by:        ./AccountPage, ../shell/AppShell
 * Spec:           docs/spec/05-security-threat-model.md §1 (privacy); docs/spec/07-integration.md §4;
 *                 DECISIONS T105, T170
 */
import { useState, type ReactElement, type SyntheticEvent } from 'react';

import { ActionButton } from '../components/fields.js';
import { ApiError } from '../shell/http.js';
import { hrefOf, navigate } from '../shell/router.js';
import { useSession } from '../shell/session.js';
import { accountError } from './accountText.js';
import { AccountField, FormError } from './formParts.js';

// From the server: accounts.ts deleteAccount and the foreign keys of the migrations (CASCADE
// for sessions, roles, league awards and entries, the website link; SET NULL for match
// players, chat messages). Nothing here may promise more than that.
const DELETED = [
  'Your account and its display name, and your sign-in on every device.',
  'Your league points and your places on every leaderboard.',
  'The link to your website sign-in, if you came from the website.',
] as const;
const KEPT = [
  'The matches and rounds you played keep their history, no longer linked to you.',
  'Chat messages you sent stay without your name until the chat removes old messages.',
] as const;

export function DeleteAccount({ displayName }: { readonly displayName: string }): ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <section className="smg-panel account-form" aria-labelledby="delete-account-title">
      <h2 id="delete-account-title">Delete my account</h2>
      {open ? (
        <DeleteForm
          displayName={displayName}
          cancel={() => {
            setOpen(false);
          }}
        />
      ) : (
        <div className="smg-row">
          <ActionButton
            label="Delete my account"
            kind="danger"
            testId="delete-account-open"
            onClick={() => {
              setOpen(true);
            }}
          />
        </div>
      )}
    </section>
  );
}

function Effects(): ReactElement {
  return (
    <div data-testid="delete-account-effects">
      <p>This cannot be undone. Signing in through the website later makes a new, empty account.</p>
      <h3>What is deleted</h3>
      <ul>
        {DELETED.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <h3>What stays</h3>
      <ul>
        {KEPT.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

// The form's state and its one server call; `ready` once the typed name matches.
function useDeletion(displayName: string) {
  const { deleteAccount } = useSession();
  const [typed, setTyped] = useState('');
  // null: no password field (an account made by the website's handoff has none).
  const [password, setPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The server compares the trimmed text with the display name exactly (DECISIONS T105).
  const ready = !busy && typed.trim() === displayName && password !== '';
  const submit = (event: SyntheticEvent): void => {
    event.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    deleteAccount({ confirm: typed.trim(), ...(password === null ? {} : { password }) })
      .then(() => {
        navigate({ name: 'accountDeleted' });
      })
      .catch((e: unknown) => {
        setBusy(false);
        // The account has a password: ask for it too, then send again.
        if (password === null && e instanceof ApiError && e.code === 'PASSWORD_REQUIRED') {
          setPassword('');
          setError('This account has a password. Enter it as well to delete the account.');
          return;
        }
        setError(accountError(e));
      });
  };
  return { typed, setTyped, password, setPassword, error, ready, submit };
}

function DeleteForm(p: { readonly displayName: string; readonly cancel: () => void }) {
  const { typed, setTyped, password, setPassword, error, ready, submit } = useDeletion(
    p.displayName,
  );
  return (
    <form className="smg-stack" onSubmit={submit} data-testid="delete-account-form">
      <Effects />
      <AccountField
        label={`Type your display name, ${p.displayName}, to confirm`}
        type="text"
        autoComplete="off"
        value={typed}
        testId="delete-account-name"
        onChange={setTyped}
      />
      {password === null ? null : (
        <AccountField
          label="Your password"
          type="password"
          autoComplete="current-password"
          value={password}
          testId="delete-account-password"
          onChange={setPassword}
        />
      )}
      <FormError text={error} testId="delete-account-error" />
      <div className="smg-row">
        <button
          type="submit"
          className="smg-btn smg-btn--danger"
          disabled={!ready}
          data-testid="delete-account-submit"
        >
          Delete my account
        </button>
        <ActionButton label="Cancel" onClick={p.cancel} />
      </div>
    </form>
  );
}

// After the deletion: the session is gone; this page only says so (#/account/deleted).
export function AccountDeleted(): ReactElement {
  return (
    <section className="smg-panel account-form" data-testid="account-deleted">
      <h1>Account deleted</h1>
      <p role="status">Your account was deleted and you are signed out.</p>
      <p>
        <a href={hrefOf({ name: 'lobby' })}>Back to Play</a>
      </p>
    </section>
  );
}
