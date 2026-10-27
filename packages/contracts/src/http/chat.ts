/**
 * @file   packages/contracts/src/http/chat.ts
 * @module contracts/http
 * @brief  The chat's shapes: the provider in force, rooms, messages, reports, sanctions,
 *         word lists, and the bodies of the player's and the moderator's actions.
 *
 * Responsibility: what the client needs to show the right chat panel (07 §2: `none` shows
 *                 none, `builtin` the platform chat, `hostEmbed` the host's room by URL), the
 *                 builtin chat's rooms and messages (authors by display name only, system lines
 *                 without author, deleted messages without their text), and the moderation
 *                 queue, sanctions and word lists of Bingo 03 §12, 04 §3.5 and 05 §2.5, §3.
 *                 Socket frames on `chat:<roomId>` are `ChatEventView`.
 * Depends on:     zod
 * Used by:        ../index, apps/server, apps/web, apps/admin
 * Spec:           docs/spec/07-integration.md §2; Bingo 06 §7, 03 §12, 05 §2.5, §3
 */
import { z } from 'zod';

export type ChatProvider = 'none' | 'builtin' | 'hostEmbed';

// GET /chat/config: which panel to show; the host room's address only for hostEmbed.
export interface ChatConfigView {
  readonly provider: ChatProvider;
  readonly hostChatUrl: string | null;
}

export interface ChatRoomView {
  readonly id: string;
  readonly kind: 'lobby' | 'match';
  readonly matchCode: string | null;
  readonly slowModeS: number;
  readonly locked: boolean;
  // For the viewer: may they write here now (signed in, chat.send, not muted or banned,
  // room not locked), and may they moderate.
  readonly canSend: boolean;
  readonly canModerate: boolean;
}

export interface ChatMessageView {
  readonly id: string;
  readonly roomId: string;
  readonly kind: 'player' | 'system';
  // Display name, or null for a system line or an author whose account is gone.
  readonly author: string | null;
  // The shown text (masked words as ***); null once a moderator deleted it.
  readonly text: string | null;
  readonly at: number;
}

export type ChatEventView =
  | { readonly type: 'message'; readonly message: ChatMessageView }
  | { readonly type: 'deleted'; readonly roomId: string; readonly messageId: string }
  | { readonly type: 'room'; readonly room: Omit<ChatRoomView, 'canSend' | 'canModerate'> };

export interface ChatReportView {
  readonly id: string;
  readonly message: ChatMessageView;
  readonly reporter: string | null;
  readonly reason: string;
  readonly status: 'open' | 'actioned' | 'dismissed';
  readonly at: number;
}

export interface ChatSanctionView {
  readonly id: string;
  readonly displayName: string;
  readonly kind: 'mute' | 'ban';
  // 'global', or the id of one room.
  readonly scope: string;
  readonly reason: string;
  readonly by: string | null;
  readonly at: number;
  readonly expiresAt: number | null;
  readonly liftedAt: number | null;
}

export const ChatSendBody = z
  .object({ roomId: z.uuid(), text: z.string().min(1).max(300) })
  .strict();
export const ChatReportBody = z.object({ reason: z.string().trim().min(1).max(300) }).strict();
export const ChatSanctionBody = z
  .object({
    displayName: z.string().min(3).max(24),
    kind: z.enum(['mute', 'ban']),
    scope: z.union([z.literal('global'), z.uuid()]),
    // Minutes for a mute (presets 5, 60, 1440, or any up to 30 days); none for a ban.
    minutes: z.number().int().min(1).max(43_200).nullable(),
    reason: z.string().trim().min(3).max(500),
  })
  .strict()
  .refine((s) => (s.kind === 'ban') === (s.minutes === null), 'a mute has minutes, a ban none');
export const ChatRoomPatchBody = z
  .object({ slowModeS: z.number().int().min(0).max(3600), locked: z.boolean() })
  .strict();
export const ChatResolveBody = z
  .object({ status: z.enum(['actioned', 'dismissed']), note: z.string().max(300).optional() })
  .strict();
export const WordListBody = z
  .object({ terms: z.array(z.string().trim().min(1).max(60)).max(2_000) })
  .strict();
