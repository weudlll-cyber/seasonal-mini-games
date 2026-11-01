/**
 * @file   packages/domain/src/audit/hashChain.ts
 * @module domain/audit
 * @brief  Hash chain of the audit log: h_n = sha256(h_{n-1} || canonical(entry)).
 *
 * Responsibility: a canonical JSON form (sorted keys, no whitespace) so the same entry
 *                 always hashes the same; the chain hash of one entry; a verifier that names
 *                 the first entry whose link is broken (tamper evidence, Bingo 03 §16).
 * Depends on:     node:crypto (SHA-256, pure in/out)
 * Used by:        ../index, packages/application (audit), apps/server (pgAuditLog)
 * Spec:           docs/spec/05-security-threat-model.md §8; Bingo 03 §16
 */
import { createHash } from 'node:crypto';

export interface AuditRecord {
  readonly occurredAt: string;
  readonly actorAccountId: string | null;
  readonly actorRoles: readonly string[];
  readonly action: string;
  readonly targetType: string;
  readonly targetId: string | null;
  readonly diff: unknown;
  readonly requestId: string | null;
}

// JSON with object keys sorted at every depth; arrays keep their order.
export function canonicalJson(value: unknown): string {
  // JSON has no undefined, function or symbol: they hash as null.
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
    return 'null';
  }
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

export function chainHash(previous: Uint8Array | null, record: AuditRecord): Uint8Array {
  const h = createHash('sha256');
  if (previous !== null) h.update(previous);
  h.update(canonicalJson(record));
  return new Uint8Array(h.digest());
}

export interface ChainLink {
  readonly record: AuditRecord;
  readonly hash: Uint8Array;
}

// Index of the first entry whose hash does not follow from its predecessor; -1 when intact.
export function brokenLink(links: readonly ChainLink[], before: Uint8Array | null = null): number {
  let previous = before;
  for (const [i, link] of links.entries()) {
    const expected = chainHash(previous, link.record);
    if (Buffer.compare(Buffer.from(expected), Buffer.from(link.hash)) !== 0) return i;
    previous = link.hash;
  }
  return -1;
}
