/**
 * @file   apps/server/src/http/routes/adminIntegration.ts
 * @module server/http
 * @brief  The admin's integration routes: the embed allowlist and the identity providers.
 *
 * Responsibility: for `integration.manage` (Bingo 05 §3): list, save and remove embed origins;
 *                 list, create, change and remove `jwt_handoff` providers (a pinned key must be a
 *                 PEM public key; the role mapping never grants an admin role). Every write is
 *                 audited without key material.
 * Depends on:     fastify, zod, @smg/application (audit), @smg/contracts, ../../integration/*,
 *                 ./adminGuard
 * Used by:        ../app
 * Spec:           docs/spec/07-integration.md §1; Bingo 07 §2.1, §3.4; Bingo 05 §3
 */
import type { AuditLog } from '@smg/application';
import { EmbedOriginBody, IdentityProviderBody } from '@smg/contracts';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import type { DbPool } from '../../db/pool.js';
import type { EmbedAllowlist } from '../../integration/embedOrigins.js';
import { pinnedKeyProblem } from '../../integration/keys.js';
import {
  createProvider,
  deleteProvider,
  listProviders,
  updateProvider,
} from '../../integration/providers.js';
import { permitted } from './adminGuard.js';

const PERMISSION = 'integration.manage';
const originQuery = z.object({ origin: z.string().min(1).max(300) });
const idParams = z.object({ id: z.uuid() });

function isOrigin(text: string): boolean {
  try {
    return new URL(text).origin === text;
  } catch {
    return false;
  }
}

interface IntegrationRouteDeps {
  readonly pool: DbPool;
  readonly embeds: EmbedAllowlist;
  readonly audit: AuditLog;
}

export function registerAdminIntegration(app: FastifyInstance, deps: IntegrationRouteDeps): void {
  registerEmbedOrigins(app, deps);
  registerProviders(app, deps);
}

function registerEmbedOrigins(app: FastifyInstance, deps: IntegrationRouteDeps): void {
  const { embeds, audit } = deps;
  app.get('/api/v1/admin/embed-origins', async (request, reply) => {
    if ((await permitted(request, reply, PERMISSION)) === null) return reply;
    return { origins: await embeds.list() };
  });

  app.post('/api/v1/admin/embed-origins', async (request, reply) => {
    const actor = await permitted(request, reply, PERMISSION);
    if (actor === null) return reply;
    const body = EmbedOriginBody.safeParse(request.body);
    // An origin exactly as a browser sends it: scheme, host and port, nothing else.
    if (!body.success || !isOrigin(body.data.origin)) {
      return reply.status(400).send({ code: 'VALIDATION_FAILED' });
    }
    await embeds.save(body.data, actor.accountId);
    await audit.append(actor, {
      action: 'embedOrigin.save',
      targetType: 'embedOrigin',
      targetId: body.data.origin,
      diff: body.data,
    });
    return reply.status(204).send();
  });

  app.delete('/api/v1/admin/embed-origins', async (request, reply) => {
    const actor = await permitted(request, reply, PERMISSION);
    if (actor === null) return reply;
    const query = originQuery.safeParse(request.query);
    if (!query.success) return reply.status(400).send({ code: 'VALIDATION_FAILED' });
    if (!(await embeds.remove(query.data.origin))) {
      return reply.status(404).send({ code: 'NOT_FOUND' });
    }
    await audit.append(actor, {
      action: 'embedOrigin.remove',
      targetType: 'embedOrigin',
      targetId: query.data.origin,
      diff: null,
    });
    return reply.status(204).send();
  });
}

// The provider body, its pinned key checked; null after a 400 answer.
async function providerBody(request: FastifyRequest, reply: FastifyReply) {
  const body = IdentityProviderBody.safeParse(request.body);
  const key = body.success ? body.data.pinnedPublicKey : null;
  const problem = key === null ? null : pinnedKeyProblem(key);
  if (!body.success || problem !== null) {
    await reply.status(400).send({ code: 'VALIDATION_FAILED', ...(problem ? { problem } : {}) });
    return null;
  }
  return body.data;
}

// What the audit keeps of a provider: everything but the key itself.
const auditedProvider = (b: z.infer<typeof IdentityProviderBody>) => ({
  ...b,
  pinnedPublicKey: b.pinnedPublicKey === null ? null : 'set',
});

function registerProviders(app: FastifyInstance, deps: IntegrationRouteDeps): void {
  const { pool, audit } = deps;
  app.get('/api/v1/admin/identity-providers', async (request, reply) => {
    if ((await permitted(request, reply, PERMISSION)) === null) return reply;
    return { providers: await listProviders(pool) };
  });

  app.post('/api/v1/admin/identity-providers', async (request, reply) => {
    const actor = await permitted(request, reply, PERMISSION);
    if (actor === null) return reply;
    const body = await providerBody(request, reply);
    if (body === null) return reply;
    const made = await createProvider(pool, body);
    if (made === null) return reply.status(409).send({ code: 'ISSUER_TAKEN' });
    await audit.append(actor, {
      action: 'identityProvider.create',
      targetType: 'identityProvider',
      targetId: made.id,
      diff: auditedProvider(body),
    });
    return reply.status(201).send(made);
  });

  app.put('/api/v1/admin/identity-providers/:id', async (request, reply) => {
    const actor = await permitted(request, reply, PERMISSION);
    if (actor === null) return reply;
    const params = idParams.safeParse(request.params);
    const body = await providerBody(request, reply);
    if (body === null) return reply;
    const changed = params.success ? await updateProvider(pool, params.data.id, body) : null;
    if (changed === null) return reply.status(404).send({ code: 'NOT_FOUND' });
    await audit.append(actor, {
      action: 'identityProvider.update',
      targetType: 'identityProvider',
      targetId: changed.id,
      diff: auditedProvider(body),
    });
    return changed;
  });

  app.delete('/api/v1/admin/identity-providers/:id', async (request, reply) => {
    const actor = await permitted(request, reply, PERMISSION);
    if (actor === null) return reply;
    const params = idParams.safeParse(request.params);
    if (!params.success || !(await deleteProvider(pool, params.data.id))) {
      return reply.status(404).send({ code: 'NOT_FOUND' });
    }
    await audit.append(actor, {
      action: 'identityProvider.remove',
      targetType: 'identityProvider',
      targetId: params.data.id,
      diff: null,
    });
    return reply.status(204).send();
  });
}
