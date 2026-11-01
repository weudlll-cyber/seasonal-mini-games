/**
 * @file   apps/admin/src/TextInput.tsx
 * @module admin
 * @brief  One text input of the admin app, labelled for screen readers, changed on typing.
 *
 * Responsibility: the input every admin form uses (sign-in, comments, reasons, filters, the
 *                 halving-day form), with a visible label or an aria-label only.
 * Depends on:     react
 * Used by:        ./SignIn, ./abuse/AbusePage, ./audit/AuditPage, ./seasons/SeasonsPage,
 *                 ./settings/SettingsPage
 * Spec:           Bingo 01 §13 (forms)
 */
import type { ReactElement } from 'react';

interface TextInputProps {
  readonly label: string;
  // Visible label above the input; otherwise the label is for screen readers only.
  readonly visible?: boolean;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly type?: 'text' | 'email' | 'password' | 'date';
  readonly placeholder?: string;
  readonly autoComplete?: string;
  readonly maxLength?: number;
}

export function TextInput(p: TextInputProps): ReactElement {
  const input = (
    <input
      className="smg-input"
      type={p.type ?? 'text'}
      aria-label={p.visible === true ? undefined : p.label}
      placeholder={p.placeholder}
      autoComplete={p.autoComplete}
      maxLength={p.maxLength}
      value={p.value}
      onChange={(e) => {
        p.onChange(e.target.value);
      }}
    />
  );
  if (p.visible !== true) return input;
  return (
    <label className="smg-field">
      <span>{p.label}</span>
      {input}
    </label>
  );
}
