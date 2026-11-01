/**
 * @file   apps/admin/src/SignIn.tsx
 * @module admin
 * @brief  Sign-in to the admin app, with the quick admin sign-in in development builds.
 *
 * Responsibility: e-mail and password against the local accounts (`POST /auth/login`), the
 *                 same plain answer for a wrong password and an unknown address; in
 *                 development builds a "Sign in as admin" button (`POST /dev/sign-in`, T26).
 * Depends on:     react, ./http, ./TextInput
 * Used by:        ./App
 * Spec:           Bingo 05 §2.1; docs/DECISIONS.md T26
 */
import { useState, type ReactElement, type SyntheticEvent } from 'react';

import { api } from './http.js';
import { TextInput } from './TextInput.js';

interface SignInProps {
  readonly dev: boolean;
  readonly done: () => Promise<void>;
}

export function SignIn({ dev, done }: SignInProps): ReactElement {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const signIn = (e: SyntheticEvent): void => {
    e.preventDefault();
    api('/auth/login', { method: 'POST', body: { email, password } })
      .then(done)
      .catch(() => {
        setProblem('That e-mail and password do not match an account.');
      });
  };
  const asAdmin = (): void => {
    void api('/dev/sign-in', { method: 'POST', body: { as: 'admin' } }).then(done);
  };
  return (
    <main className="admin-main">
      <form className="smg-panel smg-stack admin-sign-in" onSubmit={signIn}>
        <h1>Admin sign-in</h1>
        <TextInput
          label="E-mail"
          visible
          type="email"
          autoComplete="username"
          value={email}
          onChange={setEmail}
        />
        <TextInput
          label="Password"
          visible
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
        />
        {problem === null ? null : <p role="alert">{problem}</p>}
        <button type="submit" className="smg-btn smg-btn--primary">
          Sign in
        </button>
        {dev ? (
          <button type="button" className="smg-btn" onClick={asAdmin} data-testid="dev-admin">
            Sign in as admin (development)
          </button>
        ) : null}
      </form>
    </main>
  );
}
