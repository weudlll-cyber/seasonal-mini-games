/**
 * @file   packages/contracts/src/index.ts
 * @module contracts
 * @brief  Public entry point of @smg/contracts: every platform shape shared across the wire.
 *
 * Responsibility: the platform settings catalogue (08), the admin API shapes, and the match,
 *                 round, frame, Quick Test and season shapes the player client reads (06).
 * Depends on:     ./settings/platform, ./http/admin, ./http/play
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
export type {
  FrameEventView,
  GameInfoView,
  MatchDetailsView,
  MatchSummaryView,
  PlayerResultView,
  QuickTestStartedView,
  RosterRowView,
  RoundFrameView,
  RoundStateView,
  SeasonName,
  SeasonsCurrentView,
  TeamName,
} from './http/play.js';
