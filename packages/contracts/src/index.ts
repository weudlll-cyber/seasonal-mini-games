/**
 * @file   packages/contracts/src/index.ts
 * @module contracts
 * @brief  Public entry point of @smg/contracts: every platform shape shared across the wire.
 *
 * Responsibility: the platform settings catalogue (08), the admin API shapes, and the match,
 *                 round, frame, Quick Test and season shapes the player client reads, and the
 *                 boards (match standings, leaderboards, profiles), the chat, and the integration
 *                 shapes (handoff, embed allowlist, webhooks, public read API) (06, 07).
 * Depends on:     ./settings/platform, ./http/admin, ./http/boards, ./http/chat,
 *                 ./http/integration, ./http/play
 * Used by:        apps/server, apps/web, apps/admin, packages/application
 * Spec:           docs/spec/04-software-architecture.md §3; docs/spec/06-data-model-api-realtime.md
 */
export { PLATFORM_SETTINGS } from './settings/platform.js';
export {
  AccountQuery,
  AuditQuery,
  KickBody,
  ReasonBody,
  RoleBody,
  SettingsRollbackBody,
  SettingsUpdateBody,
  TwoFactorCodeBody,
  type AbuseRowView,
  type AccountView,
  type AuditEntryView,
  type LiveRoundView,
  type SettingsDocumentView,
  type SettingsUpdate,
  type SettingsVersionView,
  type TwoFactorSetupView,
  type TwoFactorStatusView,
} from './http/admin.js';
export {
  ChatReportBody,
  ChatResolveBody,
  ChatRoomPatchBody,
  ChatSanctionBody,
  ChatSendBody,
  WordListBody,
  type ChatConfigView,
  type ChatEventView,
  type ChatMessageView,
  type ChatProvider,
  type ChatReportView,
  type ChatRoomView,
  type ChatSanctionView,
} from './http/chat.js';
export {
  EmbedOriginBody,
  HandoffBody,
  IdentityProviderBody,
  WEBHOOK_EVENTS,
  WebhookEndpointBody,
  type EmbedConfigView,
  type EmbedOriginView,
  type IdentityProviderView,
  type PublicCurrentRoundView,
  type PublicLeaderboardView,
  type PublicMatchView,
  type PublicRoundResultView,
  type WebhookDeliveryView,
  type WebhookEndpointCreated,
  type WebhookEndpointView,
  type WebhookEvent,
  type WebhookPayload,
} from './http/integration.js';
export {
  AdjustmentBody,
  type Adjustment,
  type LeaderboardPageView,
  type LeaderboardPeriodView,
  type LeaderboardRowView,
  type MatchStandingView,
  type PlayerProfileView,
  type TeamLeagueRowView,
} from './http/boards.js';
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
