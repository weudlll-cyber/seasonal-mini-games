/**
 * @file   apps/web/src/components/fields.tsx
 * @module web/components
 * @brief  Labelled form fields (text, number, choice, switch), an action button, a problem line.
 *
 * Responsibility: one look and one accessible structure for the forms of the lobby, the
 *                 host console and the Quick Test (label wraps its control, the optional help
 *                 line describes it); numbers keep their bounds as attributes, the server checks again.
 *                 Same pattern as ../account/formParts AccountField.
 * Depends on:     react
 * Used by:        ../lobby/Lobby, ../match/HostMenu, ../shell/QuickTest
 * Spec:           Bingo 01 §13 (forms); docs/spec/02-game-guess-the-number.md §12 (keyboard play)
 */
import { cloneElement, useId, type ReactElement } from 'react';

interface Base {
  readonly label: string;
  readonly help?: string | undefined;
  readonly testId?: string;
}

// The label names the control; the help line describes it (aria-describedby), so a field's
// accessible name is its label alone.
function Labelled({
  label,
  help,
  children,
}: Base & { readonly children: ReactElement<{ 'aria-describedby'?: string }> }): ReactElement {
  const helpId = useId();
  return (
    <div className="smg-field">
      <label>
        <span>{label}</span>
        {help === undefined ? children : cloneElement(children, { 'aria-describedby': helpId })}
      </label>
      {help === undefined ? null : (
        <small id={helpId} className="smg-muted">
          {help}
        </small>
      )}
    </div>
  );
}

export function TextField(
  p: Base & {
    readonly value: string;
    readonly maxLength: number;
    readonly placeholder?: string;
    readonly onChange: (v: string) => void;
  },
): ReactElement {
  return (
    <Labelled label={p.label} help={p.help}>
      <input
        className="smg-input"
        value={p.value}
        maxLength={p.maxLength}
        placeholder={p.placeholder}
        data-testid={p.testId}
        onChange={(e) => {
          p.onChange(e.target.value);
        }}
      />
    </Labelled>
  );
}

export function NumberField(
  p: Base & {
    readonly value: number;
    readonly min: number;
    readonly max: number;
    readonly step?: number;
    readonly onChange: (v: number) => void;
  },
): ReactElement {
  return (
    <Labelled label={p.label} help={p.help}>
      <input
        className="smg-input"
        type="number"
        min={p.min}
        max={p.max}
        step={p.step ?? 1}
        value={p.value}
        data-testid={p.testId}
        onChange={(e) => {
          p.onChange(Number(e.target.value));
        }}
      />
    </Labelled>
  );
}

export function ChoiceField<T extends string>(
  p: Base & {
    readonly value: T;
    readonly options: readonly { readonly value: T; readonly label: string }[];
    readonly onChange: (v: T) => void;
  },
): ReactElement {
  return (
    <Labelled label={p.label} help={p.help}>
      <select
        className="smg-select"
        value={p.value}
        data-testid={p.testId}
        onChange={(e) => {
          p.onChange(e.target.value as T);
        }}
      >
        {p.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Labelled>
  );
}

export function SwitchField(
  p: Base & { readonly checked: boolean; readonly onChange: (v: boolean) => void },
): ReactElement {
  return (
    <Labelled label={p.label} help={p.help}>
      <input
        type="checkbox"
        checked={p.checked}
        data-testid={p.testId}
        onChange={(e) => {
          p.onChange(e.target.checked);
        }}
      />
    </Labelled>
  );
}

// The same choice list for strings that are their own label.
export const plain = <T extends string>(values: readonly T[]) =>
  values.map((value) => ({ value, label: value }));

// A button that runs an action; `kind` picks the primary or danger look.
export function ActionButton(p: {
  readonly label: string;
  readonly onClick: () => void;
  readonly kind?: 'primary' | 'danger';
  readonly disabled?: boolean;
  readonly testId?: string;
}): ReactElement {
  return (
    <button
      type="button"
      className={p.kind === undefined ? 'smg-btn' : `smg-btn smg-btn--${p.kind}`}
      disabled={p.disabled}
      data-testid={p.testId}
      onClick={p.onClick}
    >
      {p.label}
    </button>
  );
}

// A refusal or problem in plain words, announced to screen readers.
export function Problem({ text }: { readonly text: string | null }): ReactElement | null {
  return text === null ? null : (
    <p role="alert" className="round-refusal">
      {text}
    </p>
  );
}
