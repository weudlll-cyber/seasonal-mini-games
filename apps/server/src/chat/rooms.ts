/**
 * @file   apps/server/src/chat/rooms.ts
 * @module server/chat
 * @brief  Chat rooms and messages in PostgreSQL: the lobby, a match's room, history, deletion.
 *
 * Responsibility: the one lobby room; a match's room, made with its first use and the slow
 *                 mode of `chat.slowModeDefault`; a room by id with its match's code and host;
 *                 a room's slow mode and lock; a message written (player or system line) and
 *                 read back as the client sees it (author by display name, no text once
 *                 deleted); the newest 50 messages before a time, oldest first; a moderator's
 *                 soft delete; the retention purge of old messages with their reports.
 * Depends on:     @smg/contracts (views), ../db/pool
 * Used by:        ./chat, ./moderation, ./retention, ./pipeline, ../http/routes/chat
 * Spec:           Bingo 04 §3.5, Bingo 06 §7
 */
import type { ChatMessageView, ChatRoomView } from '@smg/contracts';

import type { DbPool } from '../db/pool.js';

export const PAGE = 50;

export type RoomBase = Omit<ChatRoomView, 'canSend' | 'canModerate'>;

export interface RoomRow extends RoomBase {
  readonly matchId: string | null;
  readonly hostId: string | null;
}

interface RoomSql {
  id: string;
  kind: 'lobby' | 'match';
  match_id: string | null;
  code: string | null;
  created_by: string | null;
  slow_mode_seconds: number;
  locked: boolean;
}

const ROOM = `SELECT r.id::text, r.kind, r.match_id::text, m.code, m.created_by::text,
  r.slow_mode_seconds, r.locked FROM smg.chat_rooms r LEFT JOIN smg.matches m ON m.id = r.match_id`;

const toRoom = (r: RoomSql): RoomRow => ({
  id: r.id,
  kind: r.kind,
  matchCode: r.code,
  slowModeS: r.slow_mode_seconds,
  locked: r.locked,
  matchId: r.match_id,
  hostId: r.created_by,
});

export const roomBase = (r: RoomRow): RoomBase => ({
  id: r.id,
  kind: r.kind,
  matchCode: r.matchCode,
  slowModeS: r.slowModeS,
  locked: r.locked,
});

export async function roomById(pool: DbPool, id: string): Promise<RoomRow | null> {
  const r = await pool.query<RoomSql>(`${ROOM} WHERE r.id = $1`, [id]);
  return r.rows[0] === undefined ? null : toRoom(r.rows[0]);
}

export async function lobbyRoom(pool: DbPool): Promise<RoomRow> {
  const r = await pool.query<RoomSql>(`${ROOM} WHERE r.kind = 'lobby'`);
  if (r.rows[0] === undefined) throw new Error('the lobby chat room is missing');
  return toRoom(r.rows[0]);
}

// A match's room, made on first use with the default slow mode of a new room.
export async function matchRoom(
  pool: DbPool,
  matchId: string,
  slowModeS: number,
): Promise<RoomRow> {
  await pool.query(
    `INSERT INTO smg.chat_rooms (kind, match_id, slow_mode_seconds) VALUES ('match', $1, $2)
     ON CONFLICT (match_id) DO NOTHING`,
    [matchId, slowModeS],
  );
  const r = await pool.query<RoomSql>(`${ROOM} WHERE r.match_id = $1`, [matchId]);
  if (r.rows[0] === undefined) throw new Error('the match chat room is missing');
  return toRoom(r.rows[0]);
}

export async function patchRoom(
  pool: DbPool,
  id: string,
  patch: { readonly slowModeS: number; readonly locked: boolean },
): Promise<void> {
  await pool.query('UPDATE smg.chat_rooms SET slow_mode_seconds = $2, locked = $3 WHERE id = $1', [
    id,
    patch.slowModeS,
    patch.locked,
  ]);
}

interface MessageSql {
  id: string;
  room_id: string;
  account_id: string | null;
  kind: 'player' | 'system';
  author: string | null;
  text: string | null;
  created_at: Date;
}

const MESSAGE = `SELECT c.id::text, c.room_id::text, c.account_id::text, c.kind, a.display_name AS author,
  CASE WHEN c.deleted_at IS NULL THEN c.body_shown END AS text, c.created_at
  FROM smg.chat_messages c LEFT JOIN smg.accounts a ON a.id = c.account_id`;

const toMessage = (r: MessageSql): ChatMessageView => ({
  id: r.id,
  roomId: r.room_id,
  kind: r.kind,
  author: r.author,
  text: r.text,
  at: r.created_at.getTime(),
});

export interface NewMessage {
  readonly roomId: string;
  readonly accountId: string | null;
  readonly body: string;
  readonly shown: string;
  readonly flags: readonly string[];
}

export async function insertMessage(pool: DbPool, m: NewMessage): Promise<ChatMessageView> {
  const r = await pool.query<{ id: string }>(
    `INSERT INTO smg.chat_messages (room_id, account_id, kind, body, body_shown, flags)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id::text`,
    [m.roomId, m.accountId, m.accountId === null ? 'system' : 'player', m.body, m.shown, m.flags],
  );
  const id = r.rows[0]?.id ?? '';
  const view = await messageById(pool, id);
  if (view === null) throw new Error('the message just written is missing');
  return view.message;
}

export async function messageById(
  pool: DbPool,
  id: string,
): Promise<{ message: ChatMessageView; accountId: string | null } | null> {
  const r = await pool.query<MessageSql>(`${MESSAGE} WHERE c.id = $1`, [id]);
  const row = r.rows[0];
  return row === undefined ? null : { message: toMessage(row), accountId: row.account_id };
}

// The newest page before `before` (ms), oldest first, so the newest is at the bottom.
export async function history(
  pool: DbPool,
  roomId: string,
  before: number | null,
): Promise<ChatMessageView[]> {
  const r = await pool.query<MessageSql>(
    `${MESSAGE} WHERE c.room_id = $1 AND ($2::timestamptz IS NULL OR c.created_at < $2)
     ORDER BY c.created_at DESC, c.id DESC LIMIT ${String(PAGE)}`,
    [roomId, before === null ? null : new Date(before)],
  );
  return r.rows.map(toMessage).reverse();
}

// Soft delete by staff; the room of the message, or null when there is none to delete.
export async function deleteMessage(pool: DbPool, id: string, by: string): Promise<string | null> {
  const r = await pool.query<{ room_id: string }>(
    `UPDATE smg.chat_messages SET deleted_at = now(), deleted_by = $2
     WHERE id = $1 AND deleted_at IS NULL RETURNING room_id::text`,
    [id, by],
  );
  return r.rows[0]?.room_id ?? null;
}

// Retention: messages older than `days` go, with the reports about them.
export async function purgeOldMessages(pool: DbPool, days: number): Promise<number> {
  const cut = `now() - make_interval(days => $1)`;
  await pool.query(
    `DELETE FROM smg.chat_reports WHERE message_id IN
       (SELECT id FROM smg.chat_messages WHERE created_at < ${cut})`,
    [days],
  );
  const r = await pool.query(`DELETE FROM smg.chat_messages WHERE created_at < ${cut}`, [days]);
  return r.rowCount ?? 0;
}
