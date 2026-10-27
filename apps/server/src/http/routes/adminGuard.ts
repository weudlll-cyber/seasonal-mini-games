/**
 * @file   apps/server/src/http/routes/adminGuard.ts
 * @module server/http
 * @brief  Permission check for admin routes, the two-factor gate of admin writes, and the
 *         audit actor of the request.
 *
 * Responsibility: answer 401 without a signed-in account and 403 without the permission
 *                 (code checks permissions, never role names, Bingo 03 §5.2); a write under
 *                 /api/v1/admin/ also passes the step-up gate when one is installed
 *                 (`features.twoFactor`, ./twoFactor: 403 AUTH_2FA_REQUIRED without a confirmed
 *                 factor, AUTH_STEP_UP_REQUIRED without a check in the last 10 minutes, Bingo
 *                 05 §3); otherwise give the route the actor its audit entry is written for
 *                 (account, roles, permissions, request id, address).
 * Depends on:     fastify, @smg/application (AuditActor)
 * Used by:        every admin route (./admin*, ./seasons, ./leaderboards, the chat moderation
 *                 routes), ./matches
 * Spec:           docs/spec/05-security-threat-model.md §1, §8; Bingo 05 §3
 */
import type { AuditActor } from '@smg/application';
import type { FastifyReply, FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    // Installed by ./twoFactor when the feature is on: the refusal code for a session's admin
    // write, or null when it may write.
    stepUpGate?: (sessionId: string) => Promise<string | null>;
  }
}

const READS = new Set(['GET', 'HEAD', 'OPTIONS']);

export async function permitted(
  request: FastifyRequest,
  reply: FastifyReply,
  permission: string,
): Promise<(AuditActor & { readonly accountId: string }) | null> {
  const s = request.session;
  if (s === null || s.accountId === null) {
    await reply.status(401).send({ code: 'SIGN_IN_REQUIRED' });
    return null;
  }
  if (!s.permissions.includes(permission)) {
    await reply.status(403).send({ code: 'FORBIDDEN' });
    return null;
  }
  const gate = request.server.stepUpGate;
  if (
    gate !== undefined &&
    !READS.has(request.method) &&
    request.url.startsWith('/api/v1/admin/')
  ) {
    const refusal = await gate(s.id);
    if (refusal !== null) {
      await reply.status(403).send({ code: refusal });
      return null;
    }
  }
  return {
    accountId: s.accountId,
    roles: s.roles,
    permissions: s.permissions,
    requestId: request.id,
    ip: request.ip,
  };
}
