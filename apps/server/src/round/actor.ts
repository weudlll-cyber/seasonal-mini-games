/**
 * @file   apps/server/src/round/actor.ts
 * @module server/round
 * @brief  The round actor: one ordered queue per round, group commit, replies after commit.
 *
 * Responsibility: every item is processed the moment it is handed in, one at a time, so the
 *                 queue order is the order the process read the messages in (04 §5.2): the
 *                 receive time is stamped, the command runs through the round session, and
 *                 its events join the open batch. A batch closes after `batchMs` or
 *                 `batchMax` events and is written in one transaction; replies and frames
 *                 of a batch go out only after it committed, and batches commit in order
 *                 (04 §5.3). A failed commit drops that batch and every later one (their
 *                 senders get INTERNAL) and the actor rebuilds itself from the database,
 *                 answering ROUND_BUSY meanwhile.
 *                 More than `queueBound` unanswered items answer ROUND_BUSY (05 §5).
 * Depends on:     @smg/application (RoundSession), @smg/domain (types), ./pgRoundStore, ./batch
 * Used by:        ./rounds
 * Spec:           docs/spec/04-software-architecture.md §5.2, §5.3; docs/spec/06-data-model-api-realtime.md §4.5
 */
import type { RoundSession } from '@smg/application';
import type { Reply, RoundCommand, RoundEvent, RoundState } from '@smg/domain';

import { batchWrite, eventType } from './batch.js';
import { FrostHold } from './frost.js';
import type { PgRoundStore, StoredEvent } from './pgRoundStore.js';

export interface ActorOptions {
  readonly batchMs: number;
  readonly batchMax: number;
  readonly queueBound: () => number;
  readonly now: () => number;
}

interface Waiter {
  readonly reply: Reply;
  readonly resolve: (reply: Reply) => void;
}

interface Batch<S, Cfg> {
  readonly events: StoredEvent[];
  readonly waiters: Waiter[];
  // The session state when the batch closed: the round row and the snapshot follow it.
  state: RoundState<S, Cfg> | null;
  // Frost: held events this batch's HeldDelivered releases, sent once it committed.
  released: StoredEvent[];
}

// How committed events go out: `held` names the seqs Frost keeps back for now; `late` marks
// held events released after their own batch.
export interface Delivery {
  readonly held: ReadonlySet<number>;
  readonly late: boolean;
}

export type Committed = (events: readonly StoredEvent[], how: Delivery) => void;

const emptyBatch = <S, Cfg>(): Batch<S, Cfg> => ({
  events: [],
  waiters: [],
  state: null,
  released: [],
});

export class RoundActor<S, A, E, Cfg, Sec> {
  private open: Batch<S, Cfg> = emptyBatch();
  private timer: NodeJS.Timeout | null = null;
  // The next time the round must run by itself (a special, the open, the end).
  private due: { at: number; timer: NodeJS.Timeout } | null = null;
  private readonly frost: FrostHold;
  private chain: Promise<void> = Promise.resolve();
  private unanswered = 0;
  private broken = false;
  // After shutdown nothing is taken any more.
  private stopped = false;

  readonly roundId: string;
  readonly matchId: string;

  constructor(
    ids: { readonly roundId: string; readonly matchId: string },
    private session: RoundSession<S, A, E, Cfg, Sec>,
    private lastSeq: number,
    private readonly deps: {
      readonly store: PgRoundStore;
      readonly options: ActorOptions;
      readonly committed: Committed;
      readonly reload: () => Promise<{ session: RoundSession<S, A, E, Cfg, Sec>; lastSeq: number }>;
    },
  ) {
    this.roundId = ids.roundId;
    this.matchId = ids.matchId;
    this.frost = new FrostHold(deps.options.now, (due) => {
      this.release(due);
    });
    this.armDue();
  }

  // Recovery: Frost answers that were written but not delivered before the restart.
  restoreHeld(events: readonly StoredEvent[]): void {
    this.frost.restore(events);
  }

  stop(): void {
    this.stopped = true;
    this.frost.stop();
    if (this.due !== null) clearTimeout(this.due.timer);
    this.due = null;
  }

  get current(): RoundSession<S, A, E, Cfg, Sec> {
    return this.session;
  }

  // The seq of the last event processed (committed or in the open batch).
  get seq(): number {
    return this.lastSeq;
  }

  // One queue item: runs now, answers after its batch committed.
  submit(build: (now: number) => RoundCommand<A>): Promise<Reply> {
    // While rebuilding after a failed commit nothing new is taken (the client resends).
    if (this.stopped || this.broken || this.unanswered >= this.deps.options.queueBound()) {
      return Promise.resolve({ ok: false, code: 'ROUND_BUSY' });
    }
    const now = this.deps.options.now();
    const result = this.session.handle(build(now));
    for (const event of result.events) this.stamp(event, now);
    this.unanswered += 1;
    this.armDue();
    return new Promise((resolve) => {
      this.open.waiters.push({ reply: result.reply, resolve });
      if (this.open.events.length >= this.deps.options.batchMax) this.close();
      else
        this.timer ??= setTimeout(() => {
          this.close();
        }, this.deps.options.batchMs);
    });
  }

  // Waits until every batch handed in so far is written (shutdown, tests).
  async drain(): Promise<void> {
    this.close();
    await this.chain;
  }

  // One timer for the round's next due time; it runs a tick through the queue (03 §1 rule 3).
  private armDue(): void {
    const at = this.session.nextDue();
    if (at === this.due?.at) return;
    if (this.due !== null) clearTimeout(this.due.timer);
    this.due = null;
    if (at === null) return;
    const timer = setTimeout(
      () => {
        this.due = null;
        void this.submit((now) => ({ type: 'tick', at: now }));
      },
      Math.max(0, at - this.deps.options.now()),
    );
    timer.unref();
    this.due = { at, timer };
  }

  // Frost: the due held events are delivered; the log records it as HeldDelivered.
  private release(due: StoredEvent[]): void {
    const now = this.deps.options.now();
    const upTo = due.at(-1)?.seq ?? 0;
    this.stamp({ type: 'HeldDelivered', upTo, at: now }, now);
    this.open.released.push(...due);
    this.close();
  }

  private stamp(event: RoundEvent<E, A, Cfg>, at: number): void {
    this.lastSeq += 1;
    this.open.events.push({ seq: this.lastSeq, at, type: eventType(event), event });
  }

  private close(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    if (this.open.waiters.length === 0 && this.open.events.length === 0) return;
    const batch = this.open;
    batch.state = this.session.state;
    this.open = emptyBatch();
    this.chain = this.chain.then(() => this.commit(batch));
  }

  private async commit(batch: Batch<S, Cfg>): Promise<void> {
    try {
      if (this.broken) throw new Error('an earlier batch failed');
      if (batch.events.length > 0 && batch.state !== null) {
        await this.deps.store.append(
          batchWrite(this.roundId, this.matchId, batch.events, batch.state),
        );
        this.deps.committed(batch.events, { held: this.frost.hold(batch.events), late: false });
      }
      if (batch.released.length > 0)
        this.deps.committed(batch.released, { held: new Set(), late: true });
      for (const w of batch.waiters) w.resolve(w.reply);
    } catch (error) {
      for (const w of batch.waiters) w.resolve({ ok: false, code: 'INTERNAL' });
      if (!this.broken) {
        this.broken = true;
        console.error(`[smg] round ${this.roundId}: batch commit failed, rebuilding`, error);
        // Rebuild after every batch already queued behind this one has failed too.
        void Promise.resolve().then(() => this.rebuild());
      }
    } finally {
      this.unanswered -= batch.waiters.length;
    }
  }

  private async rebuild(): Promise<void> {
    await this.chain;
    const fresh = await this.deps.reload();
    this.session = fresh.session;
    this.lastSeq = fresh.lastSeq;
    this.broken = false;
    this.armDue();
  }
}
