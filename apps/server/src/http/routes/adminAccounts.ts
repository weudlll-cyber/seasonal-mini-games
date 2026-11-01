/**
 * @file   apps/server/src/http/routes/adminAccounts.ts
 * @module server/http
 * @brief  Admin routes of accounts and abuse signals: search, suspend, restore, roles, abuse list.
 *
 * Responsibility: GET /api/v1/admin/accounts?query= (account.view); POST …/:id/suspend and
 *                 …/:id/unsuspend with a reason (account.suspend: never oneself, a super admin
 *                 only by a super admin; suspension ends the account's sessions); POST
 *                 …/:id/roles and …/:id/roles/remove with a role and a reason (role.assign:
 *                 nobody grants super_admin to themselves, Bingo 03 §5.3); GET /api/v1/admin/abuse
 *                 (abuse.view). Every change writes an audit entry.
 * Depends on:     fastify, @smg/application (AuditLog), @smg/contracts, ../../admin/*,
 *                 ../../auth/sessions, ../../auth/sessionEnds, ../../db/pool, ./adminGuard
 * Used by:        ../app
 * Spec:           docs/spec/05-security-threat-model.md §1, §6, §8; Bingo 03 §5.3, Bingo 11 §3.5, §3.6
 */
import type { AuditActor, AuditLog } from '@smg/application';
import { AccountQuery, ReasonBody, RoleBody } from '@smg/contracts';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { abuseRows } from '../../admin/abuse.js';
import {
  addRole,
  removeRole,
  rolesOf,
  searchAccounts,
  setStatus,
} from '../../admin/accountsAdmin.js';
import type { SessionEnds } from '../../auth/sessionEnds.js';
import { accountSessionIds } from '../../auth/sessions.js';
import type { DbPool } from '../../db/pool.js';
import { permitted } from './adminGuard.js';

interface Deps {
  readonly pool: DbPool;
  readonly audit: AuditLog;
  readonly sessionEnds: SessionEnds;
}

export function registerAdminAccounts(app: FastifyInstance, deps: Deps): void {
  app.get('/api/v1/admin/accounts', async (request, reply) => {
    if ((await permitted(request, reply, 'account.view')) === null) return reply;
    const parsed = AccountQuery.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ code: 'VALIDATION_FAILED' });
    return { items: await searchAccounts(deps.pool, parsed.data.query) };
  });
  app.get('/api/v1/admin/abuse', async (request, reply) => {
    if ((await permitted(request, reply, 'abuse.view')) === null) return reply;
    return { items: await abuseRows(deps.pool) };
  });
  app.post('/api/v1/admin/accounts/:id/suspend', (request, reply) =>
    changeStatus(request, reply, deps, 'suspended'),
  );
  app.post('/api/v1/admin/accounts/:id/unsuspend', (request, reply) =>
    changeStatus(request, reply, deps, 'active'),
  );
  app.post('/api/v1/admin/accounts/:id/roles', (request, reply) =>
    changeRole(request, reply, deps, 'grant'),
  );
  app.post('/api/v1/admin/accounts/:id/roles/remove', (request, reply) =>
    changeRole(request, reply, deps, 'remove'),
  );
}

async function changeStatus(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: Deps,
  status: 'active' | 'suspended',
) {
  const actor = await permitted(request, reply, 'account.suspend');
  if (actor === null) return reply;
  const parsed = ReasonBody.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ code: 'VALIDATION_FAILED' });
  const { id } = request.params as { id: string };
  const target = await rolesOf(deps.pool, id).catch(() => null);
  if (target === null) return reply.status(404).send({ code: 'NOT_FOUND' });
  if (id === actor.accountId) return reply.status(409).send({ code: 'NOT_YOURSELF' });
  if (target.includes('super_admin') && !actor.roles.includes('super_admin')) {
    return reply.status(403).send({ code: 'FORBIDDEN' });
  }
  if (!(await setStatus(deps.pool, id, status)))
    return reply.status(409).send({ code: 'NO_CHANGE' });
  // A suspended account is signed out everywhere at once (its sessions no longer load).
  if (status === 'suspended') deps.sessionEnds.end(await accountSessionIds(deps.pool, id));
  await audited(deps, actor, `account.${status === 'suspended' ? 'suspend' : 'unsuspend'}`, {
    id,
    diff: { reason: parsed.data.reason },
  });
  return { status };
}

async function changeRole(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: Deps,
  how: 'grant' | 'remove',
) {
  const actor = await permitted(request, reply, 'role.assign');
  if (actor === null) return reply;
  const parsed = RoleBody.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ code: 'VALIDATION_FAILED' });
  const { id } = request.params as { id: string };
  if ((await rolesOf(deps.pool, id).catch(() => null)) === null) {
    return reply.status(404).send({ code: 'NOT_FOUND' });
  }
  // Nobody makes themselves super admin through the app (Bingo 03 §5.3; the CLI exists).
  if (how === 'grant' && parsed.data.role === 'super_admin' && id === actor.accountId) {
    return reply.status(403).send({ code: 'FORBIDDEN' });
  }
  const changed =
    how === 'grant'
      ? await addRole(deps.pool, {
          accountId: id,
          role: parsed.data.role,
          grantedBy: actor.accountId,
        })
      : await removeRole(deps.pool, id, parsed.data.role);
  if (!changed) return reply.status(409).send({ code: 'NO_CHANGE' });
  // Permissions are read per request, so the change applies from the next request on.
  await audited(deps, actor, `role.${how}`, {
    id,
    diff: { role: parsed.data.role, reason: parsed.data.reason },
  });
  return { roles: (await rolesOf(deps.pool, id)) ?? [] };
}

function audited(
  deps: Deps,
  actor: AuditActor,
  action: string,
  target: { readonly id: string; readonly diff: unknown },
): Promise<void> {
  return deps.audit.append(actor, {
    action,
    targetType: 'account',
    targetId: target.id,
    diff: target.diff,
  });
}
