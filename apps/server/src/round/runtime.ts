/**
 * @file   apps/server/src/round/runtime.ts
 * @module server/round
 * @brief  Builds the round runtime of one server process and starts or stops its timers.
 *
 * Responsibility: the store with the sealed-seed key and the league rules, the rounds with the actor options of
 *                 08 §7 (`SMG_ENGINE_BATCH_MS`, `SMG_ENGINE_BATCH_MAX`) and the queue bound
 *                 setting, presence, the match use cases, the guess limits and the
 *                 scheduler, with the metrics' observer when given, and the idle close of
 *                 matches (O28), the series of a phased game's matches (../match/series); the game documents `game.<id>` for the settings service, for
 *                 the installed games the caller names (the registry's, or a test's).
 *                 `start` recovers every running round, closes the matches that went idle
 *                 meanwhile and starts the timers; `stop` stops them and waits until every open
 *                 batch is written.
 * Depends on:     @smg/application, @smg-game/registry, ../config/*, ../db/pool, ../league/rules,
 *                 ../match/*, ./*
 * Used by:        ../http/app
 * Spec:           docs/spec/04-software-architecture.md §5; docs/spec/08-admin-settings.md §7
 */
import { gameSettingsDefs, type SettingsService } from '@smg/application';
import { GAMES, type InstalledGame } from '@smg-game/registry';
import type { SettingDef } from '@smg/game-sdk';

import type { Env } from '../config/env.js';
import { roundKeyFrom } from '../config/roundKey.js';
import type { DbPool } from '../db/pool.js';
import { IdleClose } from '../match/idleClose.js';
import { Play } from '../match/play.js';
import { Presence } from '../match/presence.js';
import { SeriesRunner } from '../match/series.js';
import { rosterAdmission } from '../match/rosterRules.js';
import { leagueRules } from '../league/rules.js';
import { GuessLimits } from './guessLimits.js';
import type { RoundObserver } from './actor.js';
import { PgRoundStore } from './pgRoundStore.js';
import { Rounds } from './rounds.js';
import { Seasons } from '../seasons/seasons.js';
import { RoundScheduler } from './scheduler.js';

// Every installed game's settings document (08 §1: id `game.<gameId>`).
export function gameDocuments(
  games: readonly InstalledGame[] = GAMES,
): Record<string, readonly SettingDef[]> {
  return Object.fromEntries(
    games.map((g) => [`game.${g.id}`, g.use((e) => gameSettingsDefs(e.module))]),
  );
}

export interface RoundRuntime {
  readonly store: PgRoundStore;
  readonly rounds: Rounds;
  readonly play: Play;
  readonly limits: GuessLimits;
  readonly seasons: Seasons;
  readonly series: SeriesRunner;
  start(): Promise<number>;
  stop(): Promise<void>;
}

// The metrics' observer; the installed games (the registry's, or a test's list with the
// phased fixture).
interface RuntimeExtra {
  readonly observe?: RoundObserver;
  readonly games?: readonly InstalledGame[] | undefined;
}

// The rounds with the actor options of 08 §7 and the queue bound setting.
function roundsOf(env: Env, store: PgRoundStore, limits: GuessLimits, extra: RuntimeExtra): Rounds {
  const { observe, games = GAMES } = extra;
  const options = {
    batchMs: env.SMG_ENGINE_BATCH_MS,
    batchMax: env.SMG_ENGINE_BATCH_MAX,
    queueBound: () => limits.queueBound(),
    now: () => Date.now(),
    ...(observe === undefined ? {} : { observe }),
  };
  return new Rounds(store, options, games);
}

// A series' next round or close after each of its phased rounds (04 §4.8 rule 7).
function seriesOf(pool: DbPool, play: Play, rounds: Rounds): SeriesRunner {
  const series = new SeriesRunner(pool, play);
  rounds.onCommitted((round, events) => {
    if (round.phased && events.some((e) => e.type === 'RoundEnded')) void series.roundEnded(round);
  });
  return series;
}

export function createRoundRuntime(
  env: Env,
  pool: DbPool,
  settings: SettingsService,
  extra: RuntimeExtra = {},
): RoundRuntime {
  const store = new PgRoundStore(pool, roundKeyFrom(env), () => leagueRules(settings));
  const limits = new GuessLimits(settings, pool);
  const rounds = roundsOf(env, store, limits, extra);
  const devFeed = env.SMG_DEV ? (env.SMG_DEV_FEED_URL ?? null) : null;
  const seasons = new Seasons(pool, settings, devFeed);
  // Website mode ignores the linked-chat rule (DECISIONS T222).
  const admit = rosterAdmission(pool, settings, env.SMG_AUTH_MODE === 'website');
  const play = new Play(pool, rounds, settings, { presence: new Presence(), seasons, admit });
  const series = seriesOf(pool, play, rounds);
  const scheduler = new RoundScheduler(pool, rounds, env.SMG_SCHEDULER_POLL_MS, (id) =>
    series.due(id),
  );
  const idle = new IdleClose(pool, play, settings);
  return {
    store,
    rounds,
    play,
    limits,
    seasons,
    series,
    start: async () => {
      limits.start();
      seasons.start();
      const recovered = await rounds.recoverRunning();
      // Their frames name players by number at once (../match/publicIds).
      await play.loadRunningNumbers();
      // A series' next step that a stop missed is scheduled now.
      await series.sweep();
      scheduler.start();
      // Matches that went idle while the server was down close now (O28).
      await idle.sweep();
      idle.start();
      return recovered;
    },
    stop: async () => {
      idle.stop();
      limits.stop();
      seasons.stop();
      await scheduler.stop();
      await rounds.drainAll();
    },
  };
}
