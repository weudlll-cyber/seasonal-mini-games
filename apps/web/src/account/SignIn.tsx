/**
 * @file   apps/web/src/account/SignIn.tsx
 * @module web/account
 * @brief  Sign in with e-mail and password; the way to Register; the website's sign-in.
 *
 * Responsibility: the sign-in form (e-mail, password), the server's refusal in plain words
 *                 (./accountText), then the lobby. A link leads to Register. In website mode
 *                 (O66) there is no form: every "Sign in" link goes to the website's sign-in
 *                 route with the page shown as `next` (`SignInLink`), and the sign-in and
 *                 register addresses show that link alone (`WebsiteSignIn`).
 * Depends on:     react, ../shell/session, ../shell/router, ./formParts, ./account.css
 * Used by:        ../shell/AppShell, ../lobby/Lobby, ./AccountPage, ../chat/ChatPanel
 * Spec:           Bingo 05 §2.1; Bingo 03 §2.1; docs/spec/07-integration.md §7
 */
import { useState, type ReactElement, type ReactNode } from 'react';

import { hrefOf } from '../shell/router.js';
import { useSession, websiteSignInHref } from '../shell/session.js';
import { AccountField, FormError, useAccountSubmit } from './formParts.js';
import './account.css';

export function SignIn(): ReactElement {
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { error, busy, submit } = useAccountSubmit(() => signIn(email.trim(), password));
  return (
    <form className="smg-panel account-form" onSubmit={submit} data-testid="sign-in-form">
      <h1>Sign in</h1>
      <AccountField
        label="E-mail"
        type="email"
        autoComplete="email"
        value={email}
        testId="sign-in-email"
        onChange={setEmail}
      />
      <AccountField
        label="Password"
        type="password"
        autoComplete="current-password"
        value={password}
        testId="sign-in-password"
        onChange={setPassword}
      />
      <FormError text={error} testId="sign-in-error" />
      <button
        type="submit"
        className="smg-btn smg-btn--primary"
        disabled={busy}
        data-testid="sign-in-submit"
      >
        Sign in
      </button>
      <p className="smg-muted">
        No account yet? <a href={hrefOf({ name: 'register' })}>Register</a>
      </p>
    </form>
  );
}

// A link to sign in: the game's form, or in website mode the website's sign-in for this page.
export function SignInLink(p: {
  readonly className?: string;
  readonly testId?: string;
  readonly children: ReactNode;
}): ReactElement {
  const signInPath = useSession().session?.signInPath ?? null;
  return (
    <a
      className={p.className}
      href={signInPath === null ? hrefOf({ name: 'signIn' }) : websiteSignInHref(signInPath)}
      data-testid={p.testId}
    >
      {p.children}
    </a>
  );
}

// Website mode: the sign-in and register addresses lead to the website's sign-in instead.
export function WebsiteSignIn(): ReactElement {
  return (
    <section className="smg-panel account-form" data-testid="website-sign-in">
      <h1>Sign in</h1>
      <p>Players sign in with their Seasonal Entertainment account.</p>
      <SignInLink className="smg-btn smg-btn--primary">Sign in</SignInLink>
    </section>
  );
}
