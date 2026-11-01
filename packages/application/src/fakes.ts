/**
 * @file   packages/application/src/fakes.ts
 * @module application
 * @brief  In-memory adapters of the application ports, for unit tests.
 *
 * Responsibility: a settings store with the same optimistic version check as the Postgres
 *                 one and an audit log that keeps its entries in a list.
 * Depends on:     ./settings/ports, ./audit/ports
 * Used by:        ./settings/settingsService.test
 * Spec:           docs/spec/09-testing-strategy.md §2
 */
import type { AuditActor, AuditEntry, AuditLog } from './audit/ports.js';
import type { NewVersion, SettingsStore, StoredDocument } from './settings/ports.js';

export class MemorySettingsStore implements SettingsStore {
  readonly docs = new Map<string, StoredDocument>();

  load(id: string): Promise<StoredDocument | null> {
    return Promise.resolve(this.docs.get(id) ?? null);
  }

  save(id: string, next: NewVersion): Promise<boolean> {
    const current = this.docs.get(id)?.version ?? 1;
    if (current !== next.expectedVersion) return Promise.resolve(false);
    this.docs.set(id, { version: current + 1, overrides: next.overrides, updatedAt: 'now' });
    return Promise.resolve(true);
  }
}

export class MemoryAuditLog implements AuditLog {
  readonly entries: { actor: AuditActor; entry: AuditEntry }[] = [];

  append(actor: AuditActor, entry: AuditEntry): Promise<void> {
    this.entries.push({ actor, entry });
    return Promise.resolve();
  }
}
