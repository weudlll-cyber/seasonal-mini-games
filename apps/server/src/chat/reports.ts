/**
 * @file   apps/server/src/chat/reports.ts
 * @module server/chat
 * @brief  The moderation queue and the word lists in PostgreSQL.
 *
 * Responsibility: a report of a message (one per reporter and message; a message the `flag`
 *                 list caught enters the queue without a reporter); the queue by status,
 *                 oldest first, with the message as players saw it; resolving an open report
 *                 (actioned or dismissed, by whom and when); a deleted message's open reports
 *                 counted as actioned. The three word lists (block, mask, flag) read and
 *                 replaced whole; the pipeline keeps them in memory until one changes.
 * Depends on:     @smg/contracts (ChatReportView), ../db/pool, ./filter (WordLists)
 * Used by:        ./chat, ./moderation, ./pipeline, ../http/routes/chat*
 * Spec:           Bingo 03 §12, Bingo 04 §3.5, Bingo 05 §3 (Moderation)
 */
import type { ChatReportView } from '@smg/contracts';

import type { DbPool } from '../db/pool.js';
import type { WordLists } from './filter.js';

export type ReportStatus = ChatReportView['status'];
export type ListId = keyof WordLists;
export const LIST_IDS: readonly ListId[] = ['block', 'mask', 'flag'];

// The new report's id, or null when this reporter reported this message already.
export async function addReport(
  pool: DbPool,
  messageId: string,
  reporterId: string | null,
  reason: string,
): Promise<string | null> {
  const r = await pool.query<{ id: string }>(
    `INSERT INTO smg.chat_reports (message_id, reporter_id, reason) VALUES ($1, $2, $3)
     ON CONFLICT (message_id, reporter_id) DO NOTHING RETURNING id::text`,
    [messageId, reporterId, reason],
  );
  return r.rows[0]?.id ?? null;
}

export async function reports(pool: DbPool, status: ReportStatus): Promise<ChatReportView[]> {
  const r = await pool.query<{
    id: string;
    reason: string;
    status: ReportStatus;
    created_at: Date;
    reporter: string | null;
    message_id: string;
    room_id: string;
    kind: 'player' | 'system';
    author: string | null;
    text: string | null;
    sent_at: Date;
  }>(
    `SELECT r.id::text, r.reason, r.status, r.created_at, p.display_name AS reporter,
       m.id::text AS message_id, m.room_id::text, m.kind, a.display_name AS author,
       CASE WHEN m.deleted_at IS NULL THEN m.body_shown END AS text, m.created_at AS sent_at
     FROM smg.chat_reports r JOIN smg.chat_messages m ON m.id = r.message_id
     LEFT JOIN smg.accounts p ON p.id = r.reporter_id
     LEFT JOIN smg.accounts a ON a.id = m.account_id
     WHERE r.status = $1 ORDER BY r.created_at LIMIT 200`,
    [status],
  );
  return r.rows.map((row) => ({
    id: row.id,
    reporter: row.reporter,
    reason: row.reason,
    status: row.status,
    at: row.created_at.getTime(),
    message: {
      id: row.message_id,
      roomId: row.room_id,
      kind: row.kind,
      author: row.author,
      text: row.text,
      at: row.sent_at.getTime(),
    },
  }));
}

// Resolves an open report; false when there is no open report with that id.
export async function resolveReport(
  pool: DbPool,
  id: string,
  status: Exclude<ReportStatus, 'open'>,
  by: string,
): Promise<boolean> {
  const r = await pool.query(
    `UPDATE smg.chat_reports SET status = $2, handled_by = $3, handled_at = now()
     WHERE id = $1 AND status = 'open'`,
    [id, status, by],
  );
  return r.rowCount === 1;
}

// A deleted message: its open reports were acted on.
export async function actionReportsOf(pool: DbPool, messageId: string, by: string): Promise<void> {
  await pool.query(
    `UPDATE smg.chat_reports SET status = 'actioned', handled_by = $2, handled_at = now()
     WHERE message_id = $1 AND status = 'open'`,
    [messageId, by],
  );
}

export interface WordListRow {
  readonly id: ListId;
  readonly terms: readonly string[];
  readonly updatedAt: number;
}

export async function wordLists(pool: DbPool): Promise<WordListRow[]> {
  const r = await pool.query<{ id: ListId; terms: string[]; updated_at: Date }>(
    'SELECT id, terms, updated_at FROM smg.profanity_lists ORDER BY id',
  );
  return r.rows.map((row) => ({
    id: row.id,
    terms: row.terms,
    updatedAt: row.updated_at.getTime(),
  }));
}

// Replaces a list; its terms before, for the audit entry.
export async function putWordList(
  pool: DbPool,
  id: ListId,
  terms: readonly string[],
  by: string,
): Promise<readonly string[]> {
  const before = await pool.query<{ terms: string[] }>(
    'SELECT terms FROM smg.profanity_lists WHERE id = $1',
    [id],
  );
  await pool.query(
    'UPDATE smg.profanity_lists SET terms = $2, updated_by = $3, updated_at = now() WHERE id = $1',
    [id, [...new Set(terms)], by],
  );
  return before.rows[0]?.terms ?? [];
}
