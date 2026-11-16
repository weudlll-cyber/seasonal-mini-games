/**
 * @file   apps/web/src/components/LockMark.tsx
 * @module web/components
 * @brief  The mark of a locked form field: a padlock and "locked".
 *
 * Responsibility: shown by ./fields beside the label of a field that cannot be changed now (it
 *                 follows another value, or holds for the match), at the field's top right and
 *                 outside its label, so the field's accessible name stays its label (owner
 *                 decision O97, DECISIONS T354); its look is @smg/ui base.css `.smg-field-lock`.
 * Depends on:     react
 * Used by:        ./fields
 * Spec:           docs/spec/08-admin-settings.md §1
 */
import type { ReactElement } from 'react';

// The mark beside a locked field's label, at the field's top right: a padlock and "locked";
// hidden from screen readers, which hear that the control is disabled.
export function LockMark(): ReactElement {
  return (
    <span className="smg-field-lock" aria-hidden="true" data-testid="field-lock">
      <svg viewBox="0 0 16 16" focusable="false">
        <path
          d="M4.5 7V5a3.5 3.5 0 0 1 7 0v2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor" />
      </svg>
      locked
    </span>
  );
}
