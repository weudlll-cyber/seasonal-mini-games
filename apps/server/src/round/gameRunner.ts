/**
 * @file   apps/server/src/round/gameRunner.ts
 * @module server/round
 * @brief  Runs the rounds of one registered game behind a game-agnostic LiveRound.
 *
 * Responsibility: the only place where a game's types meet the server. Creating a round
 *                 (settings from the game's document and the host's choices, the seed, the
 *                 sealed row with RoundCreated), recovering one from the database (snapshot
 *                 and tail, or the whole log), and a LiveRound whose actions are parsed with
 *                 the game's action schema before they enter the queue. Everything outside
 *                 sees unknown views and opaque events.
 * Depends on:     node:crypto, @smg/application (round session, settings, verify),
 *                 @smg/domain (types), @smg/game-sdk (GameEntry), ./actor, ./pgRoundStore,
 *                 ./views, ./liveRound
 * Used by:        ./rounds
 * Spec:           docs/spec/04-software-architecture.md §4, §5; docs/spec/06-data-model-api-realtime.md §3.1
 */
import { randomUUID } from 'node:crypto';

import { chooseRoundSettings, RoundSession } from '@smg/application';
import type { RoundEvent, RoundState } from '@smg/domain';
import type { GameEntry, PlatformRoundConfig, Season, SettingOverride } from '@smg/game-sdk';

import { RoundActor, type ActorOptions, type Delivery } from './actor.js';
import { liveRound, type LiveRound } from './liveRound.js';
import type { LoadedRound, PgRoundStore, StoredEvent } from './pgRoundStore.js';

export interface NewRound {
  readonly matchId: string;
  readonly overrides: Readonly<Record<string, SettingOverride>>;
  readonly choices: Readonly<Record<string, unknown>>;
  readonly season: Season;
  readonly seasonSource: 'inSeason' | 'manual';
  readonly createdBy: string | null;
  readonly seed: Uint8Array;
  // Development only: the fast test profile (09 §4).
  readonly fast: boolean;
}

// The fast test profile of development builds (09 §4): specials every few seconds and a
// short countdown; the cooldown stays as chosen, so Heatwave has room to step down.
// Published defaults are untouched.
function fastProfile(p: PlatformRoundConfig): PlatformRoundConfig {
  return {
    ...p,
    countdownMs: 3_000,
    specials: {
      heatwave: { stepMs: 1_000, intervalMs: 5_000 },
      frostDelayMs: 3_000,
      leafFall: { intervalMs: 5_000, count: p.specials.leafFall.count },
      halvingIntervalMs: 6_000,
    },
  };
}

export interface RunnerDeps {
  readonly store: PgRoundStore;
  readonly options: ActorOptions;
  readonly committed: (round: LiveRound, events: readonly StoredEvent[], how: Delivery) => void;
}

export class GameRunner<S, A, E, Cfg, Sec> {
  constructor(
    readonly entry: GameEntry<S, A, E, Cfg, Sec>,
    private readonly deps: RunnerDeps,
  ) {}

  // Throws RoundSettingsError (ROUND_SETTINGS_INVALID) for choices outside the bounds.
  async create(round: NewRound): Promise<LiveRound> {
    const module = this.entry.module;
    const id = randomUUID();
    const chosen = chooseRoundSettings(module, round.overrides, round.choices);
    const settings = round.fast ? { ...chosen, platform: fastProfile(chosen.platform) } : chosen;
    const { session, event } = RoundSession.create(module, {
      roundId: id,
      settings,
      season: round.season,
      seed: round.seed,
    });
    const p = settings.platform;
    await this.deps.store.create(
      {
        id,
        matchId: round.matchId,
        gameId: module.meta.id,
        secretMode: p.secretMode,
        season: round.season,
        seasonSource: round.seasonSource,
        specialOn: p.specialOn,
        halving: p.halving,
        teamsOn: p.teamsOn && p.secretMode === 'shared',
        cooldownMs: p.cooldownMs,
        settings: { platform: p, game: settings.game },
        commitment: session.state.commitment,
        seed: round.seed,
        createdBy: round.createdBy,
      },
      { seq: 1, at: this.deps.options.now(), type: event.type, event },
    );
    return this.live({ id, matchId: round.matchId }, session, 1);
  }

  recover(loaded: LoadedRound): LiveRound {
    const { session, lastSeq } = this.sessionFrom(loaded);
    return this.live(
      { id: loaded.id, matchId: loaded.matchId },
      session,
      lastSeq,
      loaded.undelivered,
    );
  }

  private sessionFrom(loaded: LoadedRound) {
    const module = this.entry.module;
    const tail = loaded.events.map((e) => e.event as RoundEvent<E, A, Cfg>);
    const session =
      loaded.snapshot === null
        ? RoundSession.recover(module, loaded.seed, tail)
        : RoundSession.resume(
            module,
            loaded.seed,
            loaded.snapshot.state as RoundState<S, Cfg>,
            tail,
          );
    return { session, lastSeq: loaded.events.at(-1)?.seq ?? loaded.snapshot?.seq ?? 0 };
  }

  private live(
    ids: { readonly id: string; readonly matchId: string },
    session: RoundSession<S, A, E, Cfg, Sec>,
    lastSeq: number,
    undelivered: readonly StoredEvent[] = [],
  ): LiveRound {
    const { store, options } = this.deps;
    let round: LiveRound | null = null;
    const { id, matchId } = ids;
    const actor = new RoundActor({ roundId: id, matchId }, session, lastSeq, {
      store,
      options,
      committed: (events, how) => {
        if (round !== null) this.deps.committed(round, events, how);
      },
      reload: async () => {
        const loaded = await store.load(id);
        if (loaded === null) throw new Error(`round ${id} vanished`);
        return this.sessionFrom(loaded);
      },
    });
    round = liveRound(this.entry, actor);
    actor.restoreHeld(undelivered);
    return round;
  }
}
