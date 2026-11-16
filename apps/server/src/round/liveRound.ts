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
 *                 the game's words for the secret after the end (the chat line, O32), the
 *                 fairness check, and draining before shutdown. A phased round (04 §4.8) has a
 *                 delayed room (./delayedRoom): its views are built at that room's cut and
 *                 numbered by its release sequence, its frames carry only each player's own
 *                 events (the room's come from the delayed room), and match players who join
 *                 or leave while it runs are told to it (`member`); at its opening a player's
 *                 pre-pick becomes their first choice, received at the opening (`prePick`).
 * Depends on:     @smg/application (verify), @smg/domain (types), @smg/game-sdk (GameEntry),
 *                 ./actor, ./delayedRoom, ./pgRoundStore (types), ./views
 * Used by:        ./gameRunner, ./rounds, ../realtime/*, ../http/routes/*, ../dev/*
 * Spec:           docs/spec/04-software-architecture.md §4.8, §5.2; docs/spec/06-data-model-api-realtime.md §3.1, §4.3
 */
import { verifyRound, type Verified } from '@smg/application';
import { frostDelay, type Reply, type RoundEvent, type RoundStatus } from '@smg/domain';
import type { GameEntry, GameModule, PhasePlan, RosterPlayer } from '@smg/game-sdk';

import type { RoundActor } from './actor.js';
import type { DelayedRoom } from './delayedRoom.js';
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
  // A phased round (04 §4.8): its room frames come from its delayed room.
  readonly phased: boolean;
  status(): RoundStatus;
  // A phased round's plan (04 §4.8), else null; the development bots time their entry by it.
  plan(): PhasePlan | null;
  rosterKeys(): string[];
  guess(playerKey: string, raw: unknown): Promise<Reply>;
  // A kicked player: no further guess of theirs reaches the round.
  exclude(playerKey: string): void;
  // A phased round: a match player joined (true) or left or was removed (false) (rule 3).
  member(playerKey: string, active: boolean): Promise<Reply>;
  // A phased round's opening: the player's pre-pick as their first choice, received at the
  // opening (rule 8); null when it makes none or the player is in the round already.
  prePick(playerKey: string, prefs: unknown, roundIndex: number): Promise<Reply | null>;
  run(cmd: LifecycleCommand): Promise<Reply>;
  view(viewerKey: string | null): unknown;
  // The game's own player view of a roster player while the round runs (development bots).
  playerView(playerKey: string): unknown;
  cooldownEndsAt(playerKey: string): number | null;
  frames(events: readonly StoredEvent[], held: ReadonlySet<number>): Frames;
  // After the end: the secret in the game's words ("the number was 42"), else null.
  reveal(winner: string | null): string | null;
  verify(log: readonly StoredEvent[]): Verified<unknown>;
  drain(): Promise<void>;
  // Unanswered items in its queue (metrics).
  queued(): number;
  // Drains and stops the round's timers (shutdown).
  close(): Promise<void>;
}

// A phased round's own frames: numbered by the room's release sequence, never the log's seq,
// which would count actions nobody may see yet (04 §4.8 rule 5).
function ownFrames(frames: Frames, delayed: DelayedRoom): Frames {
  const s = delayed.seq();
  const players = new Map(
    [...frames.players].map(([key, own]) => [key, own.map((e) => ({ ...e, s }))]),
  );
  return { room: [], players, host: [] };
}

// What viewers get: views at the round's cut (a phased round's delayed room, else Frost's),
// numbered by that room's sequence or the log's, and the frames per audience.
function readers<S, A, E, Cfg, Sec>(
  module: GameModule<S, A, E, Cfg, Sec>,
  actor: RoundActor<S, A, E, Cfg, Sec>,
  delayed: DelayedRoom | null,
): Pick<LiveRound, 'view' | 'playerView' | 'frames'> {
  const state = () => actor.current.state;
  const frostCut = () => {
    const delay = frostDelay(state());
    return delay === null ? Infinity : Date.now() - delay;
  };
  return {
    view: (viewerKey) =>
      roundView(
        actor.current,
        module.views,
        { key: viewerKey, now: Date.now(), ...(delayed === null ? {} : { cut: delayed.cut() }) },
        delayed === null ? actor.seq : delayed.seq(),
      ),
    playerView: (playerKey) => {
      const s = state();
      if (s.game === null || s.status !== 'open' || s.roster[playerKey] === undefined) return null;
      // A bot sees an answer when a person would: after Frost's delay, or a phased round's.
      const releasedBefore = delayed === null ? frostCut() : delayed.cut();
      return module.views.player(s.game, playerKey, { releasedBefore });
    },
    frames: (events, held) => {
      const frames = framesOf(events, held, () => actor.current.result());
      return delayed === null ? frames : ownFrames(frames, delayed);
    },
  };
}

// A phased round's opening: a player's pre-pick as their first choice, received at the opening
// (04 §4.8 rule 8). Someone who chose in person already keeps their choice; the check and the
// queue run in one go, so nothing comes between them.
function prePickOf<S, A, E, Cfg, Sec>(
  module: GameModule<S, A, E, Cfg, Sec>,
  actor: RoundActor<S, A, E, Cfg, Sec>,
  excluded: ReadonlySet<string>,
): LiveRound['prePick'] {
  return (playerKey, prefs, roundIndex) => {
    const s = actor.current.state;
    const action = module.phased?.prefs?.action(prefs, roundIndex, s.gameConfig) ?? null;
    if (action === null || s.roster[playerKey]?.enteredAt != null) return Promise.resolve(null);
    if (excluded.has(playerKey)) return Promise.resolve({ ok: false, code: 'NOT_IN_ROUND' });
    const receivedAt = s.opensAt ?? Date.now();
    return actor.submit(() => ({ type: 'guess', playerId: playerKey, receivedAt, action }));
  };
}

export function liveRound<S, A, E, Cfg, Sec>(
  entry: GameEntry<S, A, E, Cfg, Sec>,
  actor: RoundActor<S, A, E, Cfg, Sec>,
  delayed: DelayedRoom | null = null,
): LiveRound {
  const module = entry.module;
  const state = () => actor.current.state;
  const excluded = new Set<string>();
  return {
    id: actor.roundId,
    matchId: actor.matchId,
    gameId: module.meta.id,
    phased: delayed !== null,
    status: () => state().status,
    plan: () => state().plan ?? null,
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
    member: (playerKey, active) =>
      delayed === null
        ? Promise.resolve({ ok: true })
        : actor.submit((now) => ({ type: 'member', at: now, playerId: playerKey, active })),
    prePick: prePickOf(module, actor, excluded),
    run: (cmd) => actor.submit((now) => ({ ...cmd, at: now })),
    ...readers(module, actor, delayed),
    cooldownEndsAt: (playerKey) => state().roster[playerKey]?.cooldownEndsAt ?? null,
    reveal: (winner) => {
      const result = actor.current.result();
      return result === null ? null : (module.reveal?.(result, winner) ?? null);
    },
    verify: (log) =>
      verifyRound(
        module,
        log.map((e) => e.event as RoundEvent<E, A, Cfg>),
      ),
    drain: () => actor.drain(),
    queued: () => actor.queued,
    close: async () => {
      await actor.drain();
      actor.stop();
      delayed?.stop();
    },
  };
}
