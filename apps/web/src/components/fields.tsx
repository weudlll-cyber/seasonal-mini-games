/**
 * @file   apps/web/src/components/fields.tsx
 * @module web/components
 * @brief  Labelled form fields (text, number, choice, switch), an action button, a problem line.
 *
 * Responsibility: one look and one accessible structure for the forms of the lobby, the
 *                 host console and the Quick Test (label wraps its control, the optional help
 *                 line describes it). A number field keeps the text as typed while editing
 *                 (an empty field or a lone "-" stays), hands a value to the form as soon as it
 *                 is a number the field's check takes (a setting's own check, its sentence
 *                 under the field while the text is outside it, O74; without one the bounds,
 *                 named the same way), and clamps into the bounds on blur (back to the form's
 *                 value when the text is no number); the bounds stay attributes too, so the
 *                 browser refuses to submit an out-of-range value, and the server checks
 *                 again. Where negative numbers are allowed it has the shared ± button (T57).
 *                 A setting's off value outside the bounds (the inactivity limit's 0, O71) is
 *                 the browser's lower bound then, so between it and the bounds only the check
 *                 refuses. Every field shows a problem the server named for it under its help
 *                 line, announced as an alert (O74). Same pattern as
 *                 ../account/formParts AccountField.
 * Depends on:     react, @smg/ui (sign toggle)
 * Used by:        ../lobby/Lobby, ../match/HostMenu, ../shell/QuickTest
 * Spec:           Bingo 01 §13 (forms); docs/spec/02-game-guess-the-number.md §12 (keyboard play)
 */
import { flipSign, SignToggle } from '@smg/ui';
import { cloneElement, useId, useState, type ReactElement, type ReactNode } from 'react';

interface Base {
  readonly label: string;
  readonly help?: string | undefined;
  readonly testId?: string;
  // The server's sentence for this field after a refused save (O74), shown under the help.
  readonly problem?: string | undefined;
}

// The label names the control; the help line and a problem line describe it
// (aria-describedby), so a field's accessible name is its label alone. `after` sits beside
// the control, outside the label (the ± button). The problem line is in the danger colour; a
// problem the server named is announced (`alert`), the number field's own while typing not.
function Labelled({
  label,
  help,
  problem,
  alert = true,
  after,
  children,
}: Base & {
  readonly alert?: boolean;
  readonly after?: ReactNode;
  readonly children: ReactElement<{ 'aria-describedby'?: string }>;
}): ReactElement {
  const helpId = useId();
  const problemId = useId();
  const ids = [help === undefined ? '' : helpId, problem === undefined ? '' : problemId];
  const described = ids.filter((id) => id !== '').join(' ');
  return (
    <div className={after === undefined ? 'smg-field' : 'smg-field smg-field--signed'}>
      <label>
        <span>{label}</span>
        {described === '' ? children : cloneElement(children, { 'aria-describedby': described })}
      </label>
      {after}
      {help === undefined ? null : (
        <small id={helpId} className="smg-muted">
          {help}
        </small>
      )}
      {problem === undefined ? null : (
        <small
          id={problemId}
          role={alert ? 'alert' : undefined}
          className="smg-muted smg-field-help--error"
          data-testid="field-problem"
        >
          {problem}
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
    <Labelled label={p.label} help={p.help} problem={p.problem}>
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

type NumberProps = Base & {
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  // A value outside min–max that switches the setting off (the inactivity limit's 0, O71):
  // the browser's lower bound, so the field's check decides on it.
  readonly off?: number | undefined;
  // The field's own check (a setting's, O74): null when it takes the value, else the
  // sentence to show; without one, the value must lie within min–max.
  readonly check?: ((v: number) => string | null) | undefined;
  readonly onChange: (v: number) => void;
};

// The typed text as a number, or null while it is none yet ("" — a number input reports a
// lone "-" as "" too).
function numberOf(text: string): number | null {
  if (text.trim() === '') return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

// The field's own text. Passing the number straight back (Number("") is 0) turned a typed
// "-" into 0; now the text stays as typed and only a number within the bounds reaches the form.
function useDraft(p: NumberProps) {
  const [text, setText] = useState(String(p.value));
  const [seen, setSeen] = useState(p.value);
  // The form changed the value itself (a prefill, a reset): show it, unless the text says so already.
  if (p.value !== seen) {
    setSeen(p.value);
    if (numberOf(text) !== p.value) setText(String(p.value));
  }
  const n = numberOf(text);
  const fits = (v: number): boolean =>
    p.check === undefined ? v >= p.min && v <= p.max : p.check(v) === null;
  const edit = (next: string): void => {
    setText(next);
    const v = numberOf(next);
    if (v !== null && fits(v)) p.onChange(v);
  };
  const settle = (): void => {
    const kept = n === null ? p.value : fits(n) ? n : Math.min(p.max, Math.max(p.min, n));
    setText(String(kept));
    if (kept !== p.value) p.onChange(kept);
  };
  // While the text is outside: the check's sentence, else the bounds.
  const outside =
    n === null || fits(n)
      ? null
      : (p.check?.(n) ?? `Allowed: ${String(p.min)} to ${String(p.max)}.`);
  return { text, outside, edit, settle };
}

export function NumberField(p: NumberProps): ReactElement {
  const { text, outside, edit, settle } = useDraft(p);
  // The server's sentence after a refused save wins over the field's own while typing.
  const problem = p.problem ?? outside ?? undefined;
  const sign =
    p.min < 0 ? (
      <SignToggle
        label={`Change the sign: ${p.label}`}
        onFlip={() => {
          edit(flipSign(text));
        }}
      />
    ) : undefined;
  return (
    <Labelled
      label={p.label}
      help={p.help}
      problem={problem}
      alert={p.problem !== undefined}
      after={sign}
    >
      <input
        className="smg-input"
        type="number"
        // The off value lies below the bounds (0 under 20): the browser must let it through.
        min={p.off === undefined ? p.min : Math.min(p.min, p.off)}
        max={p.max}
        step={p.step ?? 1}
        value={text}
        aria-invalid={problem !== undefined}
        data-testid={p.testId}
        onChange={(e) => {
          edit(e.target.value);
        }}
        onBlur={settle}
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
    <Labelled label={p.label} help={p.help} problem={p.problem}>
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
    <Labelled label={p.label} help={p.help} problem={p.problem}>
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
