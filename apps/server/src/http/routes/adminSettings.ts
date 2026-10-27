/**
 * @file   apps/server/src/http/routes/adminSettings.ts
 * @module server/http
 * @brief  Admin routes of the settings documents: list, read one, save a new version, the
 *         version history with its diffs, and rollback.
 *
 * Responsibility: GET /api/v1/admin/settings (the document ids), GET …/settings/:id (its
 *                 definitions, overrides, values and the keys the viewer may edit), PUT
 *                 …/settings/:id (a new version; every key checked against its definition
 *                 and its edit permission, audited by the service), GET …/settings/:id/versions
 *                 (newest first, each with its changes), POST …/settings/:id/rollback (a new
 *                 version with the overrides of `toVersion`, checked and audited like an edit,
 *                 as `settings.rollback`; a stale `version` is 409 CONFIG_VERSION_CONFLICT).
 *                 Reading needs `admin.view`; each key's edit permission is checked per key.
 * Depends on:     fastify, @smg/application (SettingsService), @smg/contracts,
 *                 ../../admin/settingsVersions, ../../db/pool, ./adminGuard
 * Used by:        ../app
 * Spec:           docs/spec/08-admin-settings.md §1, §2; docs/spec/06-data-model-api-realtime.md §3.2
 */
import { SettingsError, type SettingsService } from '@smg/application';
import { SettingsRollbackBody, SettingsUpdateBody } from '@smg/contracts';
import type { FastifyInstance, FastifyReply } from 'fastify';

import { settingsVersions, versionOverrides } from '../../admin/settingsVersions.js';
import type { DbPool } from '../../db/pool.js';
import { permitted } from './adminGuard.js';

const STATUS = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  SETTING_INVALID: 422,
  CONFIG_VERSION_CONFLICT: 409,
};

export function registerAdminSettings(
  app: FastifyInstance,
  settings: SettingsService,
  pool: DbPool,
): void {
  app.get('/api/v1/admin/settings', async (request, reply) => {
    if ((await permitted(request, reply, 'admin.view')) === null) return reply;
    return { ids: settings.ids() };
  });
  app.get('/api/v1/admin/settings/:id', async (request, reply) => {
    const actor = await permitted(request, reply, 'admin.view');
    if (actor === null) return reply;
    const { id } = request.params as { id: string };
    return settings.view(id, actor.permissions).catch((e: unknown) => failed(reply, e));
  });
  app.put('/api/v1/admin/settings/:id', async (request, reply) => {
    const actor = await permitted(request, reply, 'admin.view');
    if (actor === null) return reply;
    const parsed = SettingsUpdateBody.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ code: 'VALIDATION_FAILED' });
    const { id } = request.params as { id: string };
    return settings.update(id, parsed.data, actor).catch((e: unknown) => failed(reply, e));
  });
  registerHistory(app, settings, pool);
}

function registerHistory(app: FastifyInstance, settings: SettingsService, pool: DbPool): void {
  app.get('/api/v1/admin/settings/:id/versions', async (request, reply) => {
    if ((await permitted(request, reply, 'admin.view')) === null) return reply;
    const { id } = request.params as { id: string };
    if (!settings.ids().includes(id)) return reply.status(404).send({ code: 'NOT_FOUND' });
    return { items: await settingsVersions(pool, id) };
  });
  app.post('/api/v1/admin/settings/:id/rollback', async (request, reply) => {
    const actor = await permitted(request, reply, 'admin.view');
    if (actor === null) return reply;
    const parsed = SettingsRollbackBody.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ code: 'VALIDATION_FAILED' });
    const { id } = request.params as { id: string };
    if (!settings.ids().includes(id)) return reply.status(404).send({ code: 'NOT_FOUND' });
    const { version, toVersion, comment } = parsed.data;
    const overrides = await versionOverrides(pool, id, toVersion);
    if (overrides === null) return reply.status(404).send({ code: 'VERSION_NOT_FOUND' });
    const change = {
      version,
      overrides,
      comment: `Rollback to version ${String(toVersion)}: ${comment}`,
    };
    return settings
      .update(id, change, actor, 'settings.rollback')
      .catch((e: unknown) => failed(reply, e));
  });
}

function failed(reply: FastifyReply, error: unknown): FastifyReply {
  if (!(error instanceof SettingsError)) throw error;
  return reply.status(STATUS[error.code]).send({ code: error.code, detail: error.detail });
}
