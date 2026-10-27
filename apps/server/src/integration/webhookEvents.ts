/**
 * @file   apps/server/src/integration/webhookEvents.ts
 * @module server/integration
 * @brief  Queues the webhook events of 07 §3.2 from the match and round lifecycle.
 *
 * Responsibility: `match.opened` and `match.closed` from Play's lifecycle; `round.countdown`
 *                 (with `opensAt`) and `round.ended` (winner and placings by display name,
 *                 season, halving) from the rounds' committed events, as ../chat/roundLines
 *                 listens: under Frost an end goes out only once it is released. Nothing of a
 *                 running round's secret is ever in a payload (05 §3). A failure is logged and
 *                 never touches the round.
 * Depends on:     @smg/contracts (types), ../match/*, ./publicQueries, ./webhooks
 * Used by:        ../http/app
 * Spec:           docs/spec/07-integration.md §3.2; Bingo 07 §5
 */
import type { WebhookEvent } from '@smg/contracts';

import type { MatchRow } from '../match/matches.js';
import type { Play } from '../match/play.js';
import { placings } from './publicQueries.js';
import type { WebhookStore } from './webhooks.js';

interface RoundFacts {
  match: string;
  round_index: number;
  season: string;
  halving: boolean;
}

async function roundFacts(store: WebhookStore, roundId: string): Promise<RoundFacts | null> {
  const r = await store.pool.query<RoundFacts>(
    `SELECT m.code AS match, r.round_index, r.season, r.halving
     FROM smg.rounds r JOIN smg.matches m ON m.id = r.match_id WHERE r.id = $1`,
    [roundId],
  );
  return r.rows[0] ?? null;
}

async function roundEvent(
  store: WebhookStore,
  event: WebhookEvent,
  roundId: string,
  extra: (facts: RoundFacts) => Promise<Record<string, unknown>>,
): Promise<void> {
  const facts = await roundFacts(store, roundId);
  if (facts === null) return;
  await store.enqueue(event, {
    match: facts.match,
    roundId,
    round: facts.round_index,
    season: facts.season,
    halving: facts.halving,
    ...(await extra(facts)),
  });
}

async function ended(store: WebhookStore, roundId: string, event: { reason: string }) {
  await roundEvent(store, 'round.ended', roundId, async () => {
    const placed = await placings(store.pool, roundId);
    return { reason: event.reason, winner: placed[0]?.name ?? null, placings: placed };
  });
}

const logged = (what: string) => (error: unknown) => {
  console.error(`[smg] webhook ${what} not queued:`, error);
};

const matchData = (m: MatchRow) => ({
  match: m.code,
  title: m.title,
  game: m.gameId,
  status: m.status,
});

export function queueLifecycleWebhooks(store: WebhookStore, play: Play): void {
  play.onLifecycle((what, match) => {
    const event = what === 'opened' ? 'match.opened' : 'match.closed';
    store.enqueue(event, matchData(match)).catch(logged(event));
  });
  play.rounds.onCommitted((round, events, how) => {
    for (const stored of events) {
      if (stored.type === 'CountdownStarted') {
        const { opensAt } = stored.event as { opensAt: number };
        roundEvent(store, 'round.countdown', round.id, () => Promise.resolve({ opensAt })).catch(
          logged('round.countdown'),
        );
      }
      // A held end (Frost) comes again when it is released, without `held`.
      if (stored.type === 'RoundEnded' && !how.held.has(stored.seq)) {
        // Placings are read from the results written with this end (06 §2.4).
        ended(store, round.id, stored.event as { reason: string }).catch(logged('round.ended'));
      }
    }
  });
}
