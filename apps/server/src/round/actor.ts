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
}

export type Committed = (events: readonly StoredEvent[]) => void;

export class RoundActor<S, A, E, Cfg, Sec> {
  private open: Batch<S, Cfg> = { events: [], waiters: [], state: null };
  private timer: NodeJS.Timeout | null = null;
  private chain: Promise<void> = Promise.resolve();
  private unanswered = 0;
  private broken = false;

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
    if (this.broken || this.unanswered >= this.deps.options.queueBound()) {
      return Promise.resolve({ ok: false, code: 'ROUND_BUSY' });
    }
    const now = this.deps.options.now();
    const result = this.session.handle(build(now));
    for (const event of result.events) this.stamp(event, now);
    this.unanswered += 1;
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
    this.open = { events: [], waiters: [], state: null };
    this.chain = this.chain.then(() => this.commit(batch));
  }

  private async commit(batch: Batch<S, Cfg>): Promise<void> {
    try {
      if (this.broken) throw new Error('an earlier batch failed');
      if (batch.events.length > 0 && batch.state !== null) {
        await this.deps.store.append(
          batchWrite(this.roundId, this.matchId, batch.events, batch.state),
        );
        this.deps.committed(batch.events);
      }
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
  }
}
