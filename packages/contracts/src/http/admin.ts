/**
 * @file   packages/contracts/src/http/admin.ts
 * @module contracts/http
 * @brief  Wire shapes of the admin API: settings documents, audit log, accounts, abuse scores.
 *
 * Responsibility: zod schemas for every admin request body (the server validates with
 *                 them, unknown keys refused) and the types of the answers the admin app
 *                 renders. One source for both sides.
 * Depends on:     zod, @smg/game-sdk (setting types)
 * Used by:        ../index, apps/server (admin routes), apps/admin
 * Spec:           docs/spec/06-data-model-api-realtime.md §3.2; docs/spec/08-admin-settings.md §1
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
