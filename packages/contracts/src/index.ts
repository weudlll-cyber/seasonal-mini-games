/**
 * @file   packages/contracts/src/index.ts
 * @module contracts
 * @brief  Public entry point of @smg/contracts: every platform shape shared across the wire.
 *
 * Responsibility: the platform settings catalogue (08) and the admin API shapes; the round,
 *                 match and realtime shapes join with the server work (06).
 * Depends on:     ./settings/platform, ./http/admin
 * Used by:        apps/server, apps/web, apps/admin, packages/application
 * Spec:           docs/spec/04-software-architecture.md §3; docs/spec/06-data-model-api-realtime.md
 */
export { PLATFORM_SETTINGS } from './settings/platform.js';
export {
  AccountQuery,
  AuditQuery,
  ReasonBody,
  RoleBody,
  SettingsUpdateBody,
  type AbuseRowView,
  type AccountView,
  type AuditEntryView,
  type SettingsDocumentView,
  type SettingsUpdate,
} from './http/admin.js';
