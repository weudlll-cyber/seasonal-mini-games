/**
 * @file   packages/application/src/index.ts
 * @module application
 * @brief  Public entry point of @smg/application: use cases and ports.
 *
 * Responsibility: the settings service and its store port, the audit port; a round's
 *                 settings, its session (seed, secrets, commands, recovery) and the check of
 *                 its fairness proof.
 * Depends on:     ./settings/*, ./audit/ports, ./round/*
 * Used by:        apps/server
 * Spec:           docs/spec/04-software-architecture.md §3
 */
export { SettingsError, SettingsService } from './settings/settingsService.js';
export type { NewVersion, SettingsStore, StoredDocument } from './settings/ports.js';
export type { AuditActor, AuditEntry, AuditLog } from './audit/ports.js';
export {
  chooseRoundSettings,
  gameSettingsDefs,
  RoundSettingsError,
  type RoundSettings,
} from './round/roundSettings.js';
export { RoundSession, type NewSession } from './round/roundSession.js';
export { verifyRound, type Verified } from './round/verify.js';
