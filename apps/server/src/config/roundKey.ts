/**
 * @file   apps/server/src/config/roundKey.ts
 * @module server/config
 * @brief  The key that seals round seeds at rest (05 §3, 06 §2.3 seed_enc), and keys derived
 *         from it for other secrets at rest.
 *
 * Responsibility: `SMG_ROUND_KEY` (64 hex characters) is required: the server refuses to
 *                 start without it; only development (SMG_DEV=1) and the test suites derive a
 *                 fixed key that protects throw-away data. Adapted from Bingo's seedKey.ts.
 *                 Other secrets (TOTP secrets) are sealed with a key derived by HKDF-SHA-256
 *                 with a label of their own, never with the round key itself.
 * Depends on:     node:crypto, ./env
 * Used by:        ../round/runtime, ../http/routes/twoFactor
 * Spec:           docs/spec/05-security-threat-model.md §3; docs/spec/08-admin-settings.md §7
 */
import { createHash, hkdfSync } from 'node:crypto';

import type { Env } from './env.js';

export function roundKeyFrom(env: Env): Buffer {
  if (env.SMG_ROUND_KEY !== undefined) return Buffer.from(env.SMG_ROUND_KEY, 'hex');
  if (!env.SMG_DEV && env.NODE_ENV !== 'test') {
    throw new Error('SMG_ROUND_KEY is required (only SMG_DEV=1 or tests use a fixed key)');
  }
  return createHash('sha256').update('smg-development-only-round-key').digest();
}

// A 32-byte key for one purpose (e.g. 'smg totp secrets'): knowing it reveals neither the
// round key nor another purpose's key.
export function derivedKey(roundKey: Buffer, purpose: string): Buffer {
  return Buffer.from(hkdfSync('sha256', roundKey, Buffer.alloc(0), purpose, 32));
}
