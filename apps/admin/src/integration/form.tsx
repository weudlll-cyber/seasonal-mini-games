/**
 * @file   apps/admin/src/integration/form.tsx
 * @module admin/integration
 * @brief  What the Integration area's forms share: a checkbox, a text area, the words for a
 *         body the shared contract refused, the form's buttons, the "New …" button that
 *         gives way to the open form, and a table with its head.
 *
 * Responsibility: every form of the area checks its body with the contract's zod schema
 *                 before sending; `issueText` names the first problem with the field's
 *                 label ("Issuer: Invalid URL"), so the admin sees which field to fix.
 * Depends on:     react
 * Used by:        ./ProviderForm, ./ProvidersPanel, ./OriginsPanel, ./WebhookForm, ./WebhooksPanel
 * Spec:           Bingo 01 §13 (forms); Bingo 11 §1
 */
import type { ReactElement, ReactNode } from 'react';

interface Issue {
  readonly path: readonly PropertyKey[];
  readonly message: string;
}

// "<label>: <message>" for the first issue; the form's own words when the path has no label.
export function issueText(
  issues: readonly Issue[],
  labels: Readonly<Record<string, string>>,
): string {
  const first = issues[0];
  if (first === undefined) return 'Check the form.';
  const label = labels[String(first.path[0] ?? '')] ?? 'The form';
  return `${label}: ${first.message}`;
}

export function Checkbox(p: {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}): ReactElement {
  return (
    <label className="smg-row">
      <input
        type="checkbox"
        checked={p.checked}
        onChange={(e) => {
          p.onChange(e.target.checked);
        }}
      />
      <span>{p.label}</span>
    </label>
  );
}

export function TextArea(p: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
}): ReactElement {
  return (
    <label className="smg-field">
      <span>{p.label}</span>
      <textarea
        className="smg-input admin-textarea"
        rows={4}
        placeholder={p.placeholder}
        value={p.value}
        onChange={(e) => {
          p.onChange(e.target.value);
        }}
      />
    </label>
  );
}

// Save and Cancel under a form, with the refusal of the moment above them.
export function FormEnd(p: {
  readonly saveLabel: string;
  readonly problem: string | null;
  readonly cancel: () => void;
}): ReactElement {
  return (
    <>
      {p.problem === null ? null : <p role="alert">{p.problem}</p>}
      <div className="smg-row">
        <button type="submit" className="smg-btn smg-btn--primary">
          {p.saveLabel}
        </button>
        <button type="button" className="smg-btn" onClick={p.cancel}>
          Cancel
        </button>
      </div>
    </>
  );
}

// The open form, or the button that opens a new one.
export function NewOrForm(p: {
  readonly label: string;
  readonly form: ReactElement | null;
  readonly start: () => void;
}): ReactElement {
  if (p.form !== null) return p.form;
  return (
    <button type="button" className="smg-btn smg-btn--primary" onClick={p.start}>
      {p.label}
    </button>
  );
}

// A list as a table that scrolls inside its panel.
export function Table(p: {
  readonly head: readonly string[];
  readonly children: ReactNode;
}): ReactElement {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {p.head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{p.children}</tbody>
      </table>
    </div>
  );
}
