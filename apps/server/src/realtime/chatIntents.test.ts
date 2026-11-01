/**
 * @file   apps/server/src/realtime/chatIntents.test.ts
 * @module server/realtime
 * @brief  The per-socket count of chat rooms: at most four at once, and a left room frees its place.
 *
 * Responsibility: a socket joins up to four chat rooms (the lobby and three matches); a fifth
 *                 is refused with TOO_MANY_ROOMS; joining a room it already holds again does not
 *                 count twice; after `chat.leave` the next room fits. The chat service and the
 *                 socket are stand-ins.
 * Depends on:     vitest, ./chatIntents, ./intents (types)
 * Spec:           docs/spec/07-integration.md §2; Bingo 06 §7
 */
import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { chatIntent } from './chatIntents.js';
import type { IntentContext } from './intents.js';

function socketContext() {
  const chats = new Set<string>();
  const chat = {
    mayRead: () => true,
    provider: () => Promise.resolve('builtin'),
    room: (id: string) => Promise.resolve({ id }),
    view: () => Promise.resolve({}),
    history: () => Promise.resolve([]),
  };
  const ctx = {
    socket: { join: () => Promise.resolve(), leave: () => Promise.resolve() },
    data: { session: { accountId: 'a', permissions: ['match.watch'] }, chats },
    deps: { chat },
  } as unknown as IntentContext;
  return { ctx, chats };
}

describe('the chat rooms of one socket', () => {
  it('holds four at most, counts a room once, and frees a place on leaving', async () => {
    const { ctx, chats } = socketContext();
    const rooms = Array.from({ length: 5 }, () => randomUUID());
    for (const roomId of rooms.slice(0, 4)) {
      expect((await chatIntent(ctx, 'chat.join', { roomId })).ok).toBe(true);
    }
    expect(await chatIntent(ctx, 'chat.join', { roomId: rooms[4] })).toEqual({
      ok: false,
      code: 'TOO_MANY_ROOMS',
    });
    expect((await chatIntent(ctx, 'chat.join', { roomId: rooms[0] })).ok).toBe(true);
    expect(chats.size).toBe(4);
    await chatIntent(ctx, 'chat.leave', { roomId: rooms[1] });
    expect((await chatIntent(ctx, 'chat.join', { roomId: rooms[4] })).ok).toBe(true);
    expect(chats.size).toBe(4);
  });
});
