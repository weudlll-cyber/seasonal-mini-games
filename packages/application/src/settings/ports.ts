/**
 * @file   packages/application/src/settings/ports.ts
 * @module application/settings
 * @brief  Port of the settings store: load the current version, save the next one.
 *
 * Responsibility: the interface the settings service needs; the Postgres adapter lives in
 *                 apps/server (smg.settings_documents / smg.settings_versions). `save` writes
 *                 only when the stored version is still the expected one (optimistic lock).
 * Depends on:     @smg/game-sdk (types)
 * Used by:        ./settingsService, ../index, apps/server (pgSettingsStore), ./fakes
 * Spec:           docs/spec/08-admin-settings.md §1; Bingo 04 §3.2
 */
import type { SettingOverride } from '@smg/game-sdk';

export interface StoredDocument {
  readonly version: number;
  readonly overrides: Readonly<Record<string, SettingOverride>>;
  readonly updatedAt: string | null;
}

export interface NewVersion {
  readonly expectedVersion: number;
  readonly overrides: Readonly<Record<string, SettingOverride>>;
  readonly comment: string | null;
  readonly actorAccountId: string | null;
}

export interface SettingsStore {
  // null when the document has never been saved (version 1 with no overrides).
  load(id: string): Promise<StoredDocument | null>;
  // false when another writer saved first.
  save(id: string, next: NewVersion): Promise<boolean>;
}
