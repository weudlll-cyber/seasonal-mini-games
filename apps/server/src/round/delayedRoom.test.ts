/**
 * @file   apps/server/src/round/delayedRoom.test.ts
 * @module server/round
 * @brief  A phased round's delayed room counts its releases the same live and after a restart.
 *
 * Responsibility: the release sequence counts only room frames; a host-only event is released
 *                 to the host without a number of its own. `restore` from the round's log must
 *                 reach the sequence the live room reached, and go on numbering the same way,
 *                 also when the log already holds the round's end.
 * Depends on:     vitest, ./delayedRoom, ./pgRoundStore (types)
 * Spec:           docs/spec/04-software-architecture.md §4.8 rule 5; docs/spec/06-data-model-api-realtime.md §4.4
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DelayedRoom, type Released } from './delayedRoom.js';
import type { StoredEvent } from './pgRoundStore.js';

const DELAY = 2_000;
let clock = 0;
let seq = 0;

const stored = (at: number, event: Record<string, unknown>): StoredEvent => {
  seq += 1;
  return { seq, at, type: String(event.type), event };
};
const game = (at: number, audience: 'room' | 'host', n: number) =>
  stored(at, { type: 'Game', audience, event: { n } });

function room(log: Released[]) {
  return new DelayedRoom(
    DELAY,
    () => clock,
    () => null,
    (r) => log.push(r),
  );
}

// Lets time pass on the fake clock and the room's once-a-second tick.
function pass(ms: number) {
  clock += ms;
  vi.advanceTimersByTime(ms);
}

beforeEach(() => {
  vi.useFakeTimers();
  clock = 0;
  seq = 0;
});
afterEach(() => {
  vi.useRealTimers();
});

describe('DelayedRoom release sequence (04 §4.8 rule 5)', () => {
  it('restores the live sequence when the log holds a host-only event', () => {
    const live: Released[] = [];
    const a = room(live);
    const log = [
      stored(0, { type: 'RoundOpened', at: 0 }),
      game(100, 'host', 1),
      game(200, 'room', 2),
      game(300, 'host', 3),
    ];
    a.add(log.slice(0, 1));
    a.add(log.slice(1));
    pass(3_000);
    expect(live.flatMap((r) => r.host)).toHaveLength(2);

    // A restart: a new room from the same log at the same time.
    const b = room([]);
    b.restore(log);
    expect(b.seq()).toBe(a.seq());
    a.stop();
    b.stop();
  });

  it('numbers the next release the same live and after a restart', () => {
    const live: Released[] = [];
    const after: Released[] = [];
    const a = room(live);
    const first = [stored(0, { type: 'RoundOpened', at: 0 }), game(100, 'host', 1)];
    a.add(first);
    pass(3_000);
    const b = room(after);
    b.restore(first);

    const next = [game(3_100, 'room', 2)];
    a.add(next);
    b.add(next);
    pass(3_000);
    expect(after.at(-1)?.rs).toBe(live.at(-1)?.rs);
    expect(after.at(-1)?.room).toEqual(live.at(-1)?.room);
    a.stop();
    b.stop();
  });
});

describe('DelayedRoom restore after the end (04 §4.8 rule 5)', () => {
  it('counts everything held as released once the log holds the end', () => {
    const live: Released[] = [];
    const a = room(live);
    const log = [
      stored(0, { type: 'RoundOpened', at: 0 }),
      game(900, 'room', 1),
      game(950, 'host', 2),
      stored(1_000, { type: 'RoundEnded', at: 1_000 }),
    ];
    pass(1_000);
    a.add(log);
    // The end released the held room event before the delay had passed.
    const end = live.at(-1)?.room.at(-1);
    // The room gets the end's own public form, not its wrapper (T341).
    expect(end?.event).toMatchObject({ type: 'RoundEnded', at: 1_000 });
    const b = room([]);
    b.restore(log);
    expect(b.seq()).toBe(a.seq());
    expect(a.seq()).toBe(3);
  });
});
