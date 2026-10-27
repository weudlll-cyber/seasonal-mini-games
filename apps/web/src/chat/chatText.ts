/**
 * @file   apps/web/src/chat/chatText.ts
 * @module web/chat
 * @brief  The chat's sentences: every refusal of a message in plain words, and the sanctions.
 *
 * Responsibility: one sentence per refusal code of the send pipeline (with the time left for
 *                 a mute, slow mode or the rate limit), of a report and of the moderators'
 *                 actions; the confirm sentence of a moderator's action (who, what, how long).
 * Depends on:     nothing
 * Used by:        ./ChatRoom, ./ModActions, ./chat.test
 * Spec:           docs/spec/07-integration.md §2; Bingo 03 §12; docs/spec/02-game-guess-the-number.md §12
 */

const CODES: Readonly<Record<string, string>> = {
  CHAT_BANNED: 'You are banned from the chat.',
  CHAT_FILTERED: 'Not sent: the message has a word that is not allowed here.',
  CHAT_DUPLICATE: 'You sent that already. Write something new.',
  CHAT_LOCKED: 'This room is locked. Only moderators can write now.',
  CHAT_LINKS_OFF: 'Links are not allowed in the chat.',
  CHAT_TOO_LONG: 'That message is too long.',
  CHAT_DISABLED: 'The chat is switched off.',
  SIGN_IN_REQUIRED: 'Sign in to write in the chat.',
  FORBIDDEN: 'Only the players and the host of this match can write here.',
  ALREADY_REPORTED: 'You reported this message already.',
  NOT_FOUND: 'That message or person is gone.',
  NO_ANSWER: 'No answer from the server. Check your connection and try again.',
};

// "5 s", "3 min", "2 h": how long until `until`.
export function timeLeft(until: number, now: number): string {
  const s = Math.max(1, Math.ceil((until - now) / 1_000));
  if (s < 60) return `${String(s)} s`;
  const min = Math.ceil(s / 60);
  return min < 60 ? `${String(min)} min` : `${String(Math.ceil(min / 60))} h`;
}

export function chatCodeText(code: string | undefined, until?: number, now = Date.now()): string {
  const left = until === undefined ? null : timeLeft(until, now);
  switch (code) {
    case 'CHAT_MUTED':
      return left === null ? 'You are muted.' : `You are muted for ${left} more.`;
    case 'CHAT_SLOW_MODE':
      return left === null
        ? 'Slow mode is on.'
        : `Slow mode: wait ${left} before your next message.`;
    case 'CHAT_RATE_LIMITED':
      return left === null
        ? 'You are writing too fast.'
        : `You are writing too fast. Try again in ${left}.`;
    default:
      return CODES[code ?? ''] ?? 'That did not work. Please try again.';
  }
}

export type ModAction =
  | { readonly kind: 'delete' }
  | { readonly kind: 'mute'; readonly minutes: number }
  | { readonly kind: 'ban' };

export const MUTES: readonly { readonly minutes: number; readonly label: string }[] = [
  { minutes: 5, label: '5 min' },
  { minutes: 60, label: '1 h' },
  { minutes: 1_440, label: '24 h' },
];

export function confirmText(action: ModAction, author: string): string {
  if (action.kind === 'delete') return `Delete this message by ${author} for everyone?`;
  if (action.kind === 'ban') return `Ban ${author} from the whole chat until a moderator lifts it?`;
  const label =
    MUTES.find((m) => m.minutes === action.minutes)?.label ?? `${String(action.minutes)} min`;
  return `Mute ${author} in the whole chat for ${label}?`;
}
