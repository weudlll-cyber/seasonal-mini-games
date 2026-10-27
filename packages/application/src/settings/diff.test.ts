/**
 * @file   packages/application/src/settings/diff.test.ts
 * @module application/settings
 * @brief  The diff of two override maps: added, changed and removed keys, unchanged ones left out.
 *
 * Responsibility: a key only in the later map is added (before null), only in the earlier one
 *                 removed (after null), in both with another override changed; equal overrides
 *                 are not listed; the keys come in order.
 * Depends on:     vitest, ./diff
 * Spec:           docs/spec/08-admin-settings.md §1
 */
import { describe, expect, it } from 'vitest';

import { overrideChanges } from './diff.js';

describe('overrideChanges', () => {
  it('lists added, changed and removed keys in order, and leaves equal ones out', () => {
    const before = { b: { value: 1 }, c: { min: 2, max: 9 }, same: { value: true } };
    const after = { a: { value: 'x' }, b: { value: 2 }, same: { value: true } };
    expect(overrideChanges(before, after)).toEqual([
      { key: 'a', before: null, after: { value: 'x' } },
      { key: 'b', before: { value: 1 }, after: { value: 2 } },
      { key: 'c', before: { min: 2, max: 9 }, after: null },
    ]);
  });

  it('is empty for equal maps', () => {
    expect(overrideChanges({ a: { value: [1, 2] } }, { a: { value: [1, 2] } })).toEqual([]);
    expect(overrideChanges({}, {})).toEqual([]);
  });
});
