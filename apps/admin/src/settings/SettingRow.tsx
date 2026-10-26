/**
 * @file   apps/admin/src/settings/SettingRow.tsx
 * @module admin/settings
 * @brief  One setting: what it is, its default, value and bounds, who and when; and its editor.
 *
 * Responsibility: the columns of 08 §3–§6 for one key: label, key and help; the catalogue's
 *                 default; the value in force; the bounds in force (narrowed by the document,
 *                 never wider than the catalogue, 08 §1); who may change it; when a change
 *                 applies; where it comes from. A key the viewer may edit gets inputs for its
 *                 value and, for numbers, its narrowed bounds; a cleared field means "as the
 *                 catalogue". The server checks everything again.
 * Depends on:     react, @smg/game-sdk (definitions, bounds), ./settingText
 * Used by:        ./SettingsPage
 * Spec:           docs/spec/08-admin-settings.md §1–§6
 */
import {
  effectiveBounds,
  type SettingDef,
  type SettingOverride,
  type SettingValue,
} from '@smg/game-sdk';
import type { ReactElement } from 'react';

import { runningText, statusText, valueText, whoText } from './settingText.js';

interface SettingRowProps {
  readonly def: SettingDef;
  readonly value: SettingValue | undefined;
  readonly override: SettingOverride;
  readonly editable: boolean;
  readonly change: (next: SettingOverride) => void;
}

type NumericDef = Extract<SettingDef, { kind: 'int' | 'number' | 'intList' }>;
const numeric = (d: SettingDef): d is NumericDef =>
  d.kind === 'int' || d.kind === 'number' || d.kind === 'intList';

// The text of an input back to a stored value of the definition's kind; '' = not set.
function parse(def: SettingDef, text: string): SettingValue | undefined {
  if (text.trim() === '') return undefined;
  if (def.kind === 'bool') return text === 'on';
  if (def.kind === 'int' || def.kind === 'number') return Number(text);
  if (def.kind === 'intList') return text.split(',').map((t) => Number(t.trim()));
  return text;
}

function shown(v: SettingValue | undefined): string {
  if (v === undefined) return '';
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'boolean') return v ? 'on' : 'off';
  return String(v);
}

type EditorProps = Pick<SettingRowProps, 'def' | 'override' | 'change'>;

function ValueEditor({ def, override, change }: EditorProps): ReactElement {
  const set = (text: string) => {
    change({ ...override, value: parse(def, text) });
  };
  const label = `${def.label}: default`;
  if (def.kind === 'enum' || def.kind === 'bool') {
    const options = def.kind === 'bool' ? ['on', 'off'] : def.options;
    return (
      <select
        className="smg-select"
        aria-label={label}
        value={shown(override.value)}
        onChange={(e) => {
          set(e.target.value);
        }}
      >
        <option value="">as catalogue</option>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    );
  }
  return (
    <input
      className="smg-input"
      aria-label={label}
      placeholder="as catalogue"
      defaultValue={shown(override.value)}
      onBlur={(e) => {
        set(e.target.value);
      }}
    />
  );
}

function BoundEditor({
  def,
  override,
  change,
  side,
}: EditorProps & { readonly def: NumericDef; readonly side: 'min' | 'max' }): ReactElement {
  const word = side === 'min' ? 'lowest' : 'highest';
  return (
    <input
      className="smg-input"
      type="number"
      aria-label={`${def.label}: ${word} allowed`}
      placeholder={`${side} ${String(def[side])}`}
      defaultValue={override[side] ?? ''}
      onBlur={(e) => {
        change({
          ...override,
          [side]: e.target.value.trim() === '' ? undefined : Number(e.target.value),
        });
      }}
    />
  );
}

function Editor(p: EditorProps): ReactElement {
  return (
    <div className="admin-editor">
      <ValueEditor {...p} />
      {numeric(p.def) ? (
        <>
          <BoundEditor {...p} def={p.def} side="min" />
          <BoundEditor {...p} def={p.def} side="max" />
        </>
      ) : null}
    </div>
  );
}

export function SettingRow({
  def,
  value,
  override,
  editable,
  change,
}: SettingRowProps): ReactElement {
  const b = numeric(def) ? effectiveBounds(def, override) : null;
  return (
    <tr data-testid={`setting-${def.key}`}>
      <td>
        <strong>{def.label}</strong>
        <br />
        <code>{def.key}</code>
        <br />
        <small className="smg-muted">{def.help}</small>
      </td>
      <td>{valueText(def.default, def)}</td>
      <td>{valueText(value, def)}</td>
      <td>{b === null ? '—' : String(b.min)}</td>
      <td>{b === null ? '—' : String(b.max)}</td>
      <td>{whoText(def)}</td>
      <td>{runningText(def)}</td>
      <td>{statusText(def)}</td>
      <td>
        {editable ? (
          <Editor def={def} override={override} change={change} />
        ) : (
          <span className="smg-muted">view only</span>
        )}
      </td>
    </tr>
  );
}
