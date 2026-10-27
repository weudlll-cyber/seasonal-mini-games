/**
 * @file   apps/server/src/http/routes/adminWebhooks.ts
 * @module server/http
 * @brief  The admin's webhook endpoints: list, create (secret shown once), change, remove, and
 *         an endpoint's recent deliveries.
 *
 * Responsibility: for `integration.manage`: the endpoints with their last delivery and whether
 *                 the feature is on (SMG_FEATURE_WEBHOOKS; off, nothing is queued or sent); a new
 *                 endpoint answers its secret once; every write is audited, never the secret.
 * Depends on:     fastify, zod, @smg/application (audit), @smg/contracts, ../../integration/webhooks,
 *                 ./adminGuard
 * Used by:        ../app
 * Spec:           docs/spec/07-integration.md §1, §3.2; Bingo 07 §5; Bingo 05 §3
 */
import type { AuditLog } from '@smg/application';
import { WebhookEndpointBody } from '@smg/contracts';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { WebhookStore } from '../../integration/webhooks.js';
import { permitted } from './adminGuard.js';

const PERMISSION = 'integration.manage';
const idParams = z.object({ id: z.uuid() });

interface WebhookRouteDeps {
  readonly store: WebhookStore;
  readonly audit: AuditLog;
  readonly enabled: boolean;
}

export function registerAdminWebhooks(app: FastifyInstance, deps: WebhookRouteDeps): void {
  registerReads(app, deps);
  registerWrites(app, deps);
}

function registerReads(app: FastifyInstance, deps: WebhookRouteDeps): void {
  const { store } = deps;
  app.get('/api/v1/admin/webhooks', async (request, reply) => {
    if ((await permitted(request, reply, PERMISSION)) === null) return reply;
    return { feature: deps.enabled, endpoints: await store.list() };
  });

  app.get('/api/v1/admin/webhooks/:id/deliveries', async (request, reply) => {
    if ((await permitted(request, reply, PERMISSION)) === null) return reply;
    const params = idParams.safeParse(request.params);
    if (!params.success) return reply.status(404).send({ code: 'NOT_FOUND' });
    return { deliveries: await store.deliveries(params.data.id) };
  });
}

function registerWrites(app: FastifyInstance, deps: WebhookRouteDeps): void {
  const { store, audit } = deps;
  app.post('/api/v1/admin/webhooks', async (request, reply) => {
    const actor = await permitted(request, reply, PERMISSION);
    if (actor === null) return reply;
    const body = WebhookEndpointBody.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ code: 'VALIDATION_FAILED' });
    const made = await store.create(body.data, actor.accountId);
    await audit.append(actor, {
      action: 'webhook.create',
      targetType: 'webhook',
      targetId: made.id,
      diff: body.data,
    });
    return reply.status(201).send(made);
  });

  app.put('/api/v1/admin/webhooks/:id', async (request, reply) => {
    const actor = await permitted(request, reply, PERMISSION);
    if (actor === null) return reply;
    const params = idParams.safeParse(request.params);
    const body = WebhookEndpointBody.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ code: 'VALIDATION_FAILED' });
    const changed = params.success ? await store.update(params.data.id, body.data) : null;
    if (changed === null) return reply.status(404).send({ code: 'NOT_FOUND' });
    await audit.append(actor, {
      action: 'webhook.update',
      targetType: 'webhook',
      targetId: changed.id,
      diff: body.data,
    });
    return changed;
  });

  app.delete('/api/v1/admin/webhooks/:id', async (request, reply) => {
    const actor = await permitted(request, reply, PERMISSION);
    if (actor === null) return reply;
    const params = idParams.safeParse(request.params);
    if (!params.success || !(await store.remove(params.data.id))) {
      return reply.status(404).send({ code: 'NOT_FOUND' });
    }
    await audit.append(actor, {
      action: 'webhook.remove',
      targetType: 'webhook',
      targetId: params.data.id,
      diff: null,
    });
    return reply.status(204).send();
  });
}
