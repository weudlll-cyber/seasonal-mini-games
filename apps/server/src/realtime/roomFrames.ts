/**
 * @file   apps/server/src/realtime/roomFrames.ts
 * @module server/realtime
 * @brief  A round's room frames, merged: at most one broadcast per window, the first at once.
 *
 * Responsibility: every committed batch makes one room frame `{ roundId, s, events }`. With
 *                 500 players a batch commits every 20 ms, and each frame is one socket write
 *                 per watcher; the load check found those writes to be two thirds of the
 *                 server's time. So the first frame after a quiet window goes out at once and
 *                 the frames of the following window go out together at its end, as one frame
 *                 with all their events in order and the last `s`. A `late` frame (Frost's held
 *                 events, which repeat earlier seqs) is never merged: what is waiting goes out
 *                 first, then the late frame on its own. Order is kept; nothing is dropped.
 *                 Timers never keep the process alive (DECISIONS T49).
 * Depends on:     nothing
 * Used by:        ./gateway
 * Spec:           docs/spec/04-software-architecture.md §5.3; docs/spec/06-data-model-api-realtime.md §4.4
 */

export interface RoomFrame {
  readonly roundId: string;
  readonly s: number;
  readonly events: readonly unknown[];
  readonly late?: true;
}

export function roomFrames(
  windowMs: number,
  emit: (matchId: string, frame: RoomFrame) => void,
): (matchId: string, frame: RoomFrame) => void {
  // A round with an open window: the events waiting for its end, and whether any came.
  const open = new Map<string, { s: number; events: unknown[]; again: boolean }>();
  function flush(matchId: string, roundId: string): void {
    const waiting = open.get(roundId);
    if (waiting === undefined || waiting.events.length === 0) return;
    emit(matchId, { roundId, s: waiting.s, events: waiting.events });
    waiting.events = [];
  }
  function startWindow(matchId: string, roundId: string): void {
    open.set(roundId, { s: 0, events: [], again: false });
    setTimeout(() => {
      const again = open.get(roundId)?.again === true;
      flush(matchId, roundId);
      open.delete(roundId);
      // Frames came in during the window: keep merging for one more window.
      if (again) startWindow(matchId, roundId);
    }, windowMs).unref();
  }
  return (matchId, frame) => {
    const waiting = open.get(frame.roundId);
    if (frame.late === true) {
      flush(matchId, frame.roundId);
      emit(matchId, frame);
      return;
    }
    if (waiting === undefined) {
      emit(matchId, frame);
      startWindow(matchId, frame.roundId);
      return;
    }
    waiting.s = frame.s;
    waiting.events.push(...frame.events);
    waiting.again = true;
  };
}
