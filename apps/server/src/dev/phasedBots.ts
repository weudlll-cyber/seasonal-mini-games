/**
 * @file   apps/server/src/dev/phasedBots.ts
 * @module server/dev
 * @brief  The Quick Test's bots in a phased game: seeded plans and pre-picks (09 §4.2).
 *
 * Responsibility: the seed decides every bot's plan, through a DRBG keyed by the Quick Test's
 *                 seed: per round (`quicktest/<round index>/<bot>`) its draws for the game's
 *                 bot and the time of its first move, spread over the round's entry window;
 *                 and once per match (`quicktest/prefs/<bot>`) whether it fixes its picks in
 *                 advance (the game's `devPrefs`) and stays away. A bot that pre-picks is saved
 *                 like a player's value (../match/prefs) and does not join as connected, so the
 *                 round plays it by its pre-picks alone. The same seed and the same choices of
 *                 the owner at the same times give the same rounds.
 * Depends on:     @smg/game-sdk (PhasePlan; crypto: the DRBG), ../match/*, ./bots (types)
 * Used by:        ./quickTest
 * Spec:           docs/spec/09-testing-strategy.md §4.2; docs/spec/04-software-architecture.md §4.8 rule 8
 */
import type { PhasePlan } from '@smg/game-sdk';
import { roundRng } from '@smg/game-sdk/crypto';

import type { MatchRow } from '../match/matches.js';
import type { Play } from '../match/play.js';
import type { BotPlan } from './bots.js';

// Every round a series may have (08 §3.4, `mind.rounds` at most 20); later ones are never asked.
const PREPICK_ROUNDS = 20;

// The bots' draws and first moves in round `roundIndex` of the match.
export function botPlan(seed: Uint8Array, roundIndex: number, plan: PhasePlan): BotPlan {
  const drbg = (key: string, part: string) =>
    roundRng(seed).child('quicktest', String(roundIndex), key, part);
  return {
    pick: (key) => {
      const draws = drbg(key, 'pick');
      return (n) => draws.nextInt(n);
    },
    // At least half a second before the entry window closes.
    firstAfterMs: (key) => drbg(key, 'entry').nextInt(Math.max(1, plan.entryEndMs - 500)),
  };
}

// A bot's pre-picks from the seed, or null for a bot that plays in person.
export function botPrefs(play: Play, match: MatchRow, seed: Uint8Array, key: string): unknown {
  const dev = play.rounds.devPrefs(match.gameId);
  if (dev === null) return null;
  const draws = roundRng(seed).child('quicktest', 'prefs', key);
  return dev((n) => draws.nextInt(n), PREPICK_ROUNDS) ?? null;
}
