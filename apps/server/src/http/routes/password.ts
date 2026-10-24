/**
 * @file   apps/server/src/http/routes/password.ts
 * @module server/http
 * @brief  POST /api/v1/me/password: change the own password with the current one.
 *
 * Responsibility: check the current password (constant-time verify), apply the password
 *                 rules to the new one, store it, and sign the account out on every other
 *                 session (their sockets close); the current session stays. Limited like a
 *                 login per account and address. Reset by e-mail needs the mailer (backlog).
 * Depends on:     fastify, zod, ../../auth/*, ../../db/pool
 * Used by:        ../app
 * Spec:           docs/spec/05-security-threat-model.md §1; Bingo 03 §2.1, §3
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { passwordHashOf, setPassword } from '../../auth/accounts.js';
import { passwordProblem, verifyPassword } from '../../auth/password.js';
import { RATE_RULES, RateLimiter } from '../../auth/rateLimit.js';
import type { SessionEnds } from '../../auth/sessionEnds.js';
import { revokeOtherSessions } from '../../auth/sessions.js';
import type { DbPool } from '../../db/pool.js';

const body = z.object({ current: z.string().max(128), next: z.string() }).strict();

export function registerPasswordChange(
  app: FastifyInstance,
  deps: { readonly pool: DbPool; readonly sessionEnds: SessionEnds },
): void {
  const limit = new RateLimiter(RATE_RULES.loginAccountIp);
  app.post('/api/v1/me/password', async (request, reply) => {
    const s = request.session;
    if (s === null || s.accountId === null)
      return reply.status(401).send({ code: 'SIGN_IN_REQUIRED' });
    if (!limit.take(`${s.accountId}|${request.ip}`).allowed) {
      return reply.status(429).send({ code: 'RATE_LIMITED' });
    }
    const parsed = body.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ code: 'VALIDATION_FAILED' });
    const encoded = await passwordHashOf(deps.pool, s.accountId);
    if (encoded === null || !(await verifyPassword(encoded, parsed.data.current))) {
      return reply.status(403).send({ code: 'PASSWORD_REQUIRED' });
    }
    const problem = passwordProblem(parsed.data.next);
    if (problem !== null) return reply.status(400).send({ code: 'PASSWORD_WEAK', reason: problem });
    await setPassword(deps.pool, s.accountId, parsed.data.next);
    deps.sessionEnds.end(await revokeOtherSessions(deps.pool, s.accountId, s.id));
    return reply.status(204).send();
  });
}
