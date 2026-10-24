/**
 * @file   apps/server/src/dev/quickTest.ts
 * @module server/dev
 * @brief  The development Quick Test: one player against bots in one real round.
 *
 * Responsibility: opens an unlisted match hosted by the signed-in player, adds bots
 *                 `bot-01` …, creates a round with the chosen mode, cooldown, visibility and
 *                 range 1 to `rangeHigh`, and starts it
 *                 at once with the player and the bots as its roster; the bots then play
 *                 (./bots). A seed text makes the round repeatable: the round seed is
 *                 `sha256("smg-quicktest:" + text)`, and without a season given the seed picks
 *                 it, so a seed shows the same secret and season every time. Development
 *                 builds only (the route exists only with SMG_DEV=1).
 * Depends on:     node:crypto, ../match/*, ./bots
 * Used by:        ../http/routes/quickTest
 * Spec:           docs/spec/11-roadmap.md (phase 1 Quick Test); docs/spec/09-testing-strategy.md §1, §5
 */
import { createHash, randomBytes } from 'node:crypto';

import type { Season } from '@smg/game-sdk';

import { openMatch } from '../match/matches.js';
import type { Play } from '../match/play.js';
import { runBots } from './bots.js';

const SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'];

export interface QuickTestInput {
  readonly playerId: string;
  readonly gameId: string;
  readonly mode: 'shared' | 'individual';
  readonly bots: number;
  readonly cooldownS: number;
  readonly visibility: 'own' | 'numbers' | 'full';
  readonly rangeHigh: number;
  readonly seedText?: string | undefined;
  readonly season?: Season | undefined;
}

export interface QuickTestStarted {
  readonly matchCode: string;
  readonly roundId: string;
  readonly season: Season;
  readonly seedText: string;
}

export function quickTestSeed(seedText: string): Uint8Array {
  return new Uint8Array(createHash('sha256').update(`smg-quicktest:${seedText}`).digest());
}

export async function startQuickTest(
  play: Play,
  pool: Parameters<typeof openMatch>[0],
  input: QuickTestInput,
): Promise<QuickTestStarted> {
  const seedText = input.seedText ?? randomBytes(6).toString('hex');
  const seed = quickTestSeed(seedText);
  const season = input.season ?? SEASONS[(seed[0] ?? 0) % 4] ?? 'spring';
  const match = await openMatch(pool, {
    gameId: input.gameId,
    title: 'Quick Test',
    visibility: 'unlisted',
    maxPlayers: input.bots + 1,
    countsForLeaderboard: false,
    hostId: input.playerId,
  });
  const bots = Array.from(
    { length: input.bots },
    (_, i) => `bot-${String(i + 1).padStart(2, '0')}`,
  );
  await play.join(match, { key: input.playerId, accountId: input.playerId });
  for (const key of bots) await play.join(match, { key, accountId: null });
  const round = await play.createRound(match, input.playerId, {
    choices: {
      'round.secretMode': input.mode,
      'round.cooldownS': input.cooldownS,
      'round.countdownS': 3,
      'round.feedbackVisibility': input.visibility,
      'round.rangeLow': 1,
      'round.rangeHigh': input.rangeHigh,
    },
    season,
    seed,
  });
  const roster = [input.playerId, ...bots].map((playerId) => ({ playerId, team: null }));
  await play.startRound(match, round, roster);
  const bot = play.rounds.devBot(input.gameId);
  if (bot !== null) runBots(round, bots, bot);
  return { matchCode: match.code, roundId: round.id, season, seedText };
}
