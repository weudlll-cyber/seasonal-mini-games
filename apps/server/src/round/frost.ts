/**
 * @file   apps/server/src/round/frost.ts
 * @module server/round
 * @brief  Frost's held events: kept back after their commit, released at their delivery time.
 *
 * Responsibility: a committed event with a `deliverAt` in the future is held (03 §2.4); one
 *                 in-memory timer per round waits for the earliest, then hands every due event
 *                 on, in log order (delivery times grow with receive times, so order is kept).
 *                 After a restart the held events come back from the log and are released at
 *                 their time, or at once if it has passed (04 §5.5).
 * Depends on:     ./pgRoundStore (types)
 * Used by:        ./actor
 * Spec:           docs/spec/03-seasonal-specials.md §2.4; docs/spec/04-software-architecture.md §5.5
 */
import type { StoredEvent } from './pgRoundStore.js';

export function deliverAtOf(e: StoredEvent): number | null {
  const at = (e.event as { deliverAt?: unknown }).deliverAt;
  return typeof at === 'number' ? at : null;
}

export class FrostHold {
  private held: StoredEvent[] = [];
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly now: () => number,
    private readonly release: (due: StoredEvent[]) => void,
  ) {}

  // Holds the events of a committed batch that are not due yet; returns their seqs.
  hold(events: readonly StoredEvent[]): ReadonlySet<number> {
    const now = this.now();
    const later = events.filter((e) => (deliverAtOf(e) ?? 0) > now);
    if (later.length === 0) return new Set();
    this.held.push(...later);
    this.arm();
    return new Set(later.map((e) => e.seq));
  }

  // Recovery: events written before the restart that were never delivered.
  restore(events: readonly StoredEvent[]): void {
    this.held.push(...events.filter((e) => deliverAtOf(e) !== null));
    this.arm();
  }

  stop(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private arm(): void {
    this.stop();
    const first = this.held[0];
    if (first === undefined) return;
    const wait = Math.max(0, (deliverAtOf(first) ?? 0) - this.now());
    this.timer = setTimeout(() => {
      this.timer = null;
      const now = this.now();
      const due = this.held.filter((e) => (deliverAtOf(e) ?? 0) <= now);
      this.held = this.held.slice(due.length);
      if (due.length > 0) this.release(due);
      this.arm();
    }, wait);
    // A held answer never keeps the process alive on its own.
    this.timer.unref();
  }
}
