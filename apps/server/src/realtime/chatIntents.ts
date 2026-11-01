/**
 * @file   apps/server/src/realtime/chatIntents.ts
 * @module server/realtime
 * @brief  The chat's socket intents: chat.join, chat.leave, chat.send.
 *
 * Responsibility: `chat.join { roomId }` for anyone who may read the room (match.watch or
 *                 chat.moderate; guests read): the socket joins `chat:<roomId>` (at most 4
 *                 chat rooms: the lobby and three matches) and gets the room as it sees it
 *                 with the last 50 messages (Bingo 06 §7); `chat.leave { roomId }`;
 *                 `chat.send { roomId, text }` through the send pipeline, answered with the
 *                 stored message or a plain refusal code (with `until` for a mute, slow mode
 *                 or the rate limit). Everything but chat.leave answers CHAT_DISABLED unless
 *                 the provider is `builtin`. Events reach the room as `chat` frames (./gateway).
 * Depends on:     zod, ../chat/*, ./intents (types)
 * Used by:        ./intents
 * Spec:           docs/spec/07-integration.md §2; Bingo 06 §7
 */
import { z } from 'zod';

import type { Viewer } from '../chat/pipeline.js';
import type { IntentContext } from './intents.js';

const roomData = z.object({ roomId: z.uuid() });
const MAX_CHAT_ROOMS = 4;

type ChatAnswer =
  | { readonly ok: true; readonly data?: unknown }
  | { readonly ok: false; readonly code: string; readonly until?: number };

export type ChatIntent = 'chat.join' | 'chat.leave' | 'chat.send';

export async function chatIntent(
  ctx: IntentContext,
  t: ChatIntent,
  data: unknown,
): Promise<ChatAnswer> {
  const { chat } = ctx.deps;
  const viewer: Viewer = ctx.data.session;
  if (t === 'chat.leave') {
    const roomId = roomData.parse(data).roomId;
    ctx.data.chats.delete(roomId);
    await ctx.socket.leave(`chat:${roomId}`);
    return { ok: true };
  }
  if (t === 'chat.send') {
    // The pipeline checks the provider, the shape, the room and the sender.
    const sent = await chat.send(viewer, data);
    return sent.ok ? { ok: true, data: { message: sent.message } } : sent;
  }
  if (!chat.mayRead(viewer)) return { ok: false, code: 'FORBIDDEN' };
  if ((await chat.provider()) !== 'builtin') return { ok: false, code: 'CHAT_DISABLED' };
  const room = await chat.room(roomData.parse(data).roomId);
  if (room === null) return { ok: false, code: 'NOT_FOUND' };
  if (!ctx.data.chats.has(room.id) && ctx.data.chats.size >= MAX_CHAT_ROOMS) {
    return { ok: false, code: 'TOO_MANY_ROOMS' };
  }
  ctx.data.chats.add(room.id);
  await ctx.socket.join(`chat:${room.id}`);
  const [view, messages] = await Promise.all([
    chat.view(room, viewer),
    chat.history(room.id, null),
  ]);
  return { ok: true, data: { room: view, messages } };
}
