/**
 * @file   packages/contracts/src/http/admin.ts
 * @module contracts/http
 * @brief  Wire shapes of the admin API: settings documents with their versions, audit log,
 *         accounts, abuse scores, live rounds with staff actions, and two-factor sign-in.
 *
 * Responsibility: zod schemas for every admin request body (the server validates with
 *                 them, unknown keys refused) and the types of the answers the admin app
 *                 renders. One source for both sides. A step-up (Bingo 11 §1) is a fresh TOTP
 *                 check of the session: `TwoFactorCodeBody` both enrols and steps up.
 * Depends on:     zod, @smg/game-sdk (setting types)
 * Used by:        ../index, apps/server (admin routes), apps/admin
 * Spec:           docs/spec/06-data-model-api-realtime.md §3.2; docs/spec/08-admin-settings.md §1;
 *                 Bingo 11 §1, §3, Bingo 05 §2.1, §3
 */
import type { SettingDef, SettingOverride, SettingValue } from '@smg/game-sdk';
import { z } from 'zod';

const settingValue = z.union([z.number(), z.boolean(), z.string().max(300), z.array(z.number())]);

export const SettingsUpdateBody = z
  .object({
    // Expected current version: a stale form is refused instead of overwriting (Bingo 05 §5
    // CONFIG_VERSION_CONFLICT).
    version: z.number().int().min(1),
    comment: z.string().trim().max(200).optional(),
    overrides: z.record(
      z.string().max(80),
      z
        .object({
          value: settingValue.optional(),
          min: z.number().optional(),
          max: z.number().optional(),
        })
        .strict(),
    ),
  })
  .strict();
export type SettingsUpdate = z.infer<typeof SettingsUpdateBody>;

export interface SettingsDocumentView {
  readonly id: string;
  readonly version: number;
  readonly updatedAt: string | null;
  readonly defs: readonly SettingDef[];
  readonly overrides: Readonly<Record<string, SettingOverride>>;
  readonly values: Readonly<Record<string, SettingValue>>;
  // Whether the viewer may edit each key (by its edit permission).
  readonly editable: readonly string[];
}

export interface AuditEntryView {
  readonly id: string;
  readonly occurredAt: string;
  readonly actor: string | null;
  readonly actorRoles: readonly string[];
  readonly action: string;
  readonly targetType: string;
  readonly targetId: string | null;
  readonly diff: unknown;
  // The hash chain link, hex: anyone can recompute it from the entries (05 §8).
  readonly hash: string;
}

export const AuditQuery = z
  .object({
    action: z.string().max(80).optional(),
    actor: z.string().max(40).optional(),
    before: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  })
  .strict();

export interface AccountView {
  readonly id: string;
  readonly displayName: string;
  readonly status: 'active' | 'suspended';
  readonly roles: readonly string[];
  readonly createdAt: string;
  readonly abuseScore: number;
}

export const AccountQuery = z.object({ query: z.string().trim().max(40).default('') }).strict();

export const ReasonBody = z.object({ reason: z.string().trim().min(3).max(200) }).strict();
export const RoleBody = z
  .object({ role: z.string().max(40), reason: z.string().trim().min(3).max(200) })
  .strict();

export interface AbuseRowView {
  readonly accountId: string;
  readonly displayName: string;
  readonly score: number;
  readonly lastKind: string;
  readonly lastAt: string;
  // The most recent signals, newest first (05 §2, §7).
  readonly recent: readonly {
    readonly kind: string;
    readonly at: string;
    readonly detail: string;
  }[];
}

// One version of a settings document and what it changed against the version before.
export interface SettingsVersionView {
  readonly version: number;
  readonly createdAt: string;
  readonly by: string | null;
  readonly comment: string | null;
  readonly changes: readonly {
    readonly key: string;
    readonly before: SettingOverride | null;
    readonly after: SettingOverride | null;
  }[];
}

// Rollback writes a new version with the overrides of `toVersion` (history is never rewritten).
export const SettingsRollbackBody = z
  .object({
    version: z.number().int().min(1),
    toVersion: z.number().int().min(1),
    comment: z.string().trim().min(3).max(200),
  })
  .strict();

// A running round as staff see it in the live list (06 §3.2): no secret, no seed.
export interface LiveRoundView {
  readonly roundId: string;
  readonly matchId: string;
  readonly matchCode: string;
  readonly matchTitle: string;
  readonly host: string | null;
  readonly status: 'created' | 'countdown' | 'open';
  readonly season: string;
  readonly secretMode: 'shared' | 'individual';
  readonly halving: boolean;
  readonly roster: number;
  readonly connected: number;
  readonly guesses: number;
  readonly opensAt: number | null;
  readonly endsAt: number | null;
}

export const KickBody = z
  .object({ playerKey: z.string().min(1).max(64), reason: z.string().trim().min(3).max(200) })
  .strict();

export interface TwoFactorStatusView {
  readonly enrolled: boolean;
  // A step-up is needed for the next admin write (none or older than 10 minutes).
  readonly stepUpNeeded: boolean;
  readonly lastCheckAt: string | null;
  readonly recoveryCodesLeft: number;
}

// Enrolment: the secret once, for the authenticator app (otpauth URI and base32 text).
export interface TwoFactorSetupView {
  readonly otpauthUri: string;
  readonly secret: string;
}

// A six-digit code of the authenticator app, or one recovery code.
export const TwoFactorCodeBody = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^(\d{6}|[a-z0-9]{4}-[a-z0-9]{4})$/),
  })
  .strict();
