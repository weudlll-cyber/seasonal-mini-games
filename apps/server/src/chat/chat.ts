/**
 * @file   apps/server/src/chat/chat.ts
 * @module server/chat
 * @brief  The builtin chat of one server: rooms for a viewer, history, sending, events out.
 *
 * Responsibility: the provider in force (./provider); who reads a room (anyone who may watch,
 *                 and staff with chat.moderate; guests read) and who writes it (the lobby: any
 *                 account with chat.send; a match room: the match's players and host, and
 *                 staff with chat.moderate); a room as its viewer sees it (may they send now,
 *                 may they moderate); the history; a message through ./pipeline, then out to
 *                 every listener (the gateway sends it to `chat:<roomId>`); system lines; the
 *                 word lists kept in memory until a moderator changes one. Moderation lives in
 *                 ./moderation and uses `emit`, `sanctions` and `dropWordLists`. `createChat`
 *                 also posts the round-end lines (./roundLines).
 * Depends on:     @smg/application (SettingsService), @smg/contracts (views), ../db/pool,
 *                 ../round/rounds (types), ./filter, ./pipeline, ./provider, ./reports,
 *                 ./roundLines, ./rooms, ./sanctions, ./spam
 * Used by:        ../http/app, ../http/routes/chat*, ../realtime/*, ./moderation, ./roundLines
 * Spec:           docs/spec/07-integration.md §2; Bingo 06 §7, Bingo 03 §12
 */
import type { SettingsService } from '@smg/application';
import type {
  ChatConfigView,
  ChatEventView,
  ChatMessageView,
  ChatProvider,
  ChatRoomView,
} from '@smg/contracts';

import type { DbPool } from '../db/pool.js';
import type { Rounds } from '../round/rounds.js';
import type { WordLists } from './filter.js';
import { sendMessage, type SendResult, type Viewer } from './pipeline.js';
import { chatConfig, chatRules } from './provider.js';
import { wordLists } from './reports.js';
import { postRoundLines } from './roundLines.js';
import {
  history,
  insertMessage,
  lobbyRoom,
  matchRoom,
  roomBase,
  roomById,
  type RoomRow,
} from './rooms.js';
import { Sanctions } from './sanctions.js';
import { SpamGuard } from './spam.js';

type Listener = (roomId: string, event: ChatEventView) => void;

export class Chat {
  readonly sanctions: Sanctions;
  private readonly spam: SpamGuard;
  private lists: WordLists | null = null;
  private readonly listeners: Listener[] = [];

  constructor(
    readonly pool: DbPool,
    private readonly settings: SettingsService,
  ) {
    this.sanctions = new Sanctions(pool);
    this.spam = new SpamGuard();
  }

  config(): Promise<ChatConfigView> {
    return chatConfig(this.settings);
  }

  async provider(): Promise<ChatProvider> {
    return (await this.config()).provider;
  }

  onEvent(listener: Listener): void {
    this.listeners.push(listener);
  }

  emit(roomId: string, event: ChatEventView): void {
    for (const l of this.listeners) l(roomId, event);
  }

  mayRead(viewer: Viewer): boolean {
    return ['match.watch', 'chat.moderate'].some((p) => viewer.permissions.includes(p));
  }

  async mayWrite(room: RoomRow, viewer: Viewer): Promise<boolean> {
    const id = viewer.accountId;
    if (id === null || !viewer.permissions.includes('chat.send')) return false;
    if (room.kind === 'lobby' || viewer.permissions.includes('chat.moderate')) return true;
    if (room.hostId === id) return true;
    const r = await this.pool.query(
      `SELECT 1 FROM smg.match_players WHERE match_id = $1 AND account_id = $2 AND state = 'active'`,
      [room.matchId, id],
    );
    return r.rowCount === 1;
  }

  room(id: string): Promise<RoomRow | null> {
    return roomById(this.pool, id);
  }

  lobby(): Promise<RoomRow> {
    return lobbyRoom(this.pool);
  }

  async ofMatch(matchId: string): Promise<RoomRow> {
    return matchRoom(this.pool, matchId, (await chatRules(this.settings)).slowModeDefault);
  }

  async view(room: RoomRow, viewer: Viewer): Promise<ChatRoomView> {
    const canModerate = viewer.permissions.includes('chat.moderate');
    const writes = await this.mayWrite(room, viewer);
    const sanctioned =
      viewer.accountId === null ? null : await this.sanctions.against(viewer.accountId, room.id);
    const canSend = writes && sanctioned === null && (!room.locked || canModerate);
    return { ...roomBase(room), canSend, canModerate };
  }

  history(roomId: string, before: number | null): Promise<ChatMessageView[]> {
    return history(this.pool, roomId, before);
  }

  async send(viewer: Viewer, raw: unknown): Promise<SendResult> {
    if ((await this.provider()) !== 'builtin') return { ok: false, code: 'CHAT_DISABLED' };
    const result = await sendMessage(
      {
        pool: this.pool,
        sanctions: this.sanctions,
        spam: this.spam,
        rules: () => chatRules(this.settings),
        lists: () => this.wordLists(),
        room: (id) => this.room(id),
        mayWrite: (room, v) => this.mayWrite(room, v),
      },
      viewer,
      raw,
    );
    if (result.ok) this.emit(result.message.roomId, { type: 'message', message: result.message });
    return result;
  }

  // A line without author (a round's end), delivered like a message.
  async systemLine(roomId: string, text: string): Promise<void> {
    const message = await insertMessage(this.pool, {
      roomId,
      accountId: null,
      body: text,
      shown: text,
      flags: [],
    });
    this.emit(roomId, { type: 'message', message });
  }

  // A moderator changed a list: the next message reads them again.
  dropWordLists(): void {
    this.lists = null;
  }

  private async wordLists(): Promise<WordLists> {
    if (this.lists !== null) return this.lists;
    const rows = await wordLists(this.pool);
    const of = (id: keyof WordLists) => rows.find((r) => r.id === id)?.terms ?? [];
    this.lists = { block: of('block'), mask: of('mask'), flag: of('flag') };
    return this.lists;
  }
}

// The chat of this server, with a system line in the match room at every round's end.
export function createChat(pool: DbPool, settings: SettingsService, rounds: Rounds): Chat {
  const chat = new Chat(pool, settings);
  postRoundLines(rounds, chat);
  return chat;
}
