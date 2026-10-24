/**
 * @file   packages/game-sdk/src/settings.ts
 * @module game-sdk
 * @brief  Setting definitions (default, min, max, who, effect on running rounds) and their checks.
 *
 * Responsibility: one typed shape for every entry of the settings catalogue, used by the
 *                 platform's documents (packages/contracts) and by each game's own
 *                 settings; pure checks of a value against its definition and against the
 *                 narrowed bounds a game admin may set (never wider than the definition);
 *                 resolving a document's stored overrides into effective values.
 * Depends on:     nothing
 * Used by:        ./index, packages/contracts, games/*, apps/server (settings routes), apps/admin
 * Spec:           docs/spec/08-admin-settings.md §1–§3
 */

// owner = decided by the owner (with its decision number), proposal = listed in OPEN.md.
export type SettingStatus = 'owner' | 'proposal' | 'technical' | 'adopted';
export type RunningEffect = 'frozen' | 'immediate' | 'next';
export type SettingValue = number | boolean | string | readonly number[];

interface BaseDef {
  readonly key: string;
  readonly label: string;
  readonly help: string;
  readonly status: SettingStatus;
  // e.g. "O15" for an owner decision; absent for technical settings.
  readonly decision?: string;
  // The permission that may change the default (08 §2 "Who").
  readonly editPermission: string;
  // The host picks the value per round, inside the bounds (08 §2).
  readonly hostChooses: boolean;
  readonly running: RunningEffect;
  readonly spec: string;
}

export interface IntDef extends BaseDef {
  readonly kind: 'int';
  readonly default: number;
  readonly min: number;
  readonly max: number;
  readonly unit: string;
}

// A number with a step, e.g. 0.5 s for the winning-margin window.
export interface NumberDef extends BaseDef {
  readonly kind: 'number';
  readonly default: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly unit: string;
}

export interface BoolDef extends BaseDef {
  readonly kind: 'bool';
  readonly default: boolean;
}

export interface EnumDef extends BaseDef {
  readonly kind: 'enum';
  readonly default: string;
  readonly options: readonly string[];
}

export interface IntListDef extends BaseDef {
  readonly kind: 'intList';
  readonly default: readonly number[];
  readonly min: number;
  readonly max: number;
  readonly maxItems: number;
}

export interface TextDef extends BaseDef {
  readonly kind: 'text';
  readonly default: string;
  readonly maxLength: number;
  // A regular expression the value must match when it is not empty.
  readonly pattern: string;
}

export type SettingDef = IntDef | NumberDef | BoolDef | EnumDef | IntListDef | TextDef;

// What a document stores per key: a new default and, for numbers, narrowed bounds.
export interface SettingOverride {
  readonly value?: SettingValue | undefined;
  readonly min?: number | undefined;
  readonly max?: number | undefined;
}

export interface Bounds {
  readonly min: number;
  readonly max: number;
}

// The bounds in force: the definition's, narrowed by the override, never widened.
export function effectiveBounds(def: IntDef | NumberDef | IntListDef, o?: SettingOverride): Bounds {
  const min = Math.max(def.min, o?.min ?? def.min);
  const max = Math.min(def.max, o?.max ?? def.max);
  return { min, max };
}

function numberProblem(def: IntDef | NumberDef, value: unknown, b: Bounds): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'must be a number';
  if (def.kind === 'int' && !Number.isInteger(value)) return 'must be a whole number';
  const steps = value / (def.kind === 'number' ? def.step : 1);
  if (def.kind === 'number' && Math.abs(steps - Math.round(steps)) > 1e-9) {
    return `must be a multiple of ${String(def.step)}`;
  }
  if (value < b.min || value > b.max) {
    return `must be between ${String(b.min)} and ${String(b.max)}`;
  }
  return null;
}

function listProblem(def: IntListDef, value: unknown, b: Bounds): string | null {
  if (!Array.isArray(value)) return 'must be a list of whole numbers';
  if (value.length > def.maxItems) return `may have at most ${String(def.maxItems)} entries`;
  const bad = value.some(
    (v) => typeof v !== 'number' || !Number.isInteger(v) || v < b.min || v > b.max,
  );
  return bad ? `entries must be whole numbers between ${String(b.min)} and ${String(b.max)}` : null;
}

// Why a value is not allowed for a definition (null when it is).
export function settingProblem(
  def: SettingDef,
  value: unknown,
  o?: SettingOverride,
): string | null {
  switch (def.kind) {
    case 'int':
    case 'number':
      return numberProblem(def, value, effectiveBounds(def, o));
    case 'intList':
      return listProblem(def, value, effectiveBounds(def, o));
    case 'bool':
      return typeof value === 'boolean' ? null : 'must be on or off';
    case 'enum':
      return enumProblem(def, value);
    case 'text':
      return textProblem(def, value);
  }
}

function enumProblem(def: EnumDef, value: unknown): string | null {
  return typeof value === 'string' && def.options.includes(value)
    ? null
    : `must be one of ${def.options.join(', ')}`;
}

function textProblem(def: TextDef, value: unknown): string | null {
  if (typeof value !== 'string' || value.length > def.maxLength) return 'text too long';
  return value === '' || new RegExp(def.pattern).test(value) ? null : 'has the wrong form';
}

// Why a narrowed range is not allowed (null when it is): inside the definition, min ≤ max.
export function boundsProblem(def: SettingDef, o: SettingOverride): string | null {
  if (o.min === undefined && o.max === undefined) return null;
  if (def.kind !== 'int' && def.kind !== 'number' && def.kind !== 'intList') {
    return 'only numbers have bounds';
  }
  const b = effectiveBounds(def, o);
  if ((o.min ?? def.min) < def.min || (o.max ?? def.max) > def.max) return 'bounds may only narrow';
  return b.min > b.max ? 'min must not exceed max' : null;
}

// Effective values of a document: each stored default that still fits, else the definition's.
export function resolveSettings(
  defs: readonly SettingDef[],
  overrides: Readonly<Record<string, SettingOverride>>,
): Record<string, SettingValue> {
  const values: Record<string, SettingValue> = {};
  for (const def of defs) {
    const o = overrides[def.key];
    const stored = o?.value;
    values[def.key] =
      stored !== undefined && settingProblem(def, stored, o) === null ? stored : def.default;
  }
  return values;
}
