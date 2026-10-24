/**
 * @file   packages/application/src/audit/ports.ts
 * @module application/audit
 * @brief  Port of the append-only audit log and the actor a use case acts for.
 *
 * Responsibility: every admin write appends one entry through this port; the Postgres
 *                 adapter (apps/server) adds time, request id and the hash-chain link.
 * Depends on:     nothing
 * Used by:        ../settings/settingsService, ../index, apps/server (pgAuditLog), ./fakes
 * Spec:           docs/spec/05-security-threat-model.md §8; Bingo 03 §16
 */

export interface AuditActor {
  readonly accountId: string | null;
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
  readonly requestId: string | null;
  readonly ip: string | null;
}

export interface AuditEntry {
  readonly action: string;
  readonly targetType: string;
  readonly targetId: string | null;
  readonly diff: unknown;
}

export interface AuditLog {
  append(actor: AuditActor, entry: AuditEntry): Promise<void>;
}
