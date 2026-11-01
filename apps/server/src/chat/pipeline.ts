/**
 * @file   apps/server/src/chat/pipeline.ts
 * @module server/chat
 * @brief  The send pipeline of one chat message, from the raw intent to the stored message.
 *
 * Responsibility: Bingo 06 §7 and 03 §12 in order: the provider (`builtin`, else
 *                 CHAT_DISABLED) → schema → who may write the room (chat.send; in a match room
 *                 its players, its host and staff with chat.moderate) → sanctions (CHAT_BANNED,
 *                 CHAT_MUTED) → room lock and slow modes (CHAT_LOCKED, CHAT_SLOW_MODE; staff
 *                 with chat.moderate are exempt) → rate limit and duplicates (CHAT_RATE_LIMITED,
 *                 CHAT_DUPLICATE) → length (CHAT_TOO_LONG) → links (CHAT_LINKS_OFF unless
 *                 chat.allowLinks) → normalization and word lists (CHAT_FILTERED; masked words
 *                 as ***; a flagged message is delivered and enters the moderation queue) →
 *                 persist. The caller broadcasts. Every refusal is a plain code.
 * Depends on:     @smg/contracts (ChatSendBody, views), ../db/pool, ./filter, ./provider,
 *                 ./reports, ./rooms, ./sanctions, ./spam
 * Used by:        ./chat; its Viewer type by ../http/routes/chat, ../realtime/chatIntents
 * Spec:           docs/spec/07-integration.md §2; Bingo 06 §7, Bingo 03 §12
 */
import { ChatSendBody, type ChatMessageView } from '@smg/contracts';

import type { DbPool } from '../db/pool.js';
import { applyWordLists, hasLink, type WordLists } from './filter.js';
import type { ChatRules } from './provider.js';
import { addReport } from './reports.js';
import { insertMessage, type RoomRow } from './rooms.js';
import type { Sanctions } from './sanctions.js';
import type { SpamGuard } from './spam.js';

export interface Viewer {
  readonly accountId: string | null;
  readonly permissions: readonly string[];
}

export type SendResult =
  | { readonly ok: true; readonly message: ChatMessageView }
  | { readonly ok: false; readonly code: string; readonly until?: number };

export interface PipelineDeps {
  readonly pool: DbPool;
  readonly sanctions: Sanctions;
  readonly spam: SpamGuard;
  readonly rules: () => Promise<ChatRules>;
  readonly lists: () => Promise<WordLists>;
  readonly room: (id: string) => Promise<RoomRow | null>;
  readonly mayWrite: (room: RoomRow, viewer: Viewer) => Promise<boolean>;
}

type Refusal = Extract<SendResult, { ok: false }>;

export async function sendMessage(
  deps: PipelineDeps,
  viewer: Viewer,
  raw: unknown,
): Promise<SendResult> {
  const body = ChatSendBody.safeParse(raw);
  if (!body.success) return { ok: false, code: 'VALIDATION_FAILED' };
  const accountId = viewer.accountId;
  if (accountId === null) return { ok: false, code: 'SIGN_IN_REQUIRED' };
  if (!viewer.permissions.includes('chat.send')) return { ok: false, code: 'FORBIDDEN' };
  const room = await deps.room(body.data.roomId);
  if (room === null) return { ok: false, code: 'NOT_FOUND' };
  if (!(await deps.mayWrite(room, viewer))) return { ok: false, code: 'FORBIDDEN' };
  const rules = await deps.rules();
  const text = body.data.text;
  const sanction = await deps.sanctions.against(accountId, room.id);
  if (sanction !== null) return { ok: false, ...sanction };
  const refused =
    (await gate(deps, { viewer, accountId, room, rules, text })) ?? content(text, rules);
  if (refused !== null) return refused;
  const filtered = applyWordLists(text, await deps.lists());
  if (filtered.blocked) return { ok: false, code: 'CHAT_FILTERED' };
  const message = await insertMessage(deps.pool, {
    roomId: room.id,
    accountId,
    body: text,
    shown: filtered.shown,
    flags: filtered.flags,
  });
  deps.spam.noteSent(accountId, room.id, text);
  if (filtered.flags.includes('flagged')) {
    await addReport(deps.pool, message.id, null, 'Caught by the flag word list');
  }
  return { ok: true, message };
}

interface GateInput {
  readonly viewer: Viewer;
  readonly accountId: string;
  readonly room: RoomRow;
  readonly rules: ChatRules;
  readonly text: string;
}

// The room's lock and slow modes (staff exempt), then the rate limit and duplicates.
async function gate(deps: PipelineDeps, g: GateInput): Promise<Refusal | null> {
  const staff = g.viewer.permissions.includes('chat.moderate');
  if (g.room.locked && !staff) return { ok: false, code: 'CHAT_LOCKED' };
  const verdict = deps.spam.check({
    accountId: g.accountId,
    roomId: g.room.id,
    text: g.text,
    slowModeS: staff ? 0 : g.room.slowModeS,
    newAccount: !staff && (await isNewAccount(deps.pool, g.accountId, g.rules)),
    rateMessages: g.rules.rateMessages,
    rateWindowS: g.rules.rateWindowS,
  });
  return verdict.ok ? null : verdict;
}

async function isNewAccount(pool: DbPool, accountId: string, rules: ChatRules): Promise<boolean> {
  if (rules.newAccountSlowModeHours === 0) return false;
  const r = await pool.query(
    `SELECT 1 FROM smg.accounts WHERE id = $1 AND created_at > now() - make_interval(hours => $2)`,
    [accountId, rules.newAccountSlowModeHours],
  );
  return r.rowCount === 1;
}

// Length and links, on the text as written.
function content(text: string, rules: ChatRules): Refusal | null {
  if (text.trim() === '') return { ok: false, code: 'VALIDATION_FAILED' };
  if (text.length > rules.maxLength) return { ok: false, code: 'CHAT_TOO_LONG' };
  if (!rules.allowLinks && hasLink(text)) return { ok: false, code: 'CHAT_LINKS_OFF' };
  return null;
}
