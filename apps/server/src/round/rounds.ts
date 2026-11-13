/**
 * @file   apps/server/src/round/rounds.ts
 * @module server/round
 * @brief  Every round of this server: one runner per registered game, the live rounds,
 *         recovery after a restart, and committed batches to subscribers.
 *
 * Responsibility: the registry is read once (04 §4.6: games are found only there); a round
 *                 is created through its game's runner; a round that is not in memory is
 *                 loaded from the database (running rounds at start, ended ones on demand
 *                 for views, with the players staff kicked from its match, and a phased one
 *                 with its whole log for its delayed room); committed events and a phased
 *                 round's released frames go to every subscriber (the gateway); a phased game's
 *                 series and a settings check for a series' next round. The list of
 *                 games is the registry's, or one given by a test (a phased fixture, 09 §4.2).
 * Depends on:     @smg/application (settings), @smg-game/registry, ./gameRunner, ./liveRound,
 *                 ./pgRoundStore, ./actor,
 *                 ./delayedRoom (types)
 * Used by:        ../http/app, ../http/routes/*, ../realtime/*, ../dev/*, ./scheduler
 * Spec:           docs/spec/04-software-architecture.md §4.6, §4.8, §5.2, §5.3
 */
import { GAMES, type InstalledGame } from '@smg-game/registry';
import { chooseRoundSettings, gameSettingsDefs } from '@smg/application';
import type { DevBot, GameEntry, Series, SettingOverride } from '@smg/game-sdk';
import type { ZodType } from 'zod';

import type { ActorOptions, Delivery } from './actor.js';
import type { Released } from './delayedRoom.js';
import { GameRunner, type NewRound } from './gameRunner.js';
import type { LiveRound } from './liveRound.js';
import type { LoadedRound, PgRoundStore, StoredEvent } from './pgRoundStore.js';

export interface GameInfo {
  readonly id: string;
  readonly name: string;
  readonly secretModes: readonly string[];
  readonly teams: boolean;
  readonly timing: 'cooldown' | 'phased';
}

interface Runner {
  readonly info: GameInfo;
  readonly devBot: DevBot<unknown>;
  // The game's own keys a host may choose per round (the Quick Test sends only these).
  readonly hostKeys: ReadonlySet<string>;
  // A phased game (04 §4.8): its recovered rounds need their whole log.
  readonly phased: boolean;
  // The keys of the game's settings document (a phased game's has few platform keys).
  readonly docKeys: ReadonlySet<string>;
  // A phased game's series from a match's first round's config (rule 7), else null.
  series(gameConfig: unknown): Series | null;
  // A phased game's prefs value as its schema reads it, or undefined (rule 8); null: none.
  readonly parsePrefs: ((raw: unknown) => unknown) | null;
  // A development bot's pre-picks for a match of `rounds` rounds, or null (09 §4.2).
  readonly devPrefs: ((pick: (n: number) => number, rounds: number) => unknown) | null;
  // Throws RoundSettingsError for choices the round form would refuse.
  check(
    overrides: Readonly<Record<string, SettingOverride>>,
    choices: Readonly<Record<string, unknown>>,
  ): void;
  create(round: NewRound): Promise<LiveRound>;
  recover(loaded: LoadedRound, log: readonly StoredEvent[] | null): LiveRound;
}

// The game's prefs schema as a parser: the value it reads, or undefined (rule 8).
function prefsParser(schema: ZodType | undefined): ((raw: unknown) => unknown) | null {
  if (schema === undefined) return null;
  return (raw) => {
    const parsed = schema.safeParse(raw);
    return parsed.success ? parsed.data : undefined;
  };
}

type Listener = (round: LiveRound, events: readonly StoredEvent[], how: Delivery) => void;
type ReleaseListener = (round: LiveRound, released: Released) => void;

export class Rounds {
  private readonly runners = new Map<string, Runner>();
  private readonly live = new Map<string, LiveRound>();
  private readonly listeners: Listener[] = [];
  private readonly releaseListeners: ReleaseListener[] = [];

  constructor(
    private readonly store: PgRoundStore,
    options: ActorOptions,
    games: readonly InstalledGame[] = GAMES,
  ) {
    for (const game of games) {
      game.use((entry) => {
        this.add(entry, options);
      });
    }
  }

  private add<S, A, E, Cfg, Sec>(entry: GameEntry<S, A, E, Cfg, Sec>, options: ActorOptions) {
    const runner = new GameRunner(entry, {
      store: this.store,
      options,
      committed: (round, events, how) => {
        for (const l of this.listeners) l(round, events, how);
      },
      released: (round, released) => {
        for (const l of this.releaseListeners) l(round, released);
      },
    });
    const { meta } = entry.module;
    this.runners.set(meta.id, {
      info: {
        id: meta.id,
        name: meta.name,
        secretModes: meta.secretModes,
        teams: meta.teams,
        timing: meta.timing,
      },
      devBot: entry.devBot,
      hostKeys: new Set(entry.module.settings.defs.filter((d) => d.hostChooses).map((d) => d.key)),
      phased: meta.timing === 'phased',
      docKeys: new Set(gameSettingsDefs(entry.module).map((d) => d.key)),
      series: (cfg) => entry.module.phased?.series(cfg as Cfg) ?? null,
      parsePrefs: prefsParser(entry.module.phased?.prefs?.schema),
      devPrefs: entry.devPrefs ?? null,
      check: (overrides, choices) => {
        chooseRoundSettings(entry.module, overrides, choices);
      },
      create: (round) => runner.create(round),
      recover: (loaded, log) => runner.recover(loaded, log),
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

  // Whether the game plays season teams (a game without has no team keys, 04 §4.8 rule 3).
  teams(gameId: string): boolean {
    return this.runners.get(gameId)?.info.teams ?? false;
  }

  // A series match's number of rounds and pause, from its first round's config (04 §4.8 rule 7).
  series(gameId: string, gameConfig: unknown): Series | null {
    return this.runners.get(gameId)?.series(gameConfig) ?? null;
  }

  // The next round's settings of a series, checked as a new round's are (06 §3.1).
  checkSettings(
    gameId: string,
    overrides: Readonly<Record<string, SettingOverride>>,
    choices: Readonly<Record<string, unknown>>,
  ): void {
    this.runners.get(gameId)?.check(overrides, choices);
  }

  // A phased game with per-player match data (04 §4.8 rule 8).
  hasPrefs(gameId: string): boolean {
    return (this.runners.get(gameId)?.parsePrefs ?? null) !== null;
  }

  // A prefs value as the game's schema reads it, or undefined when it does not fit.
  parsePrefs(gameId: string, raw: unknown): unknown {
    return this.runners.get(gameId)?.parsePrefs?.(raw);
  }

  devPrefs(gameId: string): ((pick: (n: number) => number, rounds: number) => unknown) | null {
    return this.runners.get(gameId)?.devPrefs ?? null;
  }

  // Every key of the game's settings document (the Quick Test sends only these).
  documentKeys(gameId: string): ReadonlySet<string> {
    return this.runners.get(gameId)?.docKeys ?? new Set();
  }

  hostKeys(gameId: string): ReadonlySet<string> {
    return this.runners.get(gameId)?.hostKeys ?? new Set();
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
    const log = runner.phased ? await this.store.log(roundId) : null;
    const first = this.live.get(roundId);
    if (first !== undefined) return first;
    const live = runner.recover(loaded, log);
    for (const key of loaded.kicked) live.exclude(key);
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

  // The rounds in memory by status and their unanswered items, for the metrics scrape.
  stats(): { byStatus: Record<string, number>; queued: number } {
    const byStatus: Record<string, number> = {};
    let queued = 0;
    for (const r of this.live.values()) {
      byStatus[r.status()] = (byStatus[r.status()] ?? 0) + 1;
      queued += r.queued();
    }
    return { byStatus, queued };
  }

  onCommitted(listener: Listener): void {
    this.listeners.push(listener);
  }

  // A phased round's delayed room released frames (04 §4.8 rule 5).
  onReleased(listener: ReleaseListener): void {
    this.releaseListeners.push(listener);
  }

  // Shutdown: every open batch is written, then no timer of a round fires any more.
  async drainAll(): Promise<void> {
    await Promise.all([...this.live.values()].map((r) => r.close()));
  }
}
