/**
 * @file   apps/server/src/http/routes/auth.ts
 * @module server/http
 * @brief  Session and local-account routes under /api/v1 (taken over from Bingo).
 *
 * Responsibility: GET /session (account summary with whether it has a password, T201;
 *                 permissions, CSRF token, feature flags, the auth mode and, in website mode,
 *                 the sign-in route, O66),
 *                 POST /auth/register, /auth/login, /auth/logout, /auth/guest, and DELETE /me
 *                 (the account, after its password is checked, or for an account made by the
 *                 website's handoff, which has none, after its display name is typed). Login answers
 *                 uniformly and verifies a dummy hash for unknown e-mails, so timing and
 *                 text never reveal whether an account exists (03 §2.1); a wrong password for a
 *                 known account adds one abuse signal for moderators (05 §2). Login and
 *                 registration are rate-limited per IP; a login is also braked per account+IP after
 *                 5 failed sign-ins in 15 minutes (the kit's FailureBrake, right ones are not
 *                 counted, T427; each try holds one of the five places while its password is
 *                 checked, so tries sent together cannot slip past, T441), 03 §13. E-mail
 *                 verification and 2FA are behind feature flags that are off by default;
 *                 when verification is on, unverified accounts cannot sign in. In website
 *                 mode (O66, Bingo D37) registration and password sign-in do not exist (404):
 *                 players sign in through the website (./websiteSignIn).
 * Depends on:     fastify, zod, @smg/contracts (SessionView), ../../auth/*, ../../admin/abuse, ../../db/pool, ../../config/features
 * Used by:        ../app, ./handoff (startSession), ./websiteSignIn (openSession)
 * Spec:           docs/spec/05-security-threat-model.md §1, §2; Bingo 05 §2.1; Bingo 03 §2.1, §2.3, §3, §13
 */
import { FailureBrake, RateLimiter, type SessionEnds } from '@seasonal/kit/server';
import type { SessionView } from '@smg/contracts';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { createHash } from 'node:crypto';

import { z } from 'zod';

import { recordSignal } from '../../admin/abuse.js';
import {
  deleteAccount,
  findLoginAccount,
  passwordHashOf,
  recordLogin,
  registerAccount,
} from '../../auth/accounts.js';
import { dummyPasswordHash, passwordProblem, verifyPassword } from '../../auth/password.js';
import { RATE_RULES } from '../../auth/rateRules.js';
import {
  clearSessionCookie,
  setSessionCookie,
  type CookieConfig,
} from '../../auth/sessionPlugin.js';
import {
  accountSessionIds,
  createSession,
  revokeSession,
  WEBSITE_SESSION_DAYS,
} from '../../auth/sessions.js';
import type { Features } from '../../config/features.js';
import type { DbPool } from '../../db/pool.js';

interface AuthDeps {
  readonly pool: DbPool;
  readonly cookie: CookieConfig;
  readonly features: Features;
  // Ended sessions: the gateway closes their sockets (audit S4).
  readonly sessionEnds: SessionEnds;
  // Website mode: the sign-in route (`<base>auth/website`); null in local mode.
  readonly signInPath: string | null;
  // Shared with the password change (./password), per account and address (O130).
  readonly passwordLimit: RateLimiter;
}

const registerBody = z.object({
  email: z.email().max(254),
  displayName: z
    .string()
    .trim()
    .regex(/^[\p{L}\p{N}_.-]{3,24}$/u),
  password: z.string(),
});
const loginBody = z.object({ email: z.email().max(254), password: z.string().max(128) });

// One try holding a place in the brake (the kit's FailureBrake reserve).
type Attempt = NonNullable<ReturnType<FailureBrake['reserve']>>;

const LOGIN_FAILED = { code: 'LOGIN_FAILED', message: 'Invalid e-mail or password.' };

export function registerAuthRoutes(app: FastifyInstance, deps: AuthDeps): void {
  const limits = {
    register: new RateLimiter(RATE_RULES.register),
    loginIp: new RateLimiter(RATE_RULES.loginIp),
    // Failed sign-ins per account and address; a right one is not counted (T427).
    signInFailures: new FailureBrake(RATE_RULES.loginAccountIp),
    guest: new RateLimiter(RATE_RULES.guest),
  };
  app.get('/api/v1/session', (request) => sessionSummary(request, deps));
  app.post('/api/v1/auth/logout', async (request, reply) => {
    if (request.session !== null) {
      await revokeSession(deps.pool, request.session.id);
      void deps.sessionEnds.end([request.session.id]);
    }
    clearSessionCookie(reply, deps.cookie);
    return reply.status(204).send();
  });
  app.delete('/api/v1/me', async (request, reply) => deleteMe(request, reply, deps));
  app.post('/api/v1/auth/guest', async (request, reply) => {
    if (!deps.features.guests) return reply.status(404).send({ code: 'NOT_FOUND' });
    if (!limits.guest.take(request.ip).allowed) return tooMany(reply);
    // A guest session lives as long as a player's: 7 days in website mode (T280).
    const days = deps.signInPath === null ? undefined : WEBSITE_SESSION_DAYS;
    const userAgent = request.headers['user-agent'] ?? null;
    const session = await createSession(deps.pool, null, userAgent, days);
    setSessionCookie(reply, deps.cookie, session);
    return reply.status(201).send({ kind: 'guest' });
  });
  // Website mode: no registration and no password sign-in (the routes do not exist, 404).
  if (deps.signInPath !== null) return;
  app.post('/api/v1/auth/register', async (request, reply) => {
    if (!limits.register.take(request.ip).allowed) return tooMany(reply);
    return register(request, reply, deps);
  });
  app.post('/api/v1/auth/login', async (request, reply) => {
    const parsed = loginBody.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(LOGIN_FAILED);
    // The brake's key is a hash: never a raw login name before sign-in (the kit's rule).
    const key = createHash('sha256')
      .update(`${parsed.data.email.toLowerCase()}|${request.ip}`)
      .digest('hex');
    if (!limits.loginIp.take(request.ip).allowed) return tooMany(reply);
    // One of the key's places, held while the password is checked (T427, T441).
    const attempt = limits.signInFailures.reserve(key);
    if (attempt === null) return tooMany(reply);
    try {
      return await login(request, reply, deps, { body: parsed.data, attempt });
    } finally {
      // Frees the place unless the password was wrong: only the first of the two ends counts.
      attempt.passed();
    }
  });
}

function sessionSummary(request: FastifyRequest, deps: AuthDeps): SessionView {
  const s = request.session;
  return {
    signedIn: s !== null && s.accountId !== null,
    kind: s?.kind ?? null,
    // `hasPassword`: whether the account page offers "Change password" (T201).
    account:
      s?.accountId && s.displayName !== null
        ? { id: s.accountId, displayName: s.displayName, hasPassword: s.hasPassword }
        : null,
    permissions: s?.permissions ?? [],
    csrfToken: s?.csrfToken ?? null,
    features: { ...deps.features },
    authMode: deps.signInPath === null ? 'local' : 'website',
    signInPath: deps.signInPath,
  };
}

async function register(request: FastifyRequest, reply: FastifyReply, deps: AuthDeps) {
  const parsed = registerBody.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ code: 'VALIDATION_FAILED' });
  const problem = passwordProblem(parsed.data.password);
  if (problem !== null) return reply.status(400).send({ code: 'PASSWORD_WEAK', reason: problem });
  const created = await registerAccount(deps.pool, parsed.data);
  // One answer for an e-mail or name already in use, so the e-mail is never revealed.
  if (!created.ok) return reply.status(409).send({ code: 'REGISTRATION_FAILED' });
  return startSession(request, reply, deps, { accountId: created.id, status: 201 });
}

async function login(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: AuthDeps,
  { body, attempt }: { body: z.infer<typeof loginBody>; attempt: Attempt },
) {
  const account = await findLoginAccount(deps.pool, body.email);
  const encoded = account?.passwordHash ?? (await dummyPasswordHash());
  const valid = await verifyPassword(encoded, body.password);
  if (account !== null && !valid) {
    await recordSignal(deps.pool, {
      accountId: account.id,
      kind: 'loginFailed',
      detail: request.ip,
      weight: 1,
    });
  }
  if (account === null || !valid) {
    attempt.failed();
    return reply.status(401).send(LOGIN_FAILED);
  }
  if (deps.features.emailVerification && !account.emailVerified) {
    return reply.status(403).send({ code: 'EMAIL_NOT_VERIFIED' });
  }
  await recordLogin(deps.pool, account.id);
  return startSession(request, reply, deps, { accountId: account.id, status: 200 });
}

// playerDays: a player session's absolute lifetime (7 days after a website sign-in, else 30).
type SessionDeps = Pick<AuthDeps, 'pool' | 'cookie' | 'sessionEnds'> & {
  readonly playerDays?: number;
};

// A new session for the account with its cookie set on the reply; the browser's session
// before it ends (03 §3: a fresh session id on every sign-in, also through the website).
export async function openSession(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: SessionDeps,
  accountId: string,
): Promise<void> {
  if (request.session !== null) {
    await revokeSession(deps.pool, request.session.id);
    void deps.sessionEnds.end([request.session.id]);
  }
  const session = await createSession(
    deps.pool,
    accountId,
    request.headers['user-agent'] ?? null,
    deps.playerDays,
  );
  setSessionCookie(reply, deps.cookie, session);
}

// A new session for the account, answered with its cookie (also after a handoff, ./handoff).
export async function startSession(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: SessionDeps,
  { accountId, status }: { readonly accountId: string; readonly status: number },
) {
  await openSession(request, reply, deps, accountId);
  return reply.status(status).send({ accountId });
}

// DELETE /me { password } (05 §2.2): the account is deleted after its password is checked.
// An account with a password confirms with it; one made by the website's handoff has none
// and types its display name instead (07 §4, DECISIONS T105).
const deleteBody = z.object({
  password: z.string().max(128).optional(),
  confirm: z.string().max(64).optional(),
});

async function deletionConfirmed(
  request: FastifyRequest,
  deps: AuthDeps,
  accountId: string,
): Promise<'ok' | 'PASSWORD_REQUIRED' | 'CONFIRMATION_REQUIRED'> {
  const parsed = deleteBody.safeParse(request.body);
  const body = parsed.success ? parsed.data : {};
  const encoded = await passwordHashOf(deps.pool, accountId);
  if (encoded === null) {
    const name = request.session?.displayName ?? null;
    return name !== null && body.confirm?.trim() === name ? 'ok' : 'CONFIRMATION_REQUIRED';
  }
  const password = body.password ?? '';
  return (await verifyPassword(encoded, password)) ? 'ok' : 'PASSWORD_REQUIRED';
}

async function deleteMe(request: FastifyRequest, reply: FastifyReply, deps: AuthDeps) {
  const accountId = request.session?.accountId ?? null;
  if (accountId === null) return reply.status(401).send({ code: 'SIGN_IN_REQUIRED' });
  // The password change's limiter: a deletion checks the password too (O130).
  if (!deps.passwordLimit.take(`${accountId}|${request.ip}`).allowed) return tooMany(reply);
  const confirmed = await deletionConfirmed(request, deps, accountId);
  if (confirmed !== 'ok') return reply.status(403).send({ code: confirmed });
  const sessions = await accountSessionIds(deps.pool, accountId);
  await deleteAccount(deps.pool, accountId);
  void deps.sessionEnds.end(sessions);
  clearSessionCookie(reply, deps.cookie);
  return reply.status(204).send();
}

function tooMany(reply: FastifyReply) {
  return reply.status(429).send({ code: 'RATE_LIMITED' });
}
