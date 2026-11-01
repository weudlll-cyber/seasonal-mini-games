/**
 * @file   apps/server/src/config/features.ts
 * @module server/config
 * @brief  Feature flags of the first draft (03 §2.1, §2.3).
 *
 * Responsibility: the flags the server reads at start: e-mail verification, 2FA and the
 *                 outbound webhooks (07 §1) are off by default (with verification on,
 *                 unverified accounts cannot sign in), guests are on. Read from the
 *                 environment until the `features` settings document is editable (WP-20).
 * Depends on:     ./env
 * Used by:        ../http/app, ../http/routes/auth, ../http/routes/adminWebhooks
 * Spec:           Bingo 03 §2.1, §2.3; Bingo 07 §5; Bingo 11 §3.10
 */
import type { Env } from './env.js';

export interface Features {
  readonly emailVerification: boolean;
  readonly twoFactor: boolean;
  readonly guests: boolean;
  readonly webhooks: boolean;
}

export function featuresFrom(env: Env): Features {
  return {
    emailVerification: env.SMG_FEATURE_EMAIL_VERIFICATION,
    twoFactor: env.SMG_FEATURE_TWO_FACTOR,
    guests: env.SMG_FEATURE_GUESTS,
    webhooks: env.SMG_FEATURE_WEBHOOKS,
  };
}
