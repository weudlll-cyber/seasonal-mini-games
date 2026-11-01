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
 *                 A key this install cannot switch on is named in the view (`unavailable`, with
 *                 its reason) and a version switching it on is refused with 422
 *                 SETTING_UNAVAILABLE: `antiMulti.requireLinkedChat` without a handoff provider
 *                 (05 §6, T103).
 * Depends on:     fastify, @smg/application (SettingsService), @smg/contracts,
 *                 ../../admin/settingsVersions, ../../db/pool, ../../match/rosterRules,
 *                 ./adminGuard
 * Used by:        ../app
 * Spec:           docs/spec/08-admin-settings.md §1, §2; docs/spec/06-data-model-api-realtime.md §3.2
 */
import { SettingsError, type SettingsService } from '@smg/application';
import { SettingsRollbackBody, SettingsUpdateBody } from '@smg/contracts';
import type { FastifyInstance, FastifyReply } from 'fastify';

import { settingsVersions, versionOverrides } from '../../admin/settingsVersions.js';
import type { DbPool } from '../../db/pool.js';
import {
  LINKED_CHAT,
  LINKED_CHAT_UNAVAILABLE,
  linkedChatAvailable,
} from '../../match/rosterRules.js';
import { permitted } from './adminGuard.js';

const STATUS = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  SETTING_INVALID: 422,
  CONFIG_VERSION_CONFLICT: 409,
};

// The keys this install cannot switch on, with the reason the admin form shows (05 §6, T103).
async function unavailable(pool: DbPool, id: string): Promise<Record<string, string>> {
  if (id !== 'security' || (await linkedChatAvailable(pool))) return {};
  return { [LINKED_CHAT]: LINKED_CHAT_UNAVAILABLE };
}

// A new version that switches on a key this install cannot use is refused.
async function refusedKey(
  pool: DbPool,
  id: string,
  overrides: Readonly<Record<string, { value?: unknown }>>,
): Promise<string | null> {
  const blocked = await unavailable(pool, id);
  return Object.keys(blocked).find((k) => overrides[k]?.value === true) ?? null;
}

function unavailableReply(reply: FastifyReply, key: string): FastifyReply {
  return reply.status(422).send({ code: 'SETTING_UNAVAILABLE', detail: key });
}

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
    try {
      const view = await settings.view(id, actor.permissions);
      const blocked = await unavailable(pool, id);
      return Object.keys(blocked).length === 0 ? view : { ...view, unavailable: blocked };
    } catch (e) {
      return failed(reply, e);
    }
  });
  app.put('/api/v1/admin/settings/:id', async (request, reply) => {
    const actor = await permitted(request, reply, 'admin.view');
    if (actor === null) return reply;
    const parsed = SettingsUpdateBody.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ code: 'VALIDATION_FAILED' });
    const { id } = request.params as { id: string };
    const key = await refusedKey(pool, id, parsed.data.overrides);
    if (key !== null) return unavailableReply(reply, key);
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
    const stored = await versionOverrides(pool, id, toVersion);
    if (stored === null) return reply.status(404).send({ code: 'VERSION_NOT_FOUND' });
    const overrides = settings.known(id, stored);
    const key = await refusedKey(pool, id, overrides);
    if (key !== null) return unavailableReply(reply, key);
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
