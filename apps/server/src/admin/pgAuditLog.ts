/**
 * @file   apps/server/src/admin/pgAuditLog.ts
 * @module server/admin
 * @brief  The audit log in PostgreSQL: append with the hash chain, list with filters, verify.
 *
 * Responsibility: append one entry per admin write inside a transaction that takes an
 *                 advisory lock, so the chain has one order even with concurrent writers;
 *                 each entry stores the previous hash and its own (packages/domain hashChain).
 *                 IPs are kept as given (truncation after 30 days is backlog). List newest
 *                 first with optional action/actor filters and a cursor; verify the whole chain.
 * Depends on:     @smg/application (AuditLog port), @smg/domain (chainHash, brokenLink), ../db/pool
 * Used by:        ../http/app, ../http/routes/adminAudit
 * Spec:           docs/spec/05-security-threat-model.md §8; Bingo 03 §16, Bingo 04 §3.6
 */
import type { AuditActor, AuditEntry, AuditLog } from '@smg/application';
import type { AuditEntryView } from '@smg/contracts';
import { brokenLink, chainHash, type AuditRecord } from '@smg/domain';

import type { DbPool } from '../db/pool.js';

// pg_advisory_xact_lock key of the audit chain ("smg audit" as a number).
const CHAIN_LOCK = 0x736d6761;

interface AuditRow {
  id: string;
  occurred_at: Date;
  actor_account_id: string | null;
  actor_roles: string[];
  action: string;
  target_type: string;
  target_id: string | null;
  diff: unknown;
  request_id: string | null;
  prev_hash: Buffer | null;
  hash: Buffer;
}

function recordOf(row: AuditRow): AuditRecord {
  return {
    occurredAt: row.occurred_at.toISOString(),
    actorAccountId: row.actor_account_id,
    actorRoles: row.actor_roles,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    diff: row.diff,
    requestId: row.request_id,
  };
}

export class PgAuditLog implements AuditLog {
  constructor(private readonly pool: DbPool) {}

  async append(actor: AuditActor, entry: AuditEntry): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1)', [CHAIN_LOCK]);
      const last = await client.query<{ hash: Buffer }>(
        'SELECT hash FROM smg.audit_log ORDER BY id DESC LIMIT 1',
      );
      const prev = last.rows[0]?.hash ?? null;
      // Milliseconds only: what timestamptz returns must hash the same as what was hashed.
      const record: AuditRecord = {
        occurredAt: new Date().toISOString(),
        actorAccountId: actor.accountId,
        actorRoles: [...actor.roles],
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        diff: entry.diff ?? {},
        requestId: actor.requestId,
      };
      const hash = chainHash(prev === null ? null : new Uint8Array(prev), record);
      await client.query(
        `INSERT INTO smg.audit_log (occurred_at, actor_account_id, actor_roles, ip, action,
           target_type, target_id, diff, request_id, prev_hash, hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          record.occurredAt,
          record.actorAccountId,
          record.actorRoles,
          actor.ip,
          record.action,
          record.targetType,
          record.targetId,
          JSON.stringify(record.diff),
          record.requestId,
          prev,
          Buffer.from(hash),
        ],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async list(filter: {
    readonly action?: string | undefined;
    readonly actor?: string | undefined;
    readonly before?: number | undefined;
    readonly limit: number;
  }): Promise<AuditEntryView[]> {
    const r = await this.pool.query<AuditRow & { actor_name: string | null }>(
      `SELECT l.*, a.display_name AS actor_name FROM smg.audit_log l
       LEFT JOIN smg.accounts a ON a.id = l.actor_account_id
       WHERE ($1::text IS NULL OR l.action LIKE $1 || '%')
         AND ($2::text IS NULL OR a.display_name_key = $2)
         AND ($3::bigint IS NULL OR l.id < $3)
       ORDER BY l.id DESC LIMIT $4`,
      [filter.action ?? null, filter.actor ?? null, filter.before ?? null, filter.limit],
    );
    return r.rows.map((row) => ({
      id: row.id,
      occurredAt: row.occurred_at.toISOString(),
      actor: row.actor_name ?? row.actor_account_id,
      actorRoles: row.actor_roles,
      action: row.action,
      targetType: row.target_type,
      targetId: row.target_id,
      diff: row.diff,
      hash: row.hash.toString('hex'),
    }));
  }

  // Index of the first entry whose link is broken (-1 when the chain is intact).
  async verify(): Promise<number> {
    const r = await this.pool.query<AuditRow>('SELECT * FROM smg.audit_log ORDER BY id');
    return brokenLink(
      r.rows.map((row) => ({ record: recordOf(row), hash: new Uint8Array(row.hash) })),
    );
  }
}
