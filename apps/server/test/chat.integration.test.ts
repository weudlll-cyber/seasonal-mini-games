/**
 * @file   apps/server/test/chat.integration.test.ts
 * @module server/test
 * @brief  The builtin chat with Postgres and the gateway: rooms, sending, filters, limits,
 *         moderation, the round-end line, and the three providers.
 *
 * Responsibility: two players of a match chat over the socket; a guest reads and cannot send;
 *                 the block, mask and flag lists (a flagged message enters the queue); the
 *                 rate limit and duplicates; a report resolved by a moderator; a mute refuses
 *                 the next message and ends by expiry or lifting; a ban refuses; a deleted
 *                 message and a locked room reach the watchers; a round's end writes its
 *                 system line; with the provider `none` or `hostEmbed` the routes and intents
 *                 answer CHAT_DISABLED, /chat/config names the provider and the CSP frames the
 *                 host chat. Settings are restored, the match aborted and the chat rows removed.
 * Depends on:     vitest, ./chatKit, ./harness, ./session, ./socketKit
 * Spec:           docs/spec/07-integration.md §2; Bingo 06 §7, Bingo 03 §12; docs/spec/09-testing-strategy.md §2
 */
import type { ChatConfigView, ChatReportView, ChatRoomView } from '@smg/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  guestCookie,
  inRoom,
  patchAs,
  removeChatRows,
  say,
  setSettings,
  until,
  type InRoom,
} from './chatKit.js';
import { SUITE_TIMEOUT_MS } from './harness.js';
import { signIn, type Client } from './session.js';
import { startSocketKit, type SocketKit } from './socketKit.js';

let kit: SocketKit;
let admin: Client;
let code: string;
let room: ChatRoomView;
let p1: InRoom;
let p2: InRoom;
let p3: InRoom;
const restore: (() => Promise<void>)[] = [];

beforeAll(async () => {
  kit = await startSocketKit();
  admin = await signIn(kit.harness.built.fastify, 'admin');
  // Dev accounts are new: without this they would wait 10 s between two messages.
  restore.push(
    await setSettings(admin, 'chat', {
      'chat.newAccountSlowModeHours': { value: 0 },
      'chat.rateMessages': { value: 50 },
    }),
  );
  code = await kit.openMatch(['player-1', 'player-2']);
  room = (await kit.clients['player-1'].get(`/api/v1/chat/rooms/match/${code}`)).json();
  p1 = await inRoom(kit, kit.clients['player-1'].cookie, room.id);
  p2 = await inRoom(kit, kit.clients['player-2'].cookie, room.id);
  p3 = await inRoom(kit, kit.clients['player-3'].cookie, room.id);
}, SUITE_TIMEOUT_MS);

afterAll(async () => {
  for (const r of restore.reverse()) await r();
  await kit.clients.host.post(`/api/v1/matches/${code}/abort`, { reason: 'test done' });
  await removeChatRows(kit);
  await kit.close();
});

const messages = (who: InRoom) =>
  who.events().flatMap((e) => (e.type === 'message' ? [e.message] : []));

describe('the match room', () => {
  it('lets the match players write, watchers read, and delivers to everyone in the room', async () => {
    expect(room).toMatchObject({
      kind: 'match',
      matchCode: code,
      canSend: true,
      canModerate: false,
    });
    expect(p1.joined).toMatchObject({ ok: true, data: { messages: [] } });
    const sent = await say(kit, p1, room.id, 'Good luck all');
    expect(sent).toMatchObject({ ok: true, data: { message: { author: 'dev-player-1' } } });
    await until(() => messages(p2).some((m) => m.text === 'Good luck all'));
    // player-3 is not in the match: it reads, but may not write.
    expect(messages(p3).some((m) => m.text === 'Good luck all')).toBe(true);
    expect(await say(kit, p3, room.id, 'hi')).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    const page = await kit.clients['player-3'].get(`/api/v1/chat/rooms/${room.id}/messages`);
    expect(page.json<{ messages: { text: string }[] }>().messages.at(-1)?.text).toBe(
      'Good luck all',
    );
  });

  it('lets a guest read the lobby but not send', async () => {
    const cookie = await guestCookie(kit);
    const lobby = await kit.harness.built.fastify.inject({
      method: 'GET',
      url: '/api/v1/chat/rooms/lobby',
      headers: { cookie },
    });
    const view = lobby.json<ChatRoomView>();
    expect(view).toMatchObject({ kind: 'lobby', canSend: false });
    const guest = await inRoom(kit, cookie, view.id);
    expect(guest.joined.ok).toBe(true);
    expect(await say(kit, guest, view.id, 'hello')).toMatchObject({ code: 'SIGN_IN_REQUIRED' });
    guest.socket.disconnect();
  });
});

describe('the filters and limits', () => {
  it('blocks, masks and flags by the word lists; a flagged message enters the queue', async () => {
    for (const [id, terms] of [
      ['block', ['rotten']],
      ['mask', ['darn']],
      ['flag', ['outside']],
    ] as const) {
      expect((await admin.put(`/api/v1/admin/profanity-lists/${id}`, { terms })).statusCode).toBe(
        200,
      );
    }
    expect(await say(kit, p1, room.id, 'you are R0TT3N')).toMatchObject({ code: 'CHAT_FILTERED' });
    expect(await say(kit, p1, room.id, 'darn it')).toMatchObject({
      ok: true,
      data: { message: { text: '*** it' } },
    });
    expect((await say(kit, p1, room.id, 'meet me outside')).ok).toBe(true);
    const queue = (await admin.get('/api/v1/admin/moderation/reports')).json<{
      items: ChatReportView[];
    }>().items;
    expect(queue.find((r) => r.message.text === 'meet me outside')?.reporter).toBeNull();
    expect(await say(kit, p1, room.id, 'see www.cheats.example')).toMatchObject({
      code: 'CHAT_LINKS_OFF',
    });
  });

  it('refuses the third copy of a text and sends past the rate limit', async () => {
    for (let i = 0; i < 2; i += 1) expect((await say(kit, p2, room.id, 'again')).ok).toBe(true);
    expect(await say(kit, p2, room.id, 'AGAIN')).toMatchObject({ code: 'CHAT_DUPLICATE' });
    const back = await setSettings(admin, 'chat', { 'chat.rateMessages': { value: 2 } });
    try {
      expect((await say(kit, p2, room.id, 'one')).ok).toBe(true);
      expect((await say(kit, p2, room.id, 'two')).ok).toBe(true);
      const third = await say(kit, p2, room.id, 'three');
      expect(third).toMatchObject({ ok: false, code: 'CHAT_RATE_LIMITED' });
      expect(third.until).toBeGreaterThan(Date.now());
    } finally {
      await back();
    }
  });
});

const sanction = (displayName: string, kind: 'mute' | 'ban', minutes: number | null) =>
  admin.post('/api/v1/admin/chat/sanctions', {
    displayName,
    kind,
    scope: 'global',
    minutes,
    reason: 'integration test',
  });

describe('reports and sanctions', () => {
  it('takes a report into the queue and lets a moderator resolve it', async () => {
    const id = messages(p2).find((m) => m.text === 'Good luck all')?.id ?? '';
    const report = await kit.clients['player-2'].post(`/api/v1/chat/messages/${id}/report`, {
      reason: 'testing',
    });
    expect(report.statusCode).toBe(201);
    const again = await kit.clients['player-2'].post(`/api/v1/chat/messages/${id}/report`, {
      reason: 'testing',
    });
    expect(again.json()).toMatchObject({ code: 'ALREADY_REPORTED' });
    const reportId = report.json<{ id: string }>().id;
    const resolved = await admin.post(`/api/v1/admin/moderation/reports/${reportId}/resolve`, {
      status: 'dismissed',
    });
    expect(resolved.statusCode).toBe(200);
    const dismissed = await admin.get('/api/v1/admin/moderation/reports?status=dismissed');
    expect(dismissed.json<{ items: { id: string }[] }>().items.map((r) => r.id)).toContain(
      reportId,
    );
    expect((await admin.get('/api/v1/admin/moderation/reports?status=nope')).statusCode).toBe(400);
  });

  it('refuses a muted player at once, until the mute is lifted or expires', async () => {
    const muted = await sanction('dev-player-1', 'mute', 5);
    expect(muted.statusCode).toBe(201);
    expect(await say(kit, p1, room.id, 'still here?')).toMatchObject({ code: 'CHAT_MUTED' });
    const view = await kit.clients['player-1'].get(`/api/v1/chat/rooms/match/${code}`);
    expect(view.json<ChatRoomView>().canSend).toBe(false);
    const id = muted.json<{ id: string }>().id;
    expect((await admin.post(`/api/v1/admin/chat/sanctions/${id}/lift`, {})).statusCode).toBe(200);
    expect((await say(kit, p1, room.id, 'back again')).ok).toBe(true);
    // A mute that runs out: refused while it lasts, then through without anyone lifting it.
    const short = (await sanction('dev-player-1', 'mute', 1)).json<{ id: string }>().id;
    await kit.harness.pool.query(
      "UPDATE smg.chat_sanctions SET expires_at = now() + interval '1500 milliseconds' WHERE id = $1",
      [short],
    );
    expect(await say(kit, p1, room.id, 'and now?')).toMatchObject({ code: 'CHAT_MUTED' });
    await new Promise((done) => setTimeout(done, 1_600));
    expect((await say(kit, p1, room.id, 'and now?')).ok).toBe(true);
  });

  it('refuses a banned player', async () => {
    const banned = await sanction('dev-player-2', 'ban', null);
    expect(banned.statusCode).toBe(201);
    expect(await say(kit, p2, room.id, 'hello?')).toMatchObject({ code: 'CHAT_BANNED' });
    const list = (await admin.get('/api/v1/admin/chat/sanctions')).json<{
      items: { id: string; kind: string }[];
    }>().items;
    expect(list[0]).toMatchObject({ kind: 'ban' });
    await admin.post(`/api/v1/admin/chat/sanctions/${banned.json<{ id: string }>().id}/lift`, {});
    expect(await sanction('dev-player-1', 'ban', 5)).toMatchObject({ statusCode: 400 });
  });
});

describe('deletion and lock', () => {
  it('shows a deletion and a locked room to every watcher at once', async () => {
    const sent = await say(kit, p1, room.id, 'delete me');
    const id = (sent.data as { message: { id: string } }).message.id;
    expect((await admin.post(`/api/v1/admin/chat/messages/${id}/delete`, {})).statusCode).toBe(200);
    await until(() => p3.events().some((e) => e.type === 'deleted' && e.messageId === id));
    const page = await kit.clients['player-3'].get(`/api/v1/chat/rooms/${room.id}/messages`);
    const gone = page.json<{ messages: { id: string; text: string | null }[] }>().messages;
    expect(gone.find((m) => m.id === id)?.text).toBeNull();
    const url = `/api/v1/admin/chat/rooms/${room.id}`;
    expect((await patchAs(kit, admin, url, { slowModeS: 0, locked: true })).statusCode).toBe(200);
    await until(() => p2.events().some((e) => e.type === 'room' && e.room.locked));
    expect(await say(kit, p1, room.id, 'locked?')).toMatchObject({ code: 'CHAT_LOCKED' });
    await patchAs(kit, admin, url, { slowModeS: 0, locked: false });
  });
});

describe('the round-end line', () => {
  it('writes one system line naming the winner when a round ends', async () => {
    const watchers = await Promise.all(
      (['host', 'player-1', 'player-2'] as const).map(async (who) => {
        const s = kit.open(kit.clients[who].cookie);
        await kit.connected(s);
        await kit.send(s, 'match.watch', { code });
        return s;
      }),
    );
    const round = await kit.clients.host.post(`/api/v1/matches/${code}/rounds`, {
      settings: { 'round.countdownS': 3, 'round.specialOn': false },
      season: 'spring',
      startNow: true,
    });
    const id = round.json<{ id: string }>().id;
    const secrets = await kit.secretsOf(id);
    const value = secrets.mode === 'shared' ? secrets.value : 0;
    const winner = watchers[1];
    if (winner === undefined) throw new Error('no winner socket');
    await until(async () => (await kit.send(winner, 'guess', { roundId: id, value })).ok);
    const line = (m: { kind: string; text: string | null }) =>
      m.kind === 'system' && m.text === 'Round 1: dev-player-1 found it first';
    await until(() => messages(p3).some(line));
    for (const s of watchers) s.disconnect();
  });
});

describe('the provider', () => {
  const config = async () =>
    (await kit.clients['player-1'].get('/api/v1/chat/config')).json<ChatConfigView>();

  it('answers CHAT_DISABLED with none and hostEmbed, and frames the host chat', async () => {
    const back = await setSettings(admin, 'integrations', {
      'integrations.chatProvider': { value: 'none' },
    });
    try {
      expect(await config()).toEqual({ provider: 'none', hostChatUrl: null });
      const lobby = await kit.clients['player-1'].get('/api/v1/chat/rooms/lobby');
      expect(lobby.json()).toMatchObject({ code: 'CHAT_DISABLED' });
      expect(lobby.statusCode).toBe(409);
      expect(await say(kit, p1, room.id, 'anyone?')).toMatchObject({ code: 'CHAT_DISABLED' });
      expect(await kit.send(p1.socket, 'chat.join', { roomId: room.id })).toMatchObject({
        code: 'CHAT_DISABLED',
      });
      expect((await admin.get('/api/v1/admin/profanity-lists')).statusCode).toBe(200);
      expect((await admin.get('/api/v1/admin/chat/sanctions')).statusCode).toBe(409);
      const url = 'https://chat.example/embed/chat?room=mini-games';
      // `back` puts the overrides from before 'none' back, so this one needs no own restore.
      await setSettings(admin, 'integrations', {
        'integrations.chatProvider': { value: 'hostEmbed' },
        'integrations.hostChatUrl': { value: url },
      });
      expect(await config()).toEqual({ provider: 'hostEmbed', hostChatUrl: url });
      expect((await kit.clients['player-1'].get('/api/v1/chat/rooms/lobby')).statusCode).toBe(409);
      await until(async () => {
        const csp = (await kit.clients['player-1'].get('/api/v1/chat/config')).headers[
          'content-security-policy'
        ];
        return String(csp).includes('frame-src https://chat.example');
      });
    } finally {
      await back();
    }
    expect(await config()).toEqual({ provider: 'builtin', hostChatUrl: null });
    expect((await say(kit, p1, room.id, 'back on')).ok).toBe(true);
  });
});
