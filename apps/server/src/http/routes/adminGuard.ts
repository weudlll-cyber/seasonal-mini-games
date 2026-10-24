/**
 * @file   apps/server/src/http/routes/adminGuard.ts
 * @module server/http
 * @brief  Permission check for admin routes and the audit actor of the request.
 *
 * Responsibility: answer 401 without a signed-in account and 403 without the permission
 *                 (code checks permissions, never role names, Bingo 03 §5.2); otherwise give
 *                 the route the actor its audit entry is written for (account, roles,
 *                 permissions, request id, address).
 * Depends on:     fastify, @smg/application (AuditActor)
 * Used by:        ./adminSettings, ./adminAudit, ./adminAccounts, ./matches, ./rounds
 * Spec:           docs/spec/05-security-threat-model.md §1, §8; Bingo 05 §3
 */
import type { AuditActor } from '@smg/application';
import type { FastifyReply, FastifyRequest } from 'fastify';

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
  return {
    accountId: s.accountId,
    roles: s.roles,
    permissions: s.permissions,
    requestId: request.id,
    ip: request.ip,
  };
}
