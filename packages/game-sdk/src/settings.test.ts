/**
 * @file   packages/game-sdk/src/settings.test.ts
 * @module game-sdk
 * @brief  Setting checks: types, bounds, narrowing that never widens, resolving overrides.
 *
 * Responsibility: each kind accepts its values and refuses the rest with a sentence;
 *                 narrowed bounds apply and cannot widen; an int's off value passes outside
 *                 its bounds (O71); a stored value that no longer
 *                 fits falls back to the definition's default.
 * Depends on:     vitest, ./settings
 * Spec:           docs/spec/08-admin-settings.md §2
 */
import { describe, expect, it } from 'vitest';

import {
  boundsProblem,
  resolveSettings,
  settingIssue,
  settingProblem,
  type IntDef,
  type NumberDef,
  type SettingDef,
} from './settings.js';

const base = {
  label: 'x',
  help: 'x',
  status: 'technical',
  editPermission: 'settings.game.edit',
  hostChooses: false,
  running: 'frozen',
  spec: '08 §3',
} as const;
const cooldown: IntDef = {
  ...base,
  key: 'c',
  kind: 'int',
  default: 10,
  min: 3,
  max: 60,
  unit: 's',
};
const margin: NumberDef = {
  ...base,
  key: 'm',
  kind: 'number',
  default: 2,
  min: 0.5,
  max: 10,
  step: 0.5,
  unit: 's',
};
const defs: SettingDef[] = [
  cooldown,
  margin,
  { ...base, key: 'b', kind: 'bool', default: true },
  { ...base, key: 'e', kind: 'enum', default: 'own', options: ['own', 'full'] },
  { ...base, key: 'l', kind: 'intList', default: [10, 7], min: 0, max: 100, maxItems: 3 },
  { ...base, key: 't', kind: 'text', default: '', maxLength: 20, pattern: '^https://' },
];

describe('settingProblem', () => {
  it('accepts values of the right kind inside the bounds', () => {
    const ok: unknown[] = [3, 2.5, false, 'full', [1, 2, 3], 'https://x'];
    defs.forEach((d, i) => {
      expect(settingProblem(d, ok[i])).toBeNull();
    });
  });

  it('refuses wrong kinds, out-of-range values and off-step numbers', () => {
    const bad: unknown[] = [61, 2.3, 'yes', 'some', [1, 2, 3, 4], 'http://x'];
    defs.forEach((d, i) => {
      expect(settingProblem(d, bad[i])).not.toBeNull();
    });
    expect(settingProblem(cooldown, 3.5)).toBe('must be a whole number');
  });

  it('applies narrowed bounds', () => {
    expect(settingProblem(cooldown, 4, { min: 5 })).toBe('must be between 5 and 60');
  });

  it('takes the off value outside the bounds, and names it when refusing (O71)', () => {
    const limit: IntDef = { ...cooldown, min: 20, max: 600, off: 0 };
    expect(settingProblem(limit, 0)).toBeNull();
    expect(settingProblem(limit, 0, { min: 30 })).toBeNull();
    expect(settingProblem(limit, 5)).toBe('must be between 20 and 600, or 0 for off');
    expect(settingProblem(limit, 601)).not.toBeNull();
  });

  it("words a field's issue as a sentence with the setting's key (O74)", () => {
    const limit: IntDef = { ...cooldown, key: 'round.inactivityLimitS', min: 20, max: 600, off: 0 };
    expect(settingIssue(limit, 5)).toEqual({
      key: 'round.inactivityLimitS',
      message: 'Must be between 20 and 600, or 0 for off.',
    });
    expect(settingIssue(limit, 0)).toBeNull();
    expect(settingIssue(cooldown, 4, { min: 5 })?.message).toBe('Must be between 5 and 60.');
  });
});

describe('boundsProblem', () => {
  it('lets bounds narrow but never widen or cross', () => {
    expect(boundsProblem(cooldown, { min: 5, max: 30 })).toBeNull();
    expect(boundsProblem(cooldown, { min: 2 })).toBe('bounds may only narrow');
    expect(boundsProblem(cooldown, { min: 40, max: 30 })).toBe('min must not exceed max');
    expect(boundsProblem(defs[2] as SettingDef, { min: 1 })).toBe('only numbers have bounds');
  });
});

describe('resolveSettings', () => {
  it('uses stored values that fit and the defaults otherwise', () => {
    const values = resolveSettings(defs, { c: { value: 20 }, m: { value: 99 } });
    expect(values['c']).toBe(20);
    expect(values['m']).toBe(2);
    expect(values['e']).toBe('own');
  });
});
