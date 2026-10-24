/**
 * @file   apps/server/src/dev/bots.ts
 * @module server/dev
 * @brief  Development bots that play a running round like people: each guesses when its
 *         cooldown has ended, after a human-like pause.
 *
 * Responsibility: per bot one timer at a time (no global tick, like the players it stands
 *                 in for): wait until the round is open and the bot's cooldown is over, add a
 *                 pause of 200–1 500 ms (09 §5), ask the game's bot for its next action from
 *                 the bot's own player view, and send it through the round's queue like any
 *                 guess. A bot stops when it has nothing to do or the round is over.
 * Depends on:     node:crypto, @smg/game-sdk (DevBot), ../round/liveRound
 * Used by:        ./quickTest
 * Spec:           docs/spec/09-testing-strategy.md §5; docs/spec/11-roadmap.md (Quick Test)
 */
import { randomInt } from 'node:crypto';

import type { DevBot } from '@smg/game-sdk';

import type { LiveRound } from '../round/liveRound.js';

const pause = () => 200 + randomInt(1_301);

export function runBots(round: LiveRound, keys: readonly string[], bot: DevBot<unknown>): void {
  const later = (key: string, ms: number): void => {
    setTimeout(() => {
      turn(key);
    }, ms);
  };
  const turn = (key: string): void => {
    const status = round.status();
    if (status === 'ended' || status === 'aborted') return;
    const view = round.playerView(key);
    if (view === null) {
      // Not open yet: look again shortly.
      later(key, 250);
      return;
    }
    const wait = Math.max(0, (round.cooldownEndsAt(key) ?? 0) - Date.now());
    if (wait > 0) {
      later(key, wait + pause());
      return;
    }
    const action = bot(view, (n) => randomInt(n));
    if (action === null) return;
    void round.guess(key, action).then(() => {
      later(key, pause());
    });
  };
  for (const key of keys) later(key, pause());
}
