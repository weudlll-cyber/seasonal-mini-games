/**
 * @file   apps/server/src/chat/spam.test.ts
 * @module server/chat
 * @brief  Spam control: the rate limit, duplicates, the room's and the new account's slow mode.
 *
 * Responsibility: the per-account bucket lets `rateMessages` through per window and refuses
 *                 the next with a retry time; a changed rule starts a fresh bucket; the same
 *                 text a third time within 60 s is refused, and allowed again after a minute;
 *                 a room's slow mode and the new-account slow mode wait between two delivered
 *                 messages. The clock is a variable, so nothing waits.
 * Depends on:     vitest, ./spam
 * Spec:           Bingo 03 §12
 */
import { describe, expect, it } from 'vitest';

import { NEW_ACCOUNT_GAP_MS, SpamGuard, type SpamInput } from './spam.js';

function guard() {
  const clock = { t: 1_000_000 };
  return { clock, spam: new SpamGuard(() => clock.t) };
}

const input = (text: string, over: Partial<SpamInput> = {}): SpamInput => ({
  accountId: 'a',
  roomId: 'r',
  text,
  slowModeS: 0,
  newAccount: false,
  rateMessages: 5,
  rateWindowS: 10,
  ...over,
});

describe('the rate limit', () => {
  it('lets five through in ten seconds and refuses the sixth until a token is back', () => {
    const { clock, spam } = guard();
    for (let i = 0; i < 5; i += 1) expect(spam.check(input(`m${String(i)}`)).ok).toBe(true);
    const sixth = spam.check(input('m5'));
    expect(sixth).toMatchObject({ ok: false, code: 'CHAT_RATE_LIMITED' });
    expect(sixth.ok ? 0 : (sixth.until ?? 0)).toBe(clock.t + 2_000);
    clock.t += 2_000;
    expect(spam.check(input('m6')).ok).toBe(true);
  });

  it('keeps accounts apart and follows a changed rule', () => {
    const { spam } = guard();
    expect(spam.check(input('x', { rateMessages: 1 })).ok).toBe(true);
    expect(spam.check(input('y', { rateMessages: 1 })).ok).toBe(false);
    expect(spam.check(input('y', { rateMessages: 1, accountId: 'b' })).ok).toBe(true);
    expect(spam.check(input('z', { rateMessages: 2 })).ok).toBe(true);
  });
});

describe('duplicates', () => {
  it('refuses the same text a third time within a minute, whatever its case and spacing', () => {
    const { clock, spam } = guard();
    for (const text of ['Hello there', 'hello  THERE']) {
      expect(spam.check(input(text)).ok).toBe(true);
      spam.noteSent('a', 'r', text);
    }
    expect(spam.check(input('HELLO there'))).toEqual({ ok: false, code: 'CHAT_DUPLICATE' });
    clock.t += 60_000;
    expect(spam.check(input('hello there')).ok).toBe(true);
  });

  it('counts only delivered messages', () => {
    const { spam } = guard();
    for (let i = 0; i < 3; i += 1) expect(spam.check(input('again')).ok).toBe(true);
  });
});

describe('slow modes', () => {
  it("waits a room's slow mode between two messages in that room only", () => {
    const { clock, spam } = guard();
    spam.noteSent('a', 'r', 'one');
    expect(spam.check(input('two', { slowModeS: 30 }))).toEqual({
      ok: false,
      code: 'CHAT_SLOW_MODE',
      until: clock.t + 30_000,
    });
    expect(spam.check(input('two', { slowModeS: 30, roomId: 'other' })).ok).toBe(true);
    clock.t += 30_000;
    expect(spam.check(input('two', { slowModeS: 30 })).ok).toBe(true);
  });

  it('makes a new account wait 10 s between any two messages', () => {
    const { clock, spam } = guard();
    spam.noteSent('a', 'r', 'one');
    const refused = spam.check(input('two', { newAccount: true, roomId: 'other' }));
    expect(refused).toMatchObject({ ok: false, code: 'CHAT_SLOW_MODE' });
    clock.t += NEW_ACCOUNT_GAP_MS;
    expect(spam.check(input('two', { newAccount: true })).ok).toBe(true);
  });
});
