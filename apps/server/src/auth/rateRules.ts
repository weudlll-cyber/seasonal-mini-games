/**
 * @file   apps/server/src/auth/rateRules.ts
 * @module server/auth
 * @brief  The game's own rate rules, one per route class (03 §13, layer 2).
 *
 * Responsibility: each rule is `limit` requests refilled evenly over `windowMs`, per key (IP,
 *                 account or both). The limiter that applies them is the kit's `RateLimiter`
 *                 (`@seasonal/kit/server`, T423): lockout is soft there, callers get a delay,
 *                 never a lock. The rules stay here because they are this game's.
 * Depends on:     @seasonal/kit/server (RateRule, type)
 * Used by:        ./sessionPlugin, ../http/app, ../http/routes/auth, ../http/routes/twoFactor,
 *                 ../http/routes/handoff, ../http/routes/websiteSignIn
 * Spec:           Bingo 03 §13
 */
import type { RateRule } from '@seasonal/kit/server';

// Defaults of 03 §13. Settings in admin (WP-20) replace these values later.
export const RATE_RULES = {
  loginAccountIp: { limit: 5, windowMs: 15 * 60_000 },
  loginIp: { limit: 20, windowMs: 15 * 60_000 },
  register: { limit: 5, windowMs: 60 * 60_000 },
  api: { limit: 120, windowMs: 60_000 },
  // Per IP: API requests without a session (10 a second, under the proxy layer's 30, 03 §13),
  // and new guest sessions (audit S3).
  anonymous: { limit: 600, windowMs: 60_000 },
  guest: { limit: 10, windowMs: 60 * 60_000 },
  // Per IP: handoff tokens redeemed (a host signs one per sign-in).
  handoff: { limit: 30, windowMs: 60_000 },
  // Per account: two-factor codes (confirm, step-up, disable), right or wrong.
  twoFactor: { limit: 10, windowMs: 15 * 60_000 },
  // Per IP, website mode (Bingo 03 §13): sign-ins through the website's proxy, and the hop
  // on to the website's login.
  websiteSignIn: { limit: 30, windowMs: 60_000 },
  websiteLogin: { limit: 600, windowMs: 60_000 },
} as const satisfies Record<string, RateRule>;
