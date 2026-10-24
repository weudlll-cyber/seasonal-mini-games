/**
 * @file   apps/server/src/round/batch.ts
 * @module server/round
 * @brief  What one committed batch writes beside its events: status, schedule, results.
 *
 * Responsibility: from the typed events of a batch and the round state when it closed,
 *                 the round row's status, the scheduled actions a countdown needs (open at
 *                 `opensAt`, time-up at `endsAt`), the results of `RoundEnded`, whether the
 *                 round is finished, and a snapshot when the batch crosses a multiple of
 *                 200 events (06 §2.3). The `type` column names a game event `game.<type>`.
 * Depends on:     @smg/domain (types), ./pgRoundStore (types)
 * Used by:        ./actor
 * Spec:           docs/spec/06-data-model-api-realtime.md §2.3–§2.5, §2.8
 */
import type { RoundEvent, RoundState } from '@smg/domain';

import type { BatchWrite, StoredEvent } from './pgRoundStore.js';

export const SNAPSHOT_EVERY = 200;

export function eventType(event: RoundEvent<unknown, unknown, unknown>): string {
  if (event.type !== 'Game') return event.type;
  const inner = event.event as { type?: unknown } | null;
  return typeof inner?.type === 'string' ? `game.${inner.type}` : 'game';
}

export function batchWrite<S, Cfg>(
  roundId: string,
  matchId: string,
  stored: readonly StoredEvent[],
  state: RoundState<S, Cfg>,
): BatchWrite {
  const events = stored.map((s) => s.event as RoundEvent<unknown, unknown, Cfg>);
  const schedule = events.flatMap((e) =>
    e.type === 'CountdownStarted'
      ? [
          { kind: 'round_open', dueAt: e.opensAt },
          { kind: 'round_time_up', dueAt: e.endsAt },
        ]
      : [],
  );
  const end = events.find((e) => e.type === 'RoundEnded');
  const first = stored[0]?.seq ?? 0;
  const last = stored.at(-1)?.seq ?? 0;
  const crosses = Math.floor(last / SNAPSHOT_EVERY) > Math.floor((first - 1) / SNAPSHOT_EVERY);
  return {
    roundId,
    matchId,
    events: stored,
    status: {
      status: state.status,
      opensAt: state.opensAt,
      endedAt: state.endedAt,
      endReason: state.endReason,
      abortReason: state.abortReason,
    },
    snapshot: crosses ? { seq: last, state } : null,
    schedule,
    ended: end === undefined ? null : { results: end.results, teams: end.teams },
    finished: state.status === 'ended' || state.status === 'aborted',
  };
}
