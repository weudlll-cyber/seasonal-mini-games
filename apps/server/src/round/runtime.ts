/**
 * @file   apps/server/src/round/runtime.ts
 * @module server/round
 * @brief  Builds the round runtime of one server process and starts or stops its timers.
 *
 * Responsibility: the store with the sealed-seed key, the rounds with the actor options of
 *                 08 §7 (`SMG_ENGINE_BATCH_MS`, `SMG_ENGINE_BATCH_MAX`) and the queue bound
 *                 setting, presence, the match use cases, the guess limits and the
 *                 scheduler; the game documents `game.<id>` for the settings service.
 *                 `start` recovers every running round and starts the timers; `stop` stops
 *                 them and waits until every open batch is written.
 * Depends on:     @smg/application, @smg-game/registry, ../config/*, ../db/pool, ../match/*, ./*
 * Used by:        ../http/app
 * Spec:           docs/spec/04-software-architecture.md §5; docs/spec/08-admin-settings.md §7
 */
import { gameSettingsDefs, type SettingsService } from '@smg/application';
import { GAMES } from '@smg-game/registry';
import type { SettingDef } from '@smg/game-sdk';

import type { Env } from '../config/env.js';
import { roundKeyFrom } from '../config/roundKey.js';
import type { DbPool } from '../db/pool.js';
import { Play } from '../match/play.js';
import { Presence } from '../match/presence.js';
import { GuessLimits } from './guessLimits.js';
import { PgRoundStore } from './pgRoundStore.js';
import { Rounds } from './rounds.js';
import { RoundScheduler } from './scheduler.js';

// Every registered game's settings document (08 §1: id `game.<gameId>`).
export function gameDocuments(): Record<string, readonly SettingDef[]> {
  return Object.fromEntries(
    GAMES.map((g) => [`game.${g.module.meta.id}`, gameSettingsDefs(g.module)]),
  );
}

export interface RoundRuntime {
  readonly store: PgRoundStore;
  readonly rounds: Rounds;
  readonly play: Play;
  readonly limits: GuessLimits;
  start(): Promise<number>;
  stop(): Promise<void>;
}

export function createRoundRuntime(
  env: Env,
  pool: DbPool,
  settings: SettingsService,
): RoundRuntime {
  const store = new PgRoundStore(pool, roundKeyFrom(env));
  const limits = new GuessLimits(settings, pool);
  const rounds = new Rounds(store, {
    batchMs: env.SMG_ENGINE_BATCH_MS,
    batchMax: env.SMG_ENGINE_BATCH_MAX,
    queueBound: () => limits.queueBound(),
    now: () => Date.now(),
  });
  const play = new Play(pool, rounds, settings, new Presence());
  const scheduler = new RoundScheduler(pool, rounds, env.SMG_SCHEDULER_POLL_MS);
  return {
    store,
    rounds,
    play,
    limits,
    start: async () => {
      limits.start();
      const recovered = await rounds.recoverRunning();
      scheduler.start();
      return recovered;
    },
    stop: async () => {
      limits.stop();
      await scheduler.stop();
      await rounds.drainAll();
    },
  };
}
