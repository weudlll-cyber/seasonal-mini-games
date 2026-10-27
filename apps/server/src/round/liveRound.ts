/**
 * @file   apps/server/src/round/liveRound.ts
 * @module server/round
 * @brief  The game-agnostic face of one running round: commands in, views and frames out.
 *
 * Responsibility: what routes, the gateway, the scheduler and the bots may do with a round
 *                 without knowing its game: a guess (parsed with the game's action schema,
 *                 refused as INVALID_ACTION otherwise, never queued), lifecycle commands
 *                 stamped with the processing time, players staff kicked (their guesses are
 *                 refused as NOT_IN_ROUND, never queued), views per viewer, frames per audience,
 *                 the fairness check, and draining before shutdown.
 * Depends on:     @smg/application (verify), @smg/domain (types), @smg/game-sdk (GameEntry),
 *                 ./actor, ./pgRoundStore (types), ./views
 * Used by:        ./gameRunner, ./rounds, ../realtime/*, ../http/routes/*, ../dev/*
 * Spec:           docs/spec/04-software-architecture.md §5.2; docs/spec/06-data-model-api-realtime.md §3.1, §4.3
 */
import { verifyRound, type Verified } from '@smg/application';
import { frostDelay, type Reply, type RoundEvent, type RoundStatus } from '@smg/domain';
import type { GameEntry, RosterPlayer } from '@smg/game-sdk';

import type { RoundActor } from './actor.js';
import type { StoredEvent } from './pgRoundStore.js';
import { framesOf, roundView, type Frames } from './views.js';

export type LifecycleCommand =
  | {
      readonly type: 'startCountdown';
      readonly roster: readonly RosterPlayer[];
      readonly minPlayers: number;
    }
  | { readonly type: 'open' }
  | { readonly type: 'timeUp' }
  | { readonly type: 'end'; readonly reason: 'host' | 'noPlayers' }
  | { readonly type: 'abort'; readonly reason: string; readonly by: string };

export interface LiveRound {
  readonly id: string;
  readonly matchId: string;
  readonly gameId: string;
  status(): RoundStatus;
  rosterKeys(): string[];
  guess(playerKey: string, raw: unknown): Promise<Reply>;
  // A kicked player: no further guess of theirs reaches the round.
  exclude(playerKey: string): void;
  run(cmd: LifecycleCommand): Promise<Reply>;
  view(viewerKey: string | null): unknown;
  // The game's own player view of a roster player while the round runs (development bots).
  playerView(playerKey: string): unknown;
  cooldownEndsAt(playerKey: string): number | null;
  frames(events: readonly StoredEvent[], held: ReadonlySet<number>): Frames;
  verify(log: readonly StoredEvent[]): Verified<unknown>;
  drain(): Promise<void>;
  // Drains and stops the round's timers (shutdown).
  close(): Promise<void>;
}

export function liveRound<S, A, E, Cfg, Sec>(
  entry: GameEntry<S, A, E, Cfg, Sec>,
  actor: RoundActor<S, A, E, Cfg, Sec>,
): LiveRound {
  const module = entry.module;
  const state = () => actor.current.state;
  const excluded = new Set<string>();
  return {
    id: actor.roundId,
    matchId: actor.matchId,
    gameId: module.meta.id,
    status: () => state().status,
    rosterKeys: () => Object.keys(state().roster),
    guess: (playerKey, raw) => {
      if (excluded.has(playerKey)) return Promise.resolve({ ok: false, code: 'NOT_IN_ROUND' });
      const parsed = module.actionSchema.safeParse(raw);
      if (!parsed.success) return Promise.resolve({ ok: false, code: 'INVALID_ACTION' });
      return actor.submit((now) => ({
        type: 'guess',
        playerId: playerKey,
        receivedAt: now,
        action: parsed.data,
      }));
    },
    exclude: (playerKey) => {
      excluded.add(playerKey);
    },
    run: (cmd) => actor.submit((now) => ({ ...cmd, at: now })),
    view: (viewerKey) =>
      roundView(actor.current, module.views, { key: viewerKey, now: Date.now() }, actor.seq),
    playerView: (playerKey) => {
      const s = state();
      if (s.game === null || s.status !== 'open' || s.roster[playerKey] === undefined) return null;
      // A bot sees an answer when a person would: after Frost's delay.
      const delay = frostDelay(s);
      const releasedBefore = delay === null ? Infinity : Date.now() - delay;
      return module.views.player(s.game, playerKey, { releasedBefore });
    },
    cooldownEndsAt: (playerKey) => state().roster[playerKey]?.cooldownEndsAt ?? null,
    frames: (events, held) => framesOf(events, held, () => actor.current.result()),
    verify: (log) =>
      verifyRound(
        module,
        log.map((e) => e.event as RoundEvent<E, A, Cfg>),
      ),
    drain: () => actor.drain(),
    close: async () => {
      await actor.drain();
      actor.stop();
    },
  };
}
