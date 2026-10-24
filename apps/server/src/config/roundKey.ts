/**
 * @file   apps/server/src/config/roundKey.ts
 * @module server/config
 * @brief  The key that seals round seeds at rest (05 §3, 06 §2.3 seed_enc).
 *
 * Responsibility: `SMG_ROUND_KEY` (64 hex characters) is required: the server refuses to
 *                 start without it; only development (SMG_DEV=1) and the test suites derive a
 *                 fixed key that protects throw-away data. Adapted from Bingo's seedKey.ts.
 * Depends on:     node:crypto, ./env
 * Used by:        ../http/app
 * Spec:           docs/spec/05-security-threat-model.md §3; docs/spec/08-admin-settings.md §7
 */
import { createHash } from 'node:crypto';

import type { Env } from './env.js';

export function roundKeyFrom(env: Env): Buffer {
  if (env.SMG_ROUND_KEY !== undefined) return Buffer.from(env.SMG_ROUND_KEY, 'hex');
  if (!env.SMG_DEV && env.NODE_ENV !== 'test') {
    throw new Error('SMG_ROUND_KEY is required (only SMG_DEV=1 or tests use a fixed key)');
  }
  return createHash('sha256').update('smg-development-only-round-key').digest();
}
