/**
 * @file   apps/admin/src/twofactor/TwoFactorPage.tsx
 * @module admin/twofactor
 * @brief  The Two-factor area: status, enrolment with confirmation, recovery codes, disabling.
 *
 * Responsibility: show whether the account has a confirmed factor, when it was last checked
 *                 and how many recovery codes are left (`GET /me/2fa`); enrol (`POST
 *                 …/setup`): the otpauth URI and the base32 secret as text for the
 *                 authenticator app (no QR code), then the first code confirms (`…/confirm`)
 *                 and the ten recovery codes are shown once; disable through the confirm
 *                 dialog with a current code (`…/disable`).
 * Depends on:     react, @smg/contracts (two-factor views), ../ConfirmDialog, ../http, ../TextInput
 * Used by:        ../App
 * Spec:           Bingo 03 §2; Bingo 05 §2.1; Bingo 11 §1
 */
import type { TwoFactorSetupView, TwoFactorStatusView } from '@smg/contracts';
import { useCallback, useEffect, useState, type ReactElement } from 'react';

import { useConfirm } from '../ConfirmDialog.js';
import { api, failureText } from '../http.js';
import { TextInput } from '../TextInput.js';

// For the authenticator app: the key URI and the base32 secret as text (no QR code).
function Secret({ setup }: { readonly setup: TwoFactorSetupView }): ReactElement {
  return (
    <>
      <p>Add this account to your authenticator app with the address or the secret below.</p>
      <p>
        Address:{' '}
        <code className="admin-diff" data-testid="otpauth-uri">
          {setup.otpauthUri}
        </code>
      </p>
      <p>
        Secret: <code data-testid="totp-secret">{setup.secret}</code>
      </p>
    </>
  );
}

function Enrol({ done }: { readonly done: (codes: string[]) => void }): ReactElement {
  const [setup, setSetup] = useState<TwoFactorSetupView | null>(null);
  const [code, setCode] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const start = (): void => {
    api<TwoFactorSetupView>('/me/2fa/setup', { method: 'POST', body: {} })
      .then(setSetup)
      .catch((e: unknown) => {
        setProblem(failureText(e, 'Enrolment'));
      });
  };
  const confirm = (): void => {
    api<{ recoveryCodes: string[] }>('/me/2fa/confirm', { method: 'POST', body: { code } })
      .then((r) => {
        done(r.recoveryCodes);
      })
      .catch((e: unknown) => {
        setProblem(failureText(e, 'Confirming'));
      });
  };
  if (setup === null) {
    return (
      <div className="smg-stack">
        <button type="button" className="smg-btn smg-btn--primary" onClick={start}>
          Set up two-factor sign-in
        </button>
        {problem === null ? null : <p role="alert">{problem}</p>}
      </div>
    );
  }
  return (
    <div className="smg-stack">
      <Secret setup={setup} />
      <div className="smg-row">
        <TextInput
          label="Six-digit code from the app"
          visible
          value={code}
          onChange={setCode}
          maxLength={6}
        />
        <button
          type="button"
          className="smg-btn smg-btn--primary"
          disabled={code.length !== 6}
          onClick={confirm}
        >
          Confirm
        </button>
      </div>
      {problem === null ? null : <p role="alert">{problem}</p>}
    </div>
  );
}

function Codes({ codes }: { readonly codes: readonly string[] }): ReactElement {
  return (
    <section className="smg-panel smg-panel--inset smg-stack" aria-label="Recovery codes">
      <h2>Recovery codes</h2>
      <p>
        Keep these ten codes somewhere safe. Each one works once instead of a code of the app. They
        are shown only now.
      </p>
      <ul className="admin-codes" data-testid="recovery-codes">
        {codes.map((c) => (
          <li key={c}>
            <code>{c}</code>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TwoFactorPage(): ReactElement {
  const [status, setStatus] = useState<TwoFactorStatusView | null>(null);
  const [codes, setCodes] = useState<readonly string[] | null>(null);
  const load = useCallback(async () => {
    setStatus(await api<TwoFactorStatusView>('/me/2fa'));
  }, []);
  const [dialog, open] = useConfirm(() => void load());
  useEffect(() => {
    void load();
  }, [load]);
  if (status === null) return <p className="smg-muted">Loading…</p>;
  const disable = (): void => {
    open({
      title: 'Disable two-factor sign-in',
      effect:
        'Your authenticator app and recovery codes stop working, and admin changes stay refused until you enrol again.',
      confirmLabel: 'Disable',
      danger: true,
      ask: { label: 'Current code or a recovery code', minLength: 6 },
      action: (code) => api('/me/2fa/disable', { method: 'POST', body: { code } }),
    });
  };
  return (
    <section className="smg-panel smg-stack">
      <h1>Two-factor sign-in</h1>
      <p role="status" data-testid="two-factor-status">
        {status.enrolled
          ? `On. ${String(status.recoveryCodesLeft)} recovery codes left. Last check: ${status.lastCheckAt === null ? 'none' : new Date(status.lastCheckAt).toLocaleString()}.`
          : 'Off. Admin changes need it when the server requires two-factor sign-in.'}
      </p>
      {codes === null ? null : <Codes codes={codes} />}
      {status.enrolled ? (
        <button type="button" className="smg-btn smg-btn--danger" onClick={disable}>
          Disable two-factor sign-in
        </button>
      ) : (
        <Enrol
          done={(c) => {
            setCodes(c);
            void load();
          }}
        />
      )}
      {dialog}
    </section>
  );
}
