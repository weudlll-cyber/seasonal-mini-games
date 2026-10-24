/**
 * @file   apps/server/src/admin/pgSettingsStore.ts
 * @module server/admin
 * @brief  Settings documents in PostgreSQL: the current version and its overrides; save the next.
 *
 * Responsibility: implement the SettingsStore port on smg.settings_documents and
 *                 smg.settings_versions (Bingo 04 §3.2). Every save is a new version row;
 *                 the document row moves on only when its version is still the expected
 *                 one, so a concurrent save makes the other fail (optimistic lock). Reads are
 *                 cached for one second so hot paths (round creation) do not hit the
 *                 database each time; a save clears the cache.
 * Depends on:     @smg/application (port), @smg/game-sdk (types), ../db/pool
 * Used by:        ../http/app
 * Spec:           docs/spec/08-admin-settings.md §1; Bingo 02 §6
 */
import type { NewVersion, SettingsStore, StoredDocument } from '@smg/application';
import type { SettingOverride } from '@smg/game-sdk';

import type { DbPool } from '../db/pool.js';

const CACHE_MS = 1_000;

export class PgSettingsStore implements SettingsStore {
  private readonly cache = new Map<string, { at: number; doc: StoredDocument | null }>();

  constructor(
    private readonly pool: DbPool,
    private readonly now: () => number = Date.now,
  ) {}

  async load(id: string): Promise<StoredDocument | null> {
    const hit = this.cache.get(id);
    if (hit !== undefined && this.now() - hit.at < CACHE_MS) return hit.doc;
    const r = await this.pool.query<{
      current_version: number;
      updated_at: Date;
      document: Record<string, SettingOverride>;
    }>(
      `SELECT d.current_version, d.updated_at, v.document FROM smg.settings_documents d
       JOIN smg.settings_versions v ON v.document_id = d.id AND v.version = d.current_version
       WHERE d.id = $1`,
      [id],
    );
    const row = r.rows[0];
    const doc =
      row === undefined
        ? null
        : {
            version: row.current_version,
            overrides: row.document,
            updatedAt: row.updated_at.toISOString(),
          };
    this.cache.set(id, { at: this.now(), doc });
    return doc;
  }

  async save(id: string, next: NewVersion): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Version 1 is "never saved": the first save creates the document row.
      await client.query(
        'INSERT INTO smg.settings_documents (id, current_version) VALUES ($1, 1) ON CONFLICT DO NOTHING',
        [id],
      );
      const moved = await client.query(
        `UPDATE smg.settings_documents SET current_version = current_version + 1, updated_at = now()
         WHERE id = $1 AND current_version = $2`,
        [id, next.expectedVersion],
      );
      if (moved.rowCount !== 1) {
        await client.query('ROLLBACK');
        return false;
      }
      await client.query(
        `INSERT INTO smg.settings_versions (document_id, version, document, created_by, comment)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          id,
          next.expectedVersion + 1,
          JSON.stringify(next.overrides),
          next.actorAccountId,
          next.comment,
        ],
      );
      await client.query('COMMIT');
      this.cache.delete(id);
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
