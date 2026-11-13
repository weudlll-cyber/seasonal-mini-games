/**
 * @file   apps/server/src/round/delayedRoom.ts
 * @module server/round
 * @brief  A phased round's room and host frames, released once they are one delay old.
 *
 * Responsibility: 04 §4.8 rule 5. A committed event the room or the host may see (the game's
 *                 room and host events, PlayerEntered) is held until its time plus the round's
 *                 view delay; the lifecycle events (countdown, open) go out at once. Once a
 *                 second a tick releases every held event that is due, in log order, as one
 *                 frame. Released events are numbered by a release sequence of their own, never
 *                 by the log's seq, which would count what nobody may see yet; the views use
 *                 the same sequence and the tick's cut (`cut`, the time up to which actions are
 *                 public), so a state answer never shows more than the frames did. The round's
 *                 end releases everything held before it. A release writes no event: what is
 *                 released follows from the log and the clock, so after a restart `restore`
 *                 counts what was released and holds the rest again.
 * Depends on:     ./pgRoundStore (types), ./views (frame events, public forms)
 * Used by:        ./liveRound, ./gameRunner
 * Spec:           docs/spec/04-software-architecture.md §4.8 rule 5; docs/spec/06-data-model-api-realtime.md §4.4
 */
import type { StoredEvent } from './pgRoundStore.js';
import { phasedPublic, type FrameEvent } from './views.js';

const TICK_MS = 1_000;

export interface Released {
  readonly room: readonly FrameEvent[];
  readonly host: readonly FrameEvent[];
  // The release sequence after this frame (the room frame's `s`).
  readonly rs: number;
}

interface Held {
  readonly releaseAt: number;
  readonly at: number;
  readonly room: unknown;
  readonly host: unknown;
}

const ENDS = new Set(['RoundEnded', 'RoundAborted']);

export class DelayedRoom {
  private held: Held[] = [];
  private rs = 0;
  private cutAt: number;
  private readonly timer: NodeJS.Timeout;
  private over = false;

  constructor(
    private readonly delayMs: number,
    private readonly now: () => number,
    private readonly result: () => unknown,
    private readonly release: (released: Released) => void,
  ) {
    this.cutAt = now() - delayMs;
    this.timer = setInterval(() => {
      this.tick();
    }, TICK_MS);
    // A held frame never keeps the process alive on its own.
    this.timer.unref();
  }

  // Actions received before this time are public (the views' releasedBefore).
  cut(): number {
    return this.cutAt;
  }

  // The release sequence so far (the state answer's `seq`).
  seq(): number {
    return this.rs;
  }

  // Recovery: the round's whole log; what was due is counted as released, the rest held.
  // It counts as `emit` does, room frames only; a log with the end was released whole.
  restore(log: readonly StoredEvent[]): void {
    const now = this.now();
    const ended = log.some((e) => ENDS.has(e.type));
    for (const e of log) {
      const item = this.itemOf(e);
      if (item === null) continue;
      if (!ended && item.releaseAt > now) this.held.push(item);
      else if (item.room !== null) this.rs += 1;
    }
    if (ended) this.end();
  }

  // A committed batch: lifecycle events out at once, the rest held; an end releases all.
  add(events: readonly StoredEvent[]): void {
    for (const e of events) {
      if (ENDS.has(e.type)) {
        this.flush(Infinity);
        // The end's own public form, never delayed (it was sent wrapped before, T341).
        const end = this.itemOf(e);
        if (end !== null) this.emit([end]);
        this.end();
        continue;
      }
      const item = this.itemOf(e);
      if (item === null) continue;
      if (item.releaseAt <= e.at) this.emit([item]);
      else this.held.push(item);
    }
  }

  stop(): void {
    this.end();
  }

  private itemOf(e: StoredEvent): Held | null {
    const form = phasedPublic(e, this.result);
    if (form === null) return null;
    const releaseAt = form.delayed ? e.at + this.delayMs : e.at;
    return { releaseAt, at: e.at, room: form.room, host: form.host };
  }

  private tick(): void {
    const now = this.now();
    this.cutAt = now - this.delayMs;
    this.flush(now);
  }

  private flush(upTo: number): void {
    const due = this.held.filter((h) => h.releaseAt <= upTo);
    if (due.length === 0) return;
    this.held = this.held.filter((h) => h.releaseAt > upTo);
    this.emit(due);
  }

  private emit(items: readonly Held[]): void {
    const room: FrameEvent[] = [];
    const host: FrameEvent[] = [];
    for (const item of items) {
      if (item.room !== null) {
        this.rs += 1;
        room.push({ s: this.rs, at: item.at, event: item.room });
      }
      if (item.host !== null) host.push({ s: this.rs, at: item.at, event: item.host });
    }
    if (room.length > 0 || host.length > 0) this.release({ room, host, rs: this.rs });
  }

  private end(): void {
    if (this.over) return;
    this.over = true;
    // After the end everything is public: the views need no cut any more.
    this.cutAt = Infinity;
    clearInterval(this.timer);
  }
}
