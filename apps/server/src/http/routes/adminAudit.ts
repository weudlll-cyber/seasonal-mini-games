/**
 * @file   apps/server/src/http/routes/adminAudit.ts
 * @module server/http
 * @brief  Admin routes of the audit log: list with filters, verify the hash chain.
 *
 * Responsibility: GET /api/v1/admin/audit?action=&actor=&before=&limit= (newest first,
 *                 `before` is the id cursor) and GET /api/v1/admin/audit/verify (index of the
 *                 first broken link, -1 when intact). Both need `audit.read`. Nothing can
 *                 change or delete an entry (05 §8).
 * Depends on:     fastify, @smg/contracts (AuditQuery), ../../admin/pgAuditLog, ./adminGuard
 * Used by:        ../app
 * Spec:           docs/spec/05-security-threat-model.md §8; Bingo 05 §3, Bingo 11 §3.10
 */
import { AuditQuery } from '@smg/contracts';
import type { FastifyInstance } from 'fastify';

import type { PgAuditLog } from '../../admin/pgAuditLog.js';
import { permitted } from './adminGuard.js';

export function registerAdminAudit(app: FastifyInstance, audit: PgAuditLog): void {
  app.get('/api/v1/admin/audit', async (request, reply) => {
    if ((await permitted(request, reply, 'audit.read')) === null) return reply;
    const parsed = AuditQuery.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ code: 'VALIDATION_FAILED' });
    return { items: await audit.list(parsed.data) };
  });
  app.get('/api/v1/admin/audit/verify', async (request, reply) => {
    if ((await permitted(request, reply, 'audit.read')) === null) return reply;
    return { brokenAt: await audit.verify() };
  });
}
