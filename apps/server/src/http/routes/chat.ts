/**
 * @file   apps/server/src/http/routes/chat.ts
 * @module server/http
 * @brief  The chat over HTTP: which panel to show, a room for its viewer, history, reports.
 *
 * Responsibility: GET /chat/config for anyone (07 §2: the provider and, for hostEmbed, the
 *                 host room's address); with the provider `builtin` the lobby room and a
 *                 match's room as the viewer sees them, a room's history (the newest 50
 *                 before `before`, oldest first) for anyone who may watch (guests read), and a
 *                 report of a message by an account with chat.send; with `none` or `hostEmbed`
 *                 those answer 409 CHAT_DISABLED. Sending goes over the socket (chat.send).
 *                 Registers the moderation routes too (./chatModeration).
 * Depends on:     fastify, zod, @smg/application (AuditLog), @smg/contracts (ChatReportBody),
 *                 ../../chat/*, ../../match/matches, ./chatModeration
 * Used by:        ../app
 * Spec:           docs/spec/07-integration.md §2; Bingo 05 §2.5, Bingo 06 §7
 */
import type { AuditLog } from '@smg/application';
import { ChatReportBody } from '@smg/contracts';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import type { Chat } from '../../chat/chat.js';
import type { Viewer } from '../../chat/pipeline.js';
import { addReport } from '../../chat/reports.js';
import { messageById, type RoomRow } from '../../chat/rooms.js';
import { findMatch } from '../../match/matches.js';
import { builtinOr409, registerChatModeration } from './chatModeration.js';

const roomParams = z.object({ roomId: z.uuid() });
const codeParams = z.object({ code: z.string().min(1).max(16) });
const idParams = z.object({ id: z.uuid() });
const beforeQuery = z.object({ before: z.coerce.number().int().positive().optional() });

interface ChatRouteDeps {
  readonly chat: Chat;
  readonly audit: AuditLog;
}

// The viewer who may read chat rooms, or null after a 401/403 answer.
async function reader(chat: Chat, request: FastifyRequest, reply: FastifyReply) {
  const s = request.session;
  if (s === null) {
    await reply.status(401).send({ code: 'SIGN_IN_REQUIRED' });
    return null;
  }
  const viewer: Viewer = { accountId: s.accountId, permissions: s.permissions };
  if (!chat.mayRead(viewer)) {
    await reply.status(403).send({ code: 'FORBIDDEN' });
    return null;
  }
  return (await builtinOr409(chat, reply)) ? viewer : null;
}

export function registerChatRoutes(app: FastifyInstance, deps: ChatRouteDeps): void {
  const { chat } = deps;
  app.get('/api/v1/chat/config', () => chat.config());

  app.get('/api/v1/chat/rooms/lobby', async (request, reply) => {
    const viewer = await reader(chat, request, reply);
    if (viewer === null) return reply;
    return chat.view(await chat.lobby(), viewer);
  });

  app.get('/api/v1/chat/rooms/match/:code', async (request, reply) => {
    const viewer = await reader(chat, request, reply);
    if (viewer === null) return reply;
    const params = codeParams.safeParse(request.params);
    const match = params.success ? await findMatch(chat.pool, params.data.code) : null;
    if (match === null) return reply.status(404).send({ code: 'NOT_FOUND' });
    return chat.view(await chat.ofMatch(match.id), viewer);
  });

  app.get('/api/v1/chat/rooms/:roomId/messages', async (request, reply) => {
    const viewer = await reader(chat, request, reply);
    if (viewer === null) return reply;
    const params = roomParams.safeParse(request.params);
    const room: RoomRow | null = params.success ? await chat.room(params.data.roomId) : null;
    if (room === null) return reply.status(404).send({ code: 'NOT_FOUND' });
    const query = beforeQuery.safeParse(request.query);
    if (!query.success) return reply.status(400).send({ code: 'VALIDATION_FAILED' });
    return { messages: await chat.history(room.id, query.data.before ?? null) };
  });

  registerReport(app, chat);
  registerChatModeration(app, deps);
}

function registerReport(app: FastifyInstance, chat: Chat): void {
  app.post('/api/v1/chat/messages/:id/report', async (request, reply) => {
    const s = request.session;
    if (s === null || s.accountId === null) {
      return reply.status(401).send({ code: 'SIGN_IN_REQUIRED' });
    }
    if (!s.permissions.includes('chat.send')) return reply.status(403).send({ code: 'FORBIDDEN' });
    if (!(await builtinOr409(chat, reply))) return reply;
    const body = ChatReportBody.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ code: 'VALIDATION_FAILED' });
    const params = idParams.safeParse(request.params);
    const found = params.success ? await messageById(chat.pool, params.data.id) : null;
    // A system line or a deleted message is nothing to report.
    if (found === null || found.message.kind === 'system' || found.message.text === null) {
      return reply.status(404).send({ code: 'NOT_FOUND' });
    }
    const id = await addReport(chat.pool, found.message.id, s.accountId, body.data.reason);
    if (id === null) return reply.status(409).send({ code: 'ALREADY_REPORTED' });
    return reply.status(201).send({ id });
  });
}
