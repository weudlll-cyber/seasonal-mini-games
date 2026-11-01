/**
 * @file   apps/server/src/admin/settingsVersions.ts
 * @module server/admin
 * @brief  The version history of a settings document and the overrides of one version.
 *
 * Responsibility: every stored version of a document (smg.settings_versions), newest first,
 *                 with who saved it, the comment and what it changed against the version
 *                 before (the first stored one against version 1, the definitions' defaults);
 *                 the overrides of a version for a rollback (version 1: none). History is
 *                 never rewritten: a rollback saves a new version (../http/routes/adminSettings).
 * Depends on:     @smg/application (overrideChanges), @smg/contracts, @smg/game-sdk, ../db/pool
 * Used by:        ../http/routes/adminSettings
 * Spec:           docs/spec/08-admin-settings.md §1; Bingo 11 §1; Bingo 05 §3
 */
import { overrideChanges } from '@smg/application';
import type { SettingsUpdate, SettingsVersionView } from '@smg/contracts';
import type { SettingOverride } from '@smg/game-sdk';

import type { DbPool } from '../db/pool.js';

type Overrides = Record<string, SettingOverride>;

export async function settingsVersions(pool: DbPool, id: string): Promise<SettingsVersionView[]> {
  const r = await pool.query<{
    version: number;
    created_at: Date;
    comment: string | null;
    document: Overrides;
    by: string | null;
  }>(
    `SELECT v.version, v.created_at, v.comment, v.document, a.display_name AS by
     FROM smg.settings_versions v LEFT JOIN smg.accounts a ON a.id = v.created_by
     WHERE v.document_id = $1 ORDER BY v.version`,
    [id],
  );
  let before: Overrides = {};
  const out: SettingsVersionView[] = [];
  for (const row of r.rows) {
    out.push({
      version: row.version,
      createdAt: row.created_at.toISOString(),
      by: row.by,
      comment: row.comment,
      changes: overrideChanges(before, row.document),
    });
    before = row.document;
  }
  return out.reverse();
}

// The overrides version `version` held; null when the document never had it.
export async function versionOverrides(
  pool: DbPool,
  id: string,
  version: number,
): Promise<SettingsUpdate['overrides'] | null> {
  if (version === 1) return {};
  // Stored as JSON: the shape an update takes.
  const r = await pool.query<{ document: SettingsUpdate['overrides'] }>(
    'SELECT document FROM smg.settings_versions WHERE document_id = $1 AND version = $2',
    [id, version],
  );
  return r.rows[0]?.document ?? null;
}
