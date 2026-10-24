/**
 * @file   apps/server/src/round/rounds.ts
 * @module server/round
 * @brief  Every round of this server: one runner per registered game, the live rounds,
 *         recovery after a restart, and committed batches to subscribers.
 *
 * Responsibility: the registry is read once (04 §4.6: games are found only there); a round
 *                 is created through its game's runner; a round that is not in memory is
 *                 loaded from the database (running rounds at start, ended ones on demand
 *                 for views); committed events go to every subscriber (the gateway).
 * Depends on:     @smg-game/registry, ./gameRunner, ./liveRound, ./pgRoundStore, ./actor
 * Used by:        ../http/app, ../http/routes/*, ../realtime/*, ../dev/*, ./scheduler
 * Spec:           docs/spec/04-software-architecture.md §4.6, §5.2, §5.3
 */
import { GAMES } from '@smg-game/registry';
import type { DevBot, GameEntry } from '@smg/game-sdk';

import type { ActorOptions, Delivery } from './actor.js';
import { GameRunner, type NewRound } from './gameRunner.js';
import type { LiveRound } from './liveRound.js';
import type { LoadedRound, PgRoundStore, StoredEvent } from './pgRoundStore.js';

export interface GameInfo {
  readonly id: string;
  readonly name: string;
  readonly secretModes: readonly string[];
  readonly teams: boolean;
}

interface Runner {
  readonly info: GameInfo;
  readonly devBot: DevBot<unknown>;
  create(round: NewRound): Promise<LiveRound>;
  recover(loaded: LoadedRound): LiveRound;
}

type Listener = (round: LiveRound, events: readonly StoredEvent[], how: Delivery) => void;

export class Rounds {
  private readonly runners = new Map<string, Runner>();
  private readonly live = new Map<string, LiveRound>();
  private readonly listeners: Listener[] = [];

  constructor(
    private readonly store: PgRoundStore,
    options: ActorOptions,
  ) {
    for (const entry of GAMES) this.add(entry, options);
  }

  private add<S, A, E, Cfg, Sec>(entry: GameEntry<S, A, E, Cfg, Sec>, options: ActorOptions) {
    const runner = new GameRunner(entry, {
      store: this.store,
      options,
      committed: (round, events, how) => {
        for (const l of this.listeners) l(round, events, how);
      },
    });
    const { meta } = entry.module;
    this.runners.set(meta.id, {
      info: { id: meta.id, name: meta.name, secretModes: meta.secretModes, teams: meta.teams },
      devBot: entry.devBot,
      create: (round) => runner.create(round),
      recover: (loaded) => runner.recover(loaded),
    });
  }

  games(): GameInfo[] {
    return [...this.runners.values()].map((r) => r.info);
  }

  hasGame(gameId: string): boolean {
    return this.runners.has(gameId);
  }

  devBot(gameId: string): DevBot<unknown> | null {
    return this.runners.get(gameId)?.devBot ?? null;
  }

  async create(gameId: string, round: NewRound): Promise<LiveRound> {
    const runner = this.runners.get(gameId);
    if (runner === undefined) throw new Error(`unknown game ${gameId}`);
    const live = await runner.create(round);
    this.live.set(live.id, live);
    return live;
  }

  async get(roundId: string): Promise<LiveRound | null> {
    const known = this.live.get(roundId);
    if (known !== undefined) return known;
    const loaded = await this.store.load(roundId);
    const runner = loaded === null ? undefined : this.runners.get(loaded.gameId);
    if (loaded === null || runner === undefined) return null;
    // Another call may have loaded it meanwhile; keep the first.
    const live = this.live.get(roundId) ?? runner.recover(loaded);
    this.live.set(roundId, live);
    return live;
  }

  // In memory only: the gateway's synchronous path (a round not in memory is not running).
  peek(roundId: string): LiveRound | null {
    return this.live.get(roundId) ?? null;
  }

  // Start-up: every round that was running continues from its log (04 §5.3).
  async recoverRunning(): Promise<number> {
    const ids = await this.store.running();
    for (const id of ids) await this.get(id);
    return ids.length;
  }

  onCommitted(listener: Listener): void {
    this.listeners.push(listener);
  }

  // Shutdown: every open batch is written, then no timer of a round fires any more.
  async drainAll(): Promise<void> {
    await Promise.all([...this.live.values()].map((r) => r.close()));
  }
}
