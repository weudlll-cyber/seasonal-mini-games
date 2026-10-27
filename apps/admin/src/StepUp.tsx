/**
 * @file   apps/admin/src/StepUp.tsx
 * @module admin
 * @brief  The two-factor step-up: asked for when a write answers AUTH_STEP_UP_REQUIRED.
 *
 * Responsibility: install the step-up handler of ./http while mounted; when a write needs a
 *                 fresh check, show the confirm dialog asking for a code of the authenticator
 *                 app or a recovery code (`POST /me/2fa/step-up`); a right code lets ./http
 *                 send the write again, Cancel gives the write's refusal back to its page.
 * Depends on:     react, ./ConfirmDialog, ./http
 * Used by:        ./App
 * Spec:           Bingo 11 §1; Bingo 05 §2.1; Bingo 03 §3
 */
import { useEffect, useState, type ReactElement } from 'react';

import { ConfirmDialog } from './ConfirmDialog.js';
import { api, setStepUpHandler } from './http.js';

export function StepUp(): ReactElement | null {
  const [pending, setPending] = useState<((passed: boolean) => void) | null>(null);
  useEffect(() => {
    setStepUpHandler(
      () =>
        new Promise<boolean>((resolve) => {
          setPending(() => resolve);
        }),
    );
    return () => {
      setStepUpHandler(null);
    };
  }, []);
  if (pending === null) return null;
  return (
    <ConfirmDialog
      title="Confirm it is you"
      effect="Enter a code of your authenticator app or a recovery code; your change is then sent again."
      confirmLabel="Check code"
      ask={{ label: 'Code', minLength: 6 }}
      action={(code) => api('/me/2fa/step-up', { method: 'POST', body: { code } })}
      onClose={(passed) => {
        setPending(null);
        pending(passed);
      }}
    />
  );
}
