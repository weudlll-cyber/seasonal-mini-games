/**
 * @file   apps/server/src/http/routes/chatModeration.ts
 * @module server/http
 * @brief  The moderation routes of the builtin chat (`chat.moderate`, every write audited).
 *
 * Responsibility: Bingo 05 §3's Moderation row: the report queue by status and resolving a
 *                 report, deleting a message, the sanctions (list, mute or ban, lift), a room's
 *                 slow mode and lock, and the three word lists (read all, replace one). With
 *                 the provider `none` or `hostEmbed` every one answers 409 CHAT_DISABLED except
 *                 the word lists, which can be prepared before the chat is switched on. Bad
 *                 input answers 400 VALIDATION_FAILED, a missing target 404 NOT_FOUND.
 * Depends on:     fastify, zod, @smg/contracts (bodies), ../../chat/moderation, ../../chat/reports,
 *                 ./adminGuard
 * Used by:        ./chat
 * Spec:           Bingo 05 §3 (Moderation), Bingo 03 §12; docs/spec/07-integration.md §2
 */
import { ChatResolveBody, ChatRoomPatchBody, ChatSanctionBody, WordListBody } from '@smg/contracts';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z, type ZodType } from 'zod';

import {
  deleteAs,
  liftAs,
  patchRoomAs,
  putListAs,
  resolveAs,
  sanctionAs,
  type Actor,
  type Moderation,
} from '../../chat/moderation.js';
import { LIST_IDS, reports, wordLists, type ListId } from '../../chat/reports.js';
import { permitted } from './adminGuard.js';

const idParams = z.object({ id: z.uuid() });
const statusQuery = z.object({
  status: z.enum(['open', 'actioned', 'dismissed']).default('open'),
});
const listParams = z.object({ id: z.enum(LIST_IDS as [ListId, ...ListId[]]) });

// 409 CHAT_DISABLED unless the builtin chat is in force.
export async function builtinOr409(
  chat: Moderation['chat'],
  reply: FastifyReply,
): Promise<boolean> {
  if ((await chat.provider()) === 'builtin') return true;
  await reply.status(409).send({ code: 'CHAT_DISABLED' });
  return false;
}

interface Checked<B> {
  readonly actor: Actor;
  readonly id: string;
  readonly body: B;
}

// Permission, provider, the `:id` and the body, in that order; null after the answer.
async function checked<B>(
  m: Moderation,
  request: FastifyRequest,
  reply: FastifyReply,
  schema: ZodType<B> | null,
): Promise<Checked<B | null> | null> {
  const actor = await permitted(request, reply, 'chat.moderate');
  if (actor === null || !(await builtinOr409(m.chat, reply))) return null;
  const params = idParams.safeParse(request.params);
  if (!params.success) {
    await reply.status(404).send({ code: 'NOT_FOUND' });
    return null;
  }
  const body = schema === null ? null : schema.safeParse(request.body);
  if (body !== null && !body.success) {
    await reply.status(400).send({ code: 'VALIDATION_FAILED' });
    return null;
  }
  return { actor, id: params.data.id, body: body === null ? null : body.data };
}

function answer(
  reply: FastifyReply,
  outcome: { ok: true; value: unknown } | { ok: false; code: string },
): FastifyReply {
  if (!outcome.ok) return reply.status(404).send({ code: outcome.code });
  return reply.send(outcome.value ?? { ok: true });
}

export function registerChatModeration(app: FastifyInstance, m: Moderation): void {
  app.get('/api/v1/admin/moderation/reports', async (request, reply) => {
    if ((await permitted(request, reply, 'chat.moderate')) === null) return reply;
    if (!(await builtinOr409(m.chat, reply))) return reply;
    const query = statusQuery.safeParse(request.query);
    if (!query.success) return reply.status(400).send({ code: 'VALIDATION_FAILED' });
    return { items: await reports(m.chat.pool, query.data.status) };
  });
  app.post('/api/v1/admin/moderation/reports/:id/resolve', async (request, reply) => {
    const c = await checked(m, request, reply, ChatResolveBody);
    if (c === null || c.body === null) return reply;
    return answer(reply, await resolveAs(m, c.actor, c.id, c.body));
  });
  app.post('/api/v1/admin/chat/messages/:id/delete', async (request, reply) => {
    const c = await checked(m, request, reply, null);
    if (c === null) return reply;
    return answer(reply, await deleteAs(m, c.actor, c.id));
  });
  registerSanctions(app, m);
  registerRoomsAndLists(app, m);
}

function registerSanctions(app: FastifyInstance, m: Moderation): void {
  app.get('/api/v1/admin/chat/sanctions', async (request, reply) => {
    if ((await permitted(request, reply, 'chat.moderate')) === null) return reply;
    if (!(await builtinOr409(m.chat, reply))) return reply;
    return { items: await m.chat.sanctions.list() };
  });
  app.post('/api/v1/admin/chat/sanctions', async (request, reply) => {
    const actor = await permitted(request, reply, 'chat.moderate');
    if (actor === null || !(await builtinOr409(m.chat, reply))) return reply;
    const body = ChatSanctionBody.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ code: 'VALIDATION_FAILED' });
    const outcome = await sanctionAs(m, actor, body.data);
    return outcome.ok ? reply.status(201).send(outcome.value) : answer(reply, outcome);
  });
  app.post('/api/v1/admin/chat/sanctions/:id/lift', async (request, reply) => {
    const c = await checked(m, request, reply, null);
    if (c === null) return reply;
    return answer(reply, await liftAs(m, c.actor, c.id));
  });
}

function registerRoomsAndLists(app: FastifyInstance, m: Moderation): void {
  app.patch('/api/v1/admin/chat/rooms/:id', async (request, reply) => {
    const c = await checked(m, request, reply, ChatRoomPatchBody);
    if (c === null || c.body === null) return reply;
    return answer(reply, await patchRoomAs(m, c.actor, c.id, c.body));
  });
  // The word lists work whatever the provider: they can be set up before the chat is on.
  app.get('/api/v1/admin/profanity-lists', async (request, reply) => {
    if ((await permitted(request, reply, 'chat.moderate')) === null) return reply;
    return { lists: await wordLists(m.chat.pool) };
  });
  app.put('/api/v1/admin/profanity-lists/:id', async (request, reply) => {
    const actor = await permitted(request, reply, 'chat.moderate');
    if (actor === null) return reply;
    const params = listParams.safeParse(request.params);
    if (!params.success) return reply.status(404).send({ code: 'NOT_FOUND' });
    const body = WordListBody.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ code: 'VALIDATION_FAILED' });
    await putListAs(m, actor, params.data.id, body.data.terms);
    return { lists: await wordLists(m.chat.pool) };
  });
}
