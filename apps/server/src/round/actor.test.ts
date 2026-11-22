/**
 * @file   apps/server/src/round/actor.test.ts
 * @module server/round
 * @brief  The round actor's batches with Frost: a release rides in the next batch (O113).
 *
 * Responsibility: a Frost release (HeldDelivered) joins the open batch with the guesses queued
 *                 beside it and commits with them; releases due within one batch window share
 *                 one batch when nothing else is queued; a held answer goes out only after the
 *                 batch that records its release committed, never before its due time, in log
 *                 order; over a seeded stream of guesses every event is written once, the seqs
 *                 gap-free, every held answer released once; a failed commit loses nothing
 *                 already acknowledged and sends nothing of the failed batch; after it the open
 *                 batch, decided against the failed state, is dropped, a release whose batch
 *                 failed goes out once after the rebuild, and a reload that fails is tried
 *                 again. A fake session and store, the real FrostHold, fake timers.
 * Depends on:     vitest, ./actor, ./pgRoundStore (types)
 * Spec:           docs/spec/04-software-architecture.md §5.3; docs/spec/03-seasonal-specials.md §2.4
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RoundActor, type ActorOptions } from './actor.js';
import type { BatchWrite, PgRoundStore, StoredEvent } from './pgRoundStore.js';

const DELAY = 1_000;
const WINDOW = 20;

interface Sent {
  readonly at: number;
  readonly seqs: number[];
  readonly late: boolean;
  readonly held: ReadonlySet<number>;
}

// A round whose every guess is answered with one event held DELAY ms (Frost). A failing write
// fails after `failAfter` ms; `undelivered` is what the log holds undelivered on a reload.
function round(
  fail: (write: BatchWrite) => boolean = () => false,
  failAfter = 0,
  undelivered: readonly StoredEvent[] = [],
) {
  const appended: BatchWrite[] = [];
  const sent: Sent[] = [];
  const session = {
    state: { status: 'open', opensAt: 0, endedAt: null, endReason: null, abortReason: null },
    nextDue: () => null,
    handle: (command: { at: number }) => ({
      events: [{ type: 'GuessAccepted', deliverAt: command.at + DELAY }],
      reply: { ok: true },
    }),
  };
  const store = {
    append: (write: BatchWrite) => {
      if (fail(write))
        return new Promise((_, reject) =>
          setTimeout(() => {
            reject(new Error('disk full'));
          }, failAfter),
        );
      appended.push(write);
      return Promise.resolve();
    },
  } as unknown as PgRoundStore;
  const options: ActorOptions = {
    batchMs: WINDOW,
    batchMax: 200,
    queueBound: () => 1_000,
    now: () => Date.now(),
  };
  const reload = vi.fn(() => Promise.resolve({ session, lastSeq: 0, undelivered }));
  const actor = new RoundActor({ roundId: 'r', matchId: 'm' }, session as never, 0, {
    store,
    options,
    committed: (events: readonly StoredEvent[], how) => {
      sent.push({ at: Date.now(), seqs: events.map((e) => e.seq), late: how.late, held: how.held });
    },
    reload: reload as never,
  });
  const guess = () => actor.submit((now) => ({ type: 'guess', at: now }) as never);
  const types = (w: BatchWrite) => w.events.map((e) => e.type);
  return { actor, appended, sent, guess, types, reload };
}

beforeEach(() => {
  vi.useFakeTimers({ now: 0 });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('a Frost release in the round queue (O113)', () => {
  it('rides in the next batch with the guesses queued beside it', async () => {
    const r = round();
    void r.guess();
    await vi.advanceTimersByTimeAsync(DELAY + 5);
    void r.guess();
    await vi.advanceTimersByTimeAsync(WINDOW);
    expect(r.appended).toHaveLength(2);
    expect(r.types(r.appended[1] as BatchWrite)).toEqual(['HeldDelivered', 'GuessAccepted']);
    const late = r.sent.filter((s) => s.late);
    expect(late).toEqual([expect.objectContaining({ seqs: [1] })]);
    expect(late[0]?.at).toBeGreaterThanOrEqual(DELAY);
  });

  it('shares one batch with the releases due within its window', async () => {
    const r = round();
    void r.guess();
    await vi.advanceTimersByTimeAsync(5);
    void r.guess();
    await vi.advanceTimersByTimeAsync(DELAY + 30);
    expect(r.appended).toHaveLength(2);
    expect(r.types(r.appended[1] as BatchWrite)).toEqual(['HeldDelivered', 'HeldDelivered']);
    expect(r.sent.filter((s) => s.late)).toEqual([expect.objectContaining({ seqs: [1, 2] })]);
  });
});

describe('the round queue with Frost: what holds whatever the timing (O113)', () => {
  it('over a stream of guesses: written once, gap-free, released once, never early, in order', async () => {
    const r = round();
    // A seeded stream: 300 guesses 0–15 ms apart.
    let x = 7;
    for (let i = 0; i < 300; i += 1) {
      x = (x * 1_103_515_245 + 12_345) % 2_147_483_648;
      void r.guess();
      await vi.advanceTimersByTimeAsync(x % 16);
    }
    await vi.advanceTimersByTimeAsync(DELAY + 100);
    const written = r.appended.flatMap((w) => w.events);
    expect(written.map((e) => e.seq)).toEqual(written.map((_, i) => i + 1));
    const guesses = written.filter((e) => e.type === 'GuessAccepted');
    const late = r.sent.filter((s) => s.late);
    const released = late.flatMap((s) => s.seqs);
    expect(released).toEqual(guesses.map((g) => g.seq));
    const due = new Map(guesses.map((g) => [g.seq, g.at + DELAY]));
    for (const s of late)
      for (const seq of s.seqs) expect(s.at).toBeGreaterThanOrEqual(due.get(seq) ?? Infinity);
    // Fewer commits than releases: the releases rode along.
    expect(r.appended.length).toBeLessThan(guesses.length);
  });

  it('loses nothing acknowledged when a batch with a release fails, and sends nothing of it', async () => {
    const r = round((w) => w.events.some((e) => e.type === 'HeldDelivered'));
    const first = r.guess();
    await vi.advanceTimersByTimeAsync(WINDOW);
    expect(await first).toEqual({ ok: true });
    await vi.advanceTimersByTimeAsync(DELAY - WINDOW + 5);
    const second = r.guess();
    await vi.advanceTimersByTimeAsync(WINDOW);
    expect(await second).toEqual({ ok: false, code: 'INTERNAL' });
    expect(r.appended.flatMap((w) => w.events.map((e) => e.seq))).toEqual([1]);
    expect(r.sent.filter((s) => s.late)).toEqual([]);
    expect(r.reload).toHaveBeenCalledTimes(1);
  });
});

describe('the rebuild after a failed commit (night chain 2026-11-22, B2)', () => {
  it('drops the open batch that was decided against the failed state', async () => {
    // The first batch fails 10 ms into its write; a guess in that time opens the next batch,
    // whose window ends after the rebuild.
    let writes = 0;
    const r = round(() => (writes += 1) === 1, 10);
    const first = r.guess();
    await vi.advanceTimersByTimeAsync(WINDOW + 5);
    const second = r.guess();
    await vi.advanceTimersByTimeAsync(WINDOW * 3);
    expect(await first).toEqual({ ok: false, code: 'INTERNAL' });
    expect(await second).toEqual({ ok: false, code: 'INTERNAL' });
    expect(r.appended).toEqual([]);
    expect(r.reload).toHaveBeenCalledTimes(1);
    // After the rebuild the round takes guesses again.
    const third = r.guess();
    await vi.advanceTimersByTimeAsync(WINDOW);
    expect(await third).toEqual({ ok: true });
  });

  it('holds a release again whose batch failed and sends it once after the rebuild', async () => {
    let failed = false;
    const once = (w: BatchWrite) => {
      if (failed || !w.events.some((e) => e.type === 'HeldDelivered')) return false;
      failed = true;
      return true;
    };
    const held = { seq: 1, at: 0, type: 'GuessAccepted', event: { deliverAt: DELAY } };
    const r = round(once, 0, [held]);
    void r.guess();
    await vi.advanceTimersByTimeAsync(DELAY + WINDOW * 4);
    const late = r.sent.filter((s) => s.late);
    expect(late).toEqual([expect.objectContaining({ seqs: [1] })]);
    expect(r.reload).toHaveBeenCalledTimes(1);
  });

  it('tries a failed reload again instead of staying broken', async () => {
    const r = round((w) => w.events.some((e) => e.seq === 1));
    r.reload.mockRejectedValueOnce(new Error('database away'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    void r.guess();
    await vi.advanceTimersByTimeAsync(WINDOW + 1_100);
    expect(r.reload).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('reload failed'), expect.any(Error));
    error.mockRestore();
  });
});
