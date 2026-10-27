/**
 * @file   apps/server/test/chatKit.ts
 * @module server/test
 * @brief  Helpers of the chat suite: settings changes, sockets in a chat room, waiting.
 *
 * Responsibility: change a settings document as the admin (reading its version first) and
 *                 give back a way to restore it; a guest session; a socket that joined a chat
 *                 room, with the chat events it received; send a chat message; wait until a
 *                 condition holds (at most 6 s); a PATCH as the admin; remove the chat rows a
 *                 suite made (the lobby room stays, it belongs to the migration).
 * Depends on:     socket.io-client (types), ./session, ./socketKit
 * Used by:        ./chat.integration.test
 * Spec:           docs/spec/09-testing-strategy.md §2; Bingo 12 §7
 */
import type { ChatEventView } from '@smg/contracts';
import type { Socket } from 'socket.io-client';

import type { Client } from './session.js';
import type { IntentAnswer, SocketKit } from './socketKit.js';

type Overrides = Record<string, { value: unknown }>;

// Sets the overrides of a document; the returned function puts the old ones back.
export async function setSettings(
  admin: Client,
  doc: string,
  overrides: Overrides,
): Promise<() => Promise<void>> {
  const read = async () =>
    (await admin.get(`/api/v1/admin/settings/${doc}`)).json<{
      version: number;
      overrides: Overrides;
    }>();
  const before = await read();
  const saved = await admin.put(`/api/v1/admin/settings/${doc}`, {
    version: before.version,
    overrides: { ...before.overrides, ...overrides },
  });
  if (saved.statusCode !== 200) throw new Error(`settings not saved: ${saved.body}`);
  return async () => {
    const now = await read();
    await admin.put(`/api/v1/admin/settings/${doc}`, {
      version: now.version,
      overrides: before.overrides,
    });
  };
}

export async function guestCookie(kit: SocketKit): Promise<string> {
  const r = await kit.harness.built.fastify.inject({
    method: 'POST',
    url: '/api/v1/auth/guest',
    payload: {},
  });
  return `smg_session=${r.cookies.find((c) => c.name === 'smg_session')?.value ?? ''}`;
}

export interface InRoom {
  readonly socket: Socket;
  readonly joined: IntentAnswer;
  events(): ChatEventView[];
}

export async function inRoom(kit: SocketKit, cookie: string, roomId: string): Promise<InRoom> {
  const socket = kit.open(cookie);
  if ((await kit.connected(socket)) !== 'ok') throw new Error('socket refused');
  const joined = await kit.send(socket, 'chat.join', { roomId });
  return {
    socket,
    joined,
    events: () =>
      kit
        .frames(socket)
        .flatMap((f) => ('chat' in (f as object) ? [(f as { chat: ChatEventView }).chat] : [])),
  };
}

export function say(kit: SocketKit, who: InRoom, roomId: string, text: string) {
  return kit.send(who.socket, 'chat.send', { roomId, text });
}

export async function until(check: () => boolean | Promise<boolean>): Promise<void> {
  for (let tries = 0; tries < 60; tries += 1) {
    if (await check()) return;
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error('condition not met in time');
}

export function patchAs(kit: SocketKit, admin: Client, url: string, body: object) {
  return kit.harness.built.fastify.inject({
    method: 'PATCH',
    url,
    payload: body,
    headers: { cookie: admin.cookie, 'x-csrf-token': admin.csrf },
  });
}

export async function removeChatRows(kit: SocketKit): Promise<void> {
  const pool = kit.harness.pool;
  await pool.query('DELETE FROM smg.chat_reports');
  await pool.query('DELETE FROM smg.chat_sanctions');
  await pool.query('DELETE FROM smg.chat_messages');
  await pool.query("DELETE FROM smg.chat_rooms WHERE kind = 'match'");
  await pool.query("UPDATE smg.profanity_lists SET terms = '{}'");
  await pool.query('UPDATE smg.chat_rooms SET locked = false, slow_mode_seconds = 0');
}
