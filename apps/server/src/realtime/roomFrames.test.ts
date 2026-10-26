/**
 * @file   apps/server/src/realtime/roomFrames.test.ts
 * @module server/realtime
 * @brief  Room frames merge per window in order; the first goes at once; late frames stand alone.
 *
 * Responsibility: a burst of frames gives the first at once and one merged frame (events in
 *                 order, the last `s`) at the window's end; a quiet window sends nothing more;
 *                 a `late` frame sends what waits first and goes out unmerged; rounds do not
 *                 hold each other back.
 * Depends on:     vitest, ./roomFrames
 * Spec:           docs/spec/04-software-architecture.md §5.3; docs/spec/06-data-model-api-realtime.md §4.4
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { roomFrames, type RoomFrame } from './roomFrames.js';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

function kit() {
  const sent: { matchId: string; frame: RoomFrame }[] = [];
  const push = roomFrames(100, (matchId, frame) => sent.push({ matchId, frame }));
  const frame = (roundId: string, s: number, late = false): RoomFrame => ({
    roundId,
    s,
    events: [`e${String(s)}`],
    ...(late ? { late: true as const } : {}),
  });
  return { sent, push, frame };
}

describe('roomFrames', () => {
  it('sends the first frame at once and the rest of the window as one, in order', () => {
    const { sent, push, frame } = kit();
    for (let s = 1; s <= 5; s += 1) push('m', frame('r', s));
    expect(sent.map((x) => x.frame)).toEqual([{ roundId: 'r', s: 1, events: ['e1'] }]);
    vi.advanceTimersByTime(100);
    expect(sent.at(-1)?.frame).toEqual({ roundId: 'r', s: 5, events: ['e2', 'e3', 'e4', 'e5'] });
    vi.advanceTimersByTime(1_000);
    expect(sent).toHaveLength(2);
    push('m', frame('r', 6));
    expect(sent.at(-1)?.frame.s).toBe(6);
  });

  it('sends what waits before a late frame and never merges the late frame', () => {
    const { sent, push, frame } = kit();
    push('m', frame('r', 1));
    push('m', frame('r', 2));
    push('m', frame('r', 2, true));
    expect(sent.map((x) => [x.frame.s, x.frame.late ?? false])).toEqual([
      [1, false],
      [2, false],
      [2, true],
    ]);
  });

  it('keeps rounds apart', () => {
    const { sent, push, frame } = kit();
    push('m1', frame('r1', 1));
    push('m2', frame('r2', 1));
    expect(sent.map((x) => x.matchId)).toEqual(['m1', 'm2']);
  });
});
