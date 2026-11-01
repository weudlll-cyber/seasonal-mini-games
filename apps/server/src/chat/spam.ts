/**
 * @file   apps/server/src/chat/spam.ts
 * @module server/chat
 * @brief  Spam control of the chat: slow modes, the per-account rate limit, duplicates.
 *
 * Responsibility: in this order, a room's slow mode (seconds between two messages of one
 *                 account in that room), the new-account slow mode (10 s between any two
 *                 messages of an account younger than `chat.newAccountSlowModeHours`), the
 *                 token bucket of `chat.rateMessages` per `chat.rateWindowS` (./../auth/rateLimit),
 *                 and duplicate detection (the same text a third time within 60 s is refused).
 *                 Only delivered messages count for slow mode and duplicates. The clock is
 *                 injected so tests do not wait. In memory per server process, as the other
 *                 limits (02 §8).
 * Depends on:     ../auth/rateLimit
 * Used by:        ./pipeline, ./spam.test
 * Spec:           Bingo 03 §12
 */
import { RateLimiter } from '../auth/rateLimit.js';

export const NEW_ACCOUNT_GAP_MS = 10_000;
const DUPLICATE_WINDOW_MS = 60_000;
const DUPLICATES_ALLOWED = 2;

export interface SpamInput {
  readonly accountId: string;
  readonly roomId: string;
  readonly text: string;
  readonly slowModeS: number;
  readonly newAccount: boolean;
  readonly rateMessages: number;
  readonly rateWindowS: number;
}

export type SpamVerdict =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly code: 'CHAT_SLOW_MODE' | 'CHAT_RATE_LIMITED' | 'CHAT_DUPLICATE';
      readonly until?: number;
    };

const sameText = (text: string): string => text.trim().toLowerCase().replace(/\s+/gu, ' ');

export class SpamGuard {
  private limiter: RateLimiter | null = null;
  private limiterRule = '';
  // Account → its delivered texts of the last minute.
  private readonly recent = new Map<string, { text: string; at: number }[]>();
  // `account` and `account room` → when that account last sent (anywhere / in that room).
  private readonly lastSent = new Map<string, number>();
  private notes = 0;

  constructor(private readonly now: () => number = Date.now) {}

  check(input: SpamInput): SpamVerdict {
    const t = this.now();
    const inRoom = this.lastSent.get(`${input.accountId} ${input.roomId}`);
    if (input.slowModeS > 0 && inRoom !== undefined && t - inRoom < input.slowModeS * 1_000) {
      return { ok: false, code: 'CHAT_SLOW_MODE', until: inRoom + input.slowModeS * 1_000 };
    }
    const anywhere = this.lastSent.get(input.accountId);
    if (input.newAccount && anywhere !== undefined && t - anywhere < NEW_ACCOUNT_GAP_MS) {
      return { ok: false, code: 'CHAT_SLOW_MODE', until: anywhere + NEW_ACCOUNT_GAP_MS };
    }
    const decision = this.limiterFor(input).take(input.accountId);
    if (!decision.allowed) {
      return { ok: false, code: 'CHAT_RATE_LIMITED', until: t + decision.retryAfterMs };
    }
    const text = sameText(input.text);
    const repeats = this.lastMinute(input.accountId, t).filter((r) => r.text === text).length;
    if (repeats >= DUPLICATES_ALLOWED) return { ok: false, code: 'CHAT_DUPLICATE' };
    return { ok: true };
  }

  // A message was delivered: it counts for slow mode and duplicates from now on.
  noteSent(accountId: string, roomId: string, text: string): void {
    const t = this.now();
    this.lastSent.set(accountId, t);
    this.lastSent.set(`${accountId} ${roomId}`, t);
    this.recent.set(accountId, [...this.lastMinute(accountId, t), { text: sameText(text), at: t }]);
    // Now and then forget accounts quiet for an hour (no slow mode lasts that long).
    if ((this.notes += 1) % 1_000 === 0) this.prune(t);
  }

  // The bucket follows the settings: a changed rule starts a fresh limiter.
  private limiterFor(input: SpamInput): RateLimiter {
    const rule = `${String(input.rateMessages)}/${String(input.rateWindowS)}`;
    if (this.limiter === null || rule !== this.limiterRule) {
      this.limiter = new RateLimiter(
        { limit: input.rateMessages, windowMs: input.rateWindowS * 1_000 },
        this.now,
      );
      this.limiterRule = rule;
    }
    return this.limiter;
  }

  private lastMinute(accountId: string, t: number): { text: string; at: number }[] {
    return (this.recent.get(accountId) ?? []).filter((r) => t - r.at < DUPLICATE_WINDOW_MS);
  }

  private prune(t: number): void {
    for (const [key, at] of this.lastSent) if (t - at > 3_600_000) this.lastSent.delete(key);
    for (const [key, list] of this.recent) {
      if (list.every((r) => t - r.at >= DUPLICATE_WINDOW_MS)) this.recent.delete(key);
    }
  }
}
