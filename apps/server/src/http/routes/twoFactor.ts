/**
 * @file   apps/server/src/http/routes/twoFactor.ts
 * @module server/http
 * @brief  Two-factor routes of the signed-in account and the step-up gate of admin writes.
 *
 * Responsibility: GET /api/v1/me/2fa (status), POST …/setup (a new secret as otpauth URI and
 *                 base32 text; 409 TWO_FACTOR_ENROLLED while a confirmed factor exists),
 *                 …/confirm (the first code; answers the ten recovery codes once), …/step-up
 *                 (a TOTP or recovery code stamps the session), …/disable (needs a current
 *                 code). Codes are limited per account (RATE_RULES.twoFactor); a wrong one is
 *                 422 AUTH_2FA_INVALID. Enrol, confirm, disable and the use of a recovery code
 *                 are audited. With `features.twoFactor` on, the gate of ./adminGuard is
 *                 installed; with it off nothing changes for admin writes.
 * Depends on:     fastify, @smg/application (AuditLog), @smg/contracts, ../../auth/*,
 *                 ../../config/*, ../../db/pool
 * Used by:        ../app
 * Spec:           Bingo 03 §2, §3; Bingo 05 §2.1, §3; Bingo 11 §1
 */
import type { AuditActor, AuditLog } from '@smg/application';
import { TwoFactorCodeBody } from '@smg/contracts';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { RATE_RULES, RateLimiter } from '../../auth/rateLimit.js';
import { TwoFactor } from '../../auth/twoFactor.js';
import type { Env } from '../../config/env.js';
import type { Features } from '../../config/features.js';
import { derivedKey, roundKeyFrom } from '../../config/roundKey.js';
import type { DbPool } from '../../db/pool.js';

interface Deps {
  readonly pool: DbPool;
  readonly env: Env;
  readonly features: Features;
  readonly audit: AuditLog;
}

interface Caller {
  readonly accountId: string;
  readonly sessionId: string;
  readonly name: string;
  readonly actor: AuditActor;
}

async function caller(request: FastifyRequest, reply: FastifyReply): Promise<Caller | null> {
  const s = request.session;
  if (s === null || s.accountId === null) {
    await reply.status(401).send({ code: 'SIGN_IN_REQUIRED' });
    return null;
  }
  return {
    accountId: s.accountId,
    sessionId: s.id,
    name: s.displayName ?? s.accountId,
    actor: {
      accountId: s.accountId,
      roles: s.roles,
      permissions: s.permissions,
      requestId: request.id,
      ip: request.ip,
    },
  };
}

interface Ctx {
  readonly factor: TwoFactor;
  readonly limit: RateLimiter;
  readonly audit: AuditLog;
}

const audited = (ctx: Ctx, c: Caller, action: string) =>
  ctx.audit.append(c.actor, { action, targetType: 'account', targetId: c.accountId, diff: {} });

// The caller and the code of the body, or null once a refusal was sent.
async function withCode(ctx: Ctx, request: FastifyRequest, reply: FastifyReply) {
  const c = await caller(request, reply);
  if (c === null) return null;
  const parsed = TwoFactorCodeBody.safeParse(request.body);
  if (!parsed.success) {
    await reply.status(400).send({ code: 'VALIDATION_FAILED' });
    return null;
  }
  if (!ctx.limit.take(c.accountId).allowed) {
    await reply.status(429).send({ code: 'RATE_LIMITED' });
    return null;
  }
  return { c, code: parsed.data.code };
}

// A right TOTP or recovery code of a confirmed factor (the session is stamped), else null.
async function checked(ctx: Ctx, request: FastifyRequest, reply: FastifyReply) {
  const got = await withCode(ctx, request, reply);
  if (got === null) return null;
  const result = await ctx.factor.check(got.c.accountId, got.c.sessionId, got.code);
  if (result === 'notEnrolled' || result === 'invalid') {
    const notEnrolled = result === 'notEnrolled';
    await reply
      .status(notEnrolled ? 409 : 422)
      .send({ code: notEnrolled ? 'TWO_FACTOR_NOT_ENROLLED' : 'AUTH_2FA_INVALID' });
    return null;
  }
  if (result === 'recovery') await audited(ctx, got.c, 'twoFactor.recoveryCode');
  return got.c;
}

export function registerTwoFactor(app: FastifyInstance, deps: Deps): void {
  const factor = new TwoFactor(deps.pool, derivedKey(roundKeyFrom(deps.env), 'smg totp secrets'));
  const ctx: Ctx = { factor, limit: new RateLimiter(RATE_RULES.twoFactor), audit: deps.audit };
  if (deps.features.twoFactor) app.decorate('stepUpGate', (id: string) => factor.refusal(id));
  app.get('/api/v1/me/2fa', async (request, reply) => {
    const c = await caller(request, reply);
    return c === null ? reply : factor.status(c.accountId, c.sessionId);
  });
  app.post('/api/v1/me/2fa/setup', async (request, reply) => {
    const c = await caller(request, reply);
    if (c === null) return reply;
    const setup = await factor.setup(c.accountId, c.name);
    if (setup === null) return reply.status(409).send({ code: 'TWO_FACTOR_ENROLLED' });
    await audited(ctx, c, 'twoFactor.enrol');
    return setup;
  });
  app.post('/api/v1/me/2fa/confirm', async (request, reply) => {
    const got = await withCode(ctx, request, reply);
    if (got === null) return reply;
    const codes = await factor.confirm(got.c.accountId, got.c.sessionId, got.code);
    if (codes === null) return reply.status(422).send({ code: 'AUTH_2FA_INVALID' });
    await audited(ctx, got.c, 'twoFactor.confirm');
    return { recoveryCodes: codes };
  });
  app.post('/api/v1/me/2fa/step-up', async (request, reply) => {
    const c = await checked(ctx, request, reply);
    return c === null ? reply : factor.status(c.accountId, c.sessionId);
  });
  app.post('/api/v1/me/2fa/disable', async (request, reply) => {
    const c = await checked(ctx, request, reply);
    if (c === null) return reply;
    await factor.disable(c.accountId);
    await audited(ctx, c, 'twoFactor.disable');
    return factor.status(c.accountId, c.sessionId);
  });
}
