/**
 * @file   packages/application/src/index.ts
 * @module application
 * @brief  Public entry point of @smg/application: use cases and ports.
 *
 * Responsibility: the settings service and its store port, the audit port; the round
 *                 engine joins with the Guess The Number work (04 §5).
 * Depends on:     ./settings/*, ./audit/ports
 * Used by:        apps/server
 * Spec:           docs/spec/04-software-architecture.md §3
 */
export { SettingsError, SettingsService } from './settings/settingsService.js';
export type { NewVersion, SettingsStore, StoredDocument } from './settings/ports.js';
export type { AuditActor, AuditEntry, AuditLog } from './audit/ports.js';
