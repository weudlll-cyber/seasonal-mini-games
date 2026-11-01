/**
 * @file   apps/server/src/chat/moderation.ts
 * @module server/chat
 * @brief  The moderators' actions on the builtin chat, each one audited.
 *
 * Responsibility: delete a message (watchers see it go at once; its open reports count as
 *                 actioned), mute or ban an account everywhere or in one room and lift it
 *                 again (in force for the next message: the sanction cache is dropped),
 *                 change a room's slow mode and lock (the room hears of it), resolve a report,
 *                 and replace a word list (the pipeline reads it with the next message). Each
 *                 action writes one audit entry with what changed (Bingo 03 §12: reason, actor,
 *                 expiry). The caller checked `chat.moderate`.
 * Depends on:     @smg/application (AuditActor, AuditLog), @smg/contracts (bodies, views),
 *                 zod (types), ./chat, ./reports, ./rooms
 * Used by:        ../http/routes/chatModeration
 * Spec:           Bingo 03 §12, Bingo 05 §3 (Moderation), Bingo 06 §7
 */
import type { AuditActor, AuditLog } from '@smg/application';
import type {
  ChatResolveBody,
  ChatRoomPatchBody,
  ChatSanctionBody,
  ChatSanctionView,
  ChatRoomView,
} from '@smg/contracts';
import type { z } from 'zod';

import type { Chat } from './chat.js';
import { actionReportsOf, putWordList, resolveReport, type ListId } from './reports.js';
import { deleteMessage, patchRoom, roomBase, roomById } from './rooms.js';

export type Actor = AuditActor & { readonly accountId: string };

export interface Moderation {
  readonly chat: Chat;
  readonly audit: AuditLog;
}

type Outcome<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly code: string };

export async function deleteAs(m: Moderation, actor: Actor, id: string): Promise<Outcome<null>> {
  const roomId = await deleteMessage(m.chat.pool, id, actor.accountId);
  if (roomId === null) return { ok: false, code: 'NOT_FOUND' };
  await actionReportsOf(m.chat.pool, id, actor.accountId);
  m.chat.emit(roomId, { type: 'deleted', roomId, messageId: id });
  await m.audit.append(actor, {
    action: 'chat.message.delete',
    targetType: 'chat_message',
    targetId: id,
    diff: { roomId },
  });
  return { ok: true, value: null };
}

export async function sanctionAs(
  m: Moderation,
  actor: Actor,
  body: z.infer<typeof ChatSanctionBody>,
): Promise<Outcome<ChatSanctionView>> {
  const target = await m.chat.pool.query<{ id: string }>(
    `SELECT id::text FROM smg.accounts WHERE display_name_key = $1 AND status <> 'deleted'`,
    [body.displayName],
  );
  const accountId = target.rows[0]?.id;
  if (accountId === undefined) return { ok: false, code: 'NOT_FOUND' };
  if (body.scope !== 'global' && (await roomById(m.chat.pool, body.scope)) === null) {
    return { ok: false, code: 'NOT_FOUND' };
  }
  const id = await m.chat.sanctions.create({ ...body, accountId, by: actor.accountId });
  await m.audit.append(actor, {
    action: `chat.${body.kind}`,
    targetType: 'account',
    targetId: accountId,
    diff: { sanction: id, scope: body.scope, minutes: body.minutes, reason: body.reason },
  });
  const [view] = await m.chat.sanctions.list(id);
  return view === undefined ? { ok: false, code: 'NOT_FOUND' } : { ok: true, value: view };
}

export async function liftAs(m: Moderation, actor: Actor, id: string): Promise<Outcome<null>> {
  const accountId = await m.chat.sanctions.lift(id, actor.accountId);
  if (accountId === null) return { ok: false, code: 'NOT_FOUND' };
  await m.audit.append(actor, {
    action: 'chat.sanction.lift',
    targetType: 'account',
    targetId: accountId,
    diff: { sanction: id },
  });
  return { ok: true, value: null };
}

export async function patchRoomAs(
  m: Moderation,
  actor: Actor,
  id: string,
  patch: z.infer<typeof ChatRoomPatchBody>,
): Promise<Outcome<Omit<ChatRoomView, 'canSend' | 'canModerate'>>> {
  const before = await roomById(m.chat.pool, id);
  if (before === null) return { ok: false, code: 'NOT_FOUND' };
  await patchRoom(m.chat.pool, id, patch);
  const room = { ...roomBase(before), ...patch };
  m.chat.emit(id, { type: 'room', room });
  await m.audit.append(actor, {
    action: 'chat.room.update',
    targetType: 'chat_room',
    targetId: id,
    diff: { before: { slowModeS: before.slowModeS, locked: before.locked }, after: patch },
  });
  return { ok: true, value: room };
}

export async function resolveAs(
  m: Moderation,
  actor: Actor,
  id: string,
  body: z.infer<typeof ChatResolveBody>,
): Promise<Outcome<null>> {
  if (!(await resolveReport(m.chat.pool, id, body.status, actor.accountId))) {
    return { ok: false, code: 'NOT_FOUND' };
  }
  await m.audit.append(actor, {
    action: 'chat.report.resolve',
    targetType: 'chat_report',
    targetId: id,
    diff: { status: body.status, ...(body.note === undefined ? {} : { note: body.note }) },
  });
  return { ok: true, value: null };
}

export async function putListAs(
  m: Moderation,
  actor: Actor,
  id: ListId,
  terms: readonly string[],
): Promise<void> {
  const before = await putWordList(m.chat.pool, id, terms, actor.accountId);
  m.chat.dropWordLists();
  const after = new Set(terms);
  await m.audit.append(actor, {
    action: 'chat.wordlist.update',
    targetType: 'profanity_list',
    targetId: id,
    // Counts only: the audit log should not become a copy of the word list.
    diff: {
      added: [...after].filter((t) => !before.includes(t)).length,
      removed: before.filter((t) => !after.has(t)).length,
    },
  });
}
