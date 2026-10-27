/**
 * @file   packages/contracts/src/http/integration.ts
 * @module contracts/http
 * @brief  Integration shapes: the JWT handoff, identity providers, the embed allowlist,
 *         webhooks, and the public read API for host widgets.
 *
 * Responsibility: the body of `POST /auth/handoff` (a host-signed token, ≤ 60 s, single use,
 *                 audience `seasonal-mini-games`, optional `links` claim, 07 §4); the admin's
 *                 views and bodies for identity providers, embed origins and webhook endpoints
 *                 (a webhook's secret is shown once, at creation); the webhook events of 07
 *                 §3.2 and their payload envelope; and the answers of the public read API
 *                 (07 §1: open matches, the current round of a match, the current season board
 *                 with the team board, a round's result), which carry display names only.
 * Depends on:     zod, ./boards, ./play (shapes reused)
 * Used by:        ../index, apps/server, apps/admin, apps/embed-loader (message names)
 * Spec:           docs/spec/07-integration.md §1, §3.2, §4; Bingo 07 §2.2, §3, §5, §7
 */
import { z } from 'zod';

import type { LeaderboardRowView, TeamLeagueRowView } from './boards.js';
import type { SeasonName } from './play.js';

export const HandoffBody = z.object({ token: z.string().min(20).max(4_096) }).strict();

export interface IdentityProviderView {
  readonly id: string;
  readonly name: string;
  readonly issuer: string;
  readonly audience: string;
  readonly allowedAlgs: readonly string[];
  readonly jwksUrl: string | null;
  readonly hasPinnedKey: boolean;
  readonly roleMapping: Readonly<Record<string, string>>;
  readonly enabled: boolean;
}

export const IdentityProviderBody = z
  .object({
    name: z.string().trim().min(1).max(80),
    issuer: z.url(),
    allowedAlgs: z.array(z.enum(['EdDSA', 'ES256', 'RS256'])).min(1),
    jwksUrl: z.url().startsWith('https://').nullable(),
    pinnedPublicKey: z.string().max(4_000).nullable(),
    // Host role → platform role; security_admin and super_admin are refused (Bingo 07 §2.1).
    roleMapping: z.record(z.string().max(40), z.enum(['player', 'organizer', 'moderator'])),
    enabled: z.boolean(),
  })
  .strict()
  .refine((p) => p.jwksUrl !== null || p.pinnedPublicKey !== null, 'a key or a JWKS address');

export interface EmbedOriginView {
  readonly origin: string;
  readonly label: string;
  readonly allowAuthHandoff: boolean;
  readonly createdAt: string;
}

export const EmbedOriginBody = z
  .object({
    origin: z.string().regex(/^https?:\/\/[^/\s]+$/),
    label: z.string().trim().min(1).max(80),
    allowAuthHandoff: z.boolean(),
  })
  .strict();

export const WEBHOOK_EVENTS = [
  'match.opened',
  'round.countdown',
  'round.ended',
  'match.closed',
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export interface WebhookEndpointView {
  readonly id: string;
  readonly url: string;
  readonly events: readonly WebhookEvent[];
  readonly enabled: boolean;
  readonly createdAt: string;
  readonly lastDelivery: {
    readonly status: 'pending' | 'delivered' | 'failed';
    readonly at: string;
    readonly error: string | null;
  } | null;
}

export const WebhookEndpointBody = z
  .object({
    url: z.url().startsWith('https://'),
    events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
    enabled: z.boolean(),
  })
  .strict();

// The body of every webhook POST; signed with HMAC-SHA256 over `${timestamp}.${body}`.
export interface WebhookPayload {
  readonly id: string;
  readonly event: WebhookEvent;
  readonly at: number;
  readonly data: Readonly<Record<string, unknown>>;
}

export interface PublicMatchView {
  readonly code: string;
  readonly title: string;
  readonly players: number;
  readonly round: { readonly status: string; readonly season: SeasonName } | null;
}

export interface PublicCurrentRoundView {
  readonly matchCode: string;
  readonly roundId: string;
  readonly status: string;
  readonly season: SeasonName;
  readonly secretMode: 'shared' | 'individual';
  readonly halving: boolean;
  readonly opensAt: number | null;
  readonly endsAt: number | null;
  readonly players: number;
}

export interface PublicLeaderboardView {
  readonly periodName: string;
  readonly rows: readonly Omit<LeaderboardRowView, 'you'>[];
  readonly teams: readonly TeamLeagueRowView[];
}

export interface PublicRoundResultView {
  readonly roundId: string;
  readonly matchCode: string;
  readonly endReason: string | null;
  readonly winner: string | null;
  readonly placings: readonly {
    readonly place: number;
    readonly name: string;
    readonly points: number;
  }[];
}
