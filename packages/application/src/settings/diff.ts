/**
 * @file   packages/application/src/settings/diff.ts
 * @module application/settings
 * @brief  What changed between two override maps of a settings document.
 *
 * Responsibility: every key whose stored override differs (added, changed or removed), with
 *                 its override before and after (null when absent), in key order. One rule for
 *                 the audit entry of a save and for the version history of the admin app.
 * Depends on:     @smg/game-sdk (types)
 * Used by:        ./settingsService, ../index, apps/server (settings versions)
 * Spec:           docs/spec/08-admin-settings.md §1; Bingo 11 §1
 */
import type { SettingOverride } from '@smg/game-sdk';

export interface OverrideChange {
  readonly key: string;
  readonly before: SettingOverride | null;
  readonly after: SettingOverride | null;
}

export function overrideChanges(
  before: Readonly<Record<string, SettingOverride>>,
  after: Readonly<Record<string, SettingOverride>>,
): OverrideChange[] {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const changes: OverrideChange[] = [];
  for (const key of keys) {
    const b = before[key] ?? null;
    const a = after[key] ?? null;
    if (JSON.stringify(b) !== JSON.stringify(a)) changes.push({ key, before: b, after: a });
  }
  return changes;
}
