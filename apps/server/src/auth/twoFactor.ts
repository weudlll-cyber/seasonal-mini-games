/**
 * @file   apps/server/src/auth/twoFactor.ts
 * @module server/auth
 * @brief  Two-factor sign-in of an account: TOTP factor, recovery codes, step-up of a session.
 *
 * Responsibility: one factor per account (smg.totp_factors): enrolment draws a 20-byte secret
 *                 sealed at rest under its own derived key and replaces an unconfirmed one;
 *                 the first right code confirms it and answers ten recovery codes once, kept
 *                 as SHA-256 hashes; a TOTP step is accepted once (`last_step`, raised in the
 *                 same statement that checks it, so two requests cannot both use it); a
 *                 recovery code works once. A right code stamps the session's
 *                 `last_2fa_at` (the step-up). Disabling removes factor and codes. The
 *                 admin-write gate reads whether a session has a factor and a fresh step-up.
 * Depends on:     node:crypto, pg, @smg/contracts, ../db/pool, ../round/seal, ./totp
 * Used by:        ../http/routes/twoFactor
 * Spec:           Bingo 03 §2, §3; Bingo 05 §2.1; Bingo 11 §1
 */
import { createHash, randomBytes, randomInt } from 'node:crypto';

import type { TwoFactorStatusView } from '@smg/contracts';
import type pg from 'pg';

import { inTransaction, type DbPool } from '../db/pool.js';
import { openSeed, sealSeed } from '../round/seal.js';
import { base32Encode, matchingStep, otpauthUri } from './totp.js';

// A step-up holds for ten minutes (Bingo 03 §3).
const STEP_UP = "interval '10 minutes'";
const RECOVERY_CODES = 10;
// Lower case and digits without look-alikes; "xxxx-xxxx" as TwoFactorCodeBody expects.
const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

export type CheckResult = 'totp' | 'recovery' | 'invalid' | 'notEnrolled';

const hashOf = (code: string) => createHash('sha256').update(code).digest();

function recoveryCode(): string {
  const part = () =>
    Array.from({ length: 4 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
  return `${part()}-${part()}`;
}

export class TwoFactor {
  constructor(
    private readonly pool: DbPool,
    private readonly key: Buffer,
    private readonly now: () => number = Date.now,
  ) {}

  async status(accountId: string, sessionId: string): Promise<TwoFactorStatusView> {
    const r = await this.pool.query<{
      enrolled: boolean;
      last: Date | null;
      fresh: boolean;
      left: number;
    }>(
      `SELECT EXISTS (SELECT 1 FROM smg.totp_factors f
                        WHERE f.account_id = $1 AND f.confirmed_at IS NOT NULL) AS enrolled,
              s.last_2fa_at AS last, coalesce(s.last_2fa_at > now() - ${STEP_UP}, false) AS fresh,
              (SELECT count(*)::int FROM smg.recovery_codes c
                 WHERE c.account_id = $1 AND c.used_at IS NULL) AS left
       FROM smg.sessions s WHERE s.id = $2`,
      [accountId, sessionId],
    );
    const row = r.rows[0];
    return {
      enrolled: row?.enrolled === true,
      stepUpNeeded: row?.fresh !== true,
      lastCheckAt: row?.last?.toISOString() ?? null,
      recoveryCodesLeft: row?.left ?? 0,
    };
  }

  // A new secret for the authenticator app; null while a confirmed factor exists.
  async setup(
    accountId: string,
    account: string,
  ): Promise<{ otpauthUri: string; secret: string } | null> {
    const secret = new Uint8Array(randomBytes(20));
    const r = await this.pool.query(
      `INSERT INTO smg.totp_factors (account_id, secret_enc) VALUES ($1, $2)
       ON CONFLICT (account_id) DO UPDATE SET secret_enc = $2, last_step = 0, created_at = now()
         WHERE smg.totp_factors.confirmed_at IS NULL`,
      [accountId, sealSeed(secret, this.key)],
    );
    if (r.rowCount !== 1) return null;
    return { otpauthUri: otpauthUri(account, secret), secret: base32Encode(secret) };
  }

  // The first right code confirms the factor: the ten recovery codes, shown once; null when
  // the code is wrong or there is nothing to confirm.
  async confirm(accountId: string, sessionId: string, code: string): Promise<string[] | null> {
    return inTransaction(this.pool, async (c) => {
      const f = await c.query<{ secret_enc: Buffer; last_step: string }>(
        `SELECT secret_enc, last_step FROM smg.totp_factors
         WHERE account_id = $1 AND confirmed_at IS NULL FOR UPDATE`,
        [accountId],
      );
      const row = f.rows[0];
      if (row === undefined) return null;
      const secret = openSeed(row.secret_enc, this.key);
      const step = matchingStep(secret, code, this.now(), Number(row.last_step));
      if (step === null) return null;
      await c.query(
        'UPDATE smg.totp_factors SET confirmed_at = now(), last_step = $2 WHERE account_id = $1',
        [accountId, step],
      );
      const codes = Array.from({ length: RECOVERY_CODES }, recoveryCode);
      await c.query('DELETE FROM smg.recovery_codes WHERE account_id = $1', [accountId]);
      for (const one of codes) {
        await c.query(
          'INSERT INTO smg.recovery_codes (account_id, code_hash) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [accountId, hashOf(one)],
        );
      }
      await stamp(c, sessionId);
      return codes;
    });
  }

  // A TOTP code (a step used once) or an unused recovery code; a right one stamps the session.
  async check(accountId: string, sessionId: string, code: string): Promise<CheckResult> {
    return inTransaction(this.pool, async (c) => {
      const f = await c.query<{ secret_enc: Buffer; last_step: string }>(
        `SELECT secret_enc, last_step FROM smg.totp_factors
         WHERE account_id = $1 AND confirmed_at IS NOT NULL FOR UPDATE`,
        [accountId],
      );
      const row = f.rows[0];
      if (row === undefined) return 'notEnrolled';
      const result = code.includes('-')
        ? await useRecoveryCode(c, accountId, code)
        : await useStep(
            c,
            accountId,
            matchingStep(
              openSeed(row.secret_enc, this.key),
              code,
              this.now(),
              Number(row.last_step),
            ),
          );
      if (result !== 'invalid') await stamp(c, sessionId);
      return result;
    });
  }

  async disable(accountId: string): Promise<void> {
    await inTransaction(this.pool, async (c) => {
      await c.query('DELETE FROM smg.recovery_codes WHERE account_id = $1', [accountId]);
      await c.query('DELETE FROM smg.totp_factors WHERE account_id = $1', [accountId]);
    });
  }

  // For the admin-write gate: why the session may not write yet, or null when it may.
  async refusal(sessionId: string): Promise<'AUTH_2FA_REQUIRED' | 'AUTH_STEP_UP_REQUIRED' | null> {
    const r = await this.pool.query<{ enrolled: boolean; fresh: boolean }>(
      `SELECT f.confirmed_at IS NOT NULL AS enrolled,
              coalesce(s.last_2fa_at > now() - ${STEP_UP}, false) AS fresh
       FROM smg.sessions s LEFT JOIN smg.totp_factors f ON f.account_id = s.account_id
       WHERE s.id = $1`,
      [sessionId],
    );
    const row = r.rows[0];
    if (row?.enrolled !== true) return 'AUTH_2FA_REQUIRED';
    return row.fresh ? null : 'AUTH_STEP_UP_REQUIRED';
  }
}

type Db = pg.PoolClient;

async function useStep(c: Db, accountId: string, step: number | null): Promise<CheckResult> {
  if (step === null) return 'invalid';
  // Raised only when still older: a second request with the same code changes no row.
  const r = await c.query(
    'UPDATE smg.totp_factors SET last_step = $2 WHERE account_id = $1 AND last_step < $2',
    [accountId, step],
  );
  return r.rowCount === 1 ? 'totp' : 'invalid';
}

async function useRecoveryCode(c: Db, accountId: string, code: string): Promise<CheckResult> {
  const r = await c.query(
    `UPDATE smg.recovery_codes SET used_at = now()
     WHERE account_id = $1 AND code_hash = $2 AND used_at IS NULL`,
    [accountId, hashOf(code)],
  );
  return r.rowCount === 1 ? 'recovery' : 'invalid';
}

async function stamp(c: Db, sessionId: string): Promise<void> {
  await c.query('UPDATE smg.sessions SET last_2fa_at = now() WHERE id = $1', [sessionId]);
}
