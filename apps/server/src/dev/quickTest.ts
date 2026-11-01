/**
 * @file   apps/server/src/dev/quickTest.ts
 * @module server/dev
 * @brief  The development Quick Test: one player against bots, started at once or from the lobby.
 *
 * Responsibility: opens an unlisted match hosted by the signed-in player and creates a round
 *                 with the chosen mode, cooldown, visibility, range (negative bounds allowed),
 *                 whether it is shown and whether guesses get closeness comments (O21). Started
 *                 directly, the bots `bot-01` … join at once and the round starts with the
 *                 player and the bots as its roster. From the lobby (O24), the round is only
 *                 set up: the bots join one after another over about 2 s, each picking a random
 *                 season team, and the host starts the round with the normal host control, so
 *                 the real waiting area, team rules and start run. Either way the bots play every
 *                 round of the match (./bots), the next ones too. A seed text makes the round
 *                 repeatable: the round seed is `sha256("smg-quicktest:" + text)`, and without
 *                 a season given the seed picks it, so a seed shows the same secret and season
 *                 every time. Development builds only (the route exists only with SMG_DEV=1).
 * Depends on:     node:crypto, ../match/*, ./bots
 * Used by:        ../http/routes/quickTest
 * Spec:           docs/spec/11-roadmap.md (phase 1 Quick Test); docs/spec/09-testing-strategy.md §1, §5
 */
import { createHash, randomBytes, randomInt } from 'node:crypto';

import type { Season } from '@smg/game-sdk';

import { currentRoundId, openMatch, type MatchRow } from '../match/matches.js';
import type { Play } from '../match/play.js';
import { runBots } from './bots.js';

const SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'];
// From the lobby, the bots arrive one after another within about this time.
const ARRIVAL_MS = 2_000;

export interface QuickTestInput {
  readonly playerId: string;
  readonly gameId: string;
  readonly mode: 'shared' | 'individual';
  readonly bots: number;
  readonly cooldownS: number;
  readonly visibility: 'own' | 'numbers' | 'full';
  readonly rangeLow: number;
  readonly rangeHigh: number;
  readonly rangeVisible: boolean;
  readonly comments: boolean;
  readonly fast: boolean;
  // A halving round; only on a halving day, as for every round.
  readonly halving: boolean;
  // Through the waiting area: the host starts the round (O24).
  readonly lobby: boolean;
  // A team match (O34): without it the bots join without a team.
  readonly teamMatch: boolean;
  // The round's countdown, the intro screen (O36).
  readonly countdownS: number;
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

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms).unref();
  });

// A bot joins as a connected player (bots are always there, 02 §4), optionally with a team.
async function joinBot(play: Play, match: MatchRow, key: string, team: Season | null) {
  play.presence.enter(match.id, key);
  await play.join(match, { key, accountId: null });
  if (team !== null) await play.chooseTeam(match, key, team);
}

// From the lobby: the bots arrive one after another, each with a random team in a team match.
// One that cannot join any more (the match was closed) is simply missing.
function arrive(play: Play, match: MatchRow, bots: readonly string[]): void {
  void (async () => {
    for (const key of bots) {
      await wait(ARRIVAL_MS / bots.length);
      const team = match.teamMatch ? (SEASONS[randomInt(4)] ?? 'spring') : null;
      await joinBot(play, match, key, team);
    }
  })().catch(() => undefined);
}

export interface QuickTests {
  readonly start: (input: QuickTestInput) => Promise<QuickTestStarted>;
}

// One per server: it remembers the Quick Test matches and sets their bots to every new round.
export function quickTests(play: Play, pool: Parameters<typeof openMatch>[0]): QuickTests {
  const botsOf = new Map<string, readonly string[]>();
  const played = new Set<string>();
  // Every round created in a Quick Test match gets its bots; they wait for it to open.
  play.onMatchChanged((matchId) => {
    const bots = botsOf.get(matchId);
    if (bots === undefined) return;
    void (async () => {
      const id = await currentRoundId(pool, matchId);
      if (id === null || played.has(id)) return;
      played.add(id);
      const round = await play.rounds.get(id);
      const bot = round === null ? null : play.rounds.devBot(round.gameId);
      if (round !== null && bot !== null) runBots(round, bots, bot);
    })().catch(() => undefined);
  });

  const start = async (input: QuickTestInput): Promise<QuickTestStarted> => {
    const seedText = input.seedText ?? randomBytes(6).toString('hex');
    const seed = quickTestSeed(seedText);
    const season = input.season ?? SEASONS[(seed[0] ?? 0) % 4] ?? 'spring';
    const match = await openMatch(pool, {
      gameId: input.gameId,
      title: 'Quick Test',
      visibility: 'unlisted',
      maxPlayers: input.bots + 1,
      countsForLeaderboard: false,
      teamMatch: input.teamMatch,
      hostId: input.playerId,
    });
    const bots = Array.from(
      { length: input.bots },
      (_, i) => `bot-${String(i + 1).padStart(2, '0')}`,
    );
    botsOf.set(match.id, bots);
    await play.join(match, { key: input.playerId, accountId: input.playerId });
    if (!input.lobby) for (const key of bots) await joinBot(play, match, key, null);
    const round = await play.createRound(match, input.playerId, {
      choices: choicesOf(input),
      season,
      seed,
      fast: input.fast,
    });
    // From the lobby the answer goes back now; the bots arrive in the waiting area meanwhile.
    if (input.lobby) arrive(play, match, bots);
    else {
      const roster = [input.playerId, ...bots].map((playerId) => ({ playerId, team: null }));
      await play.startRound(match, round, roster);
    }
    return { matchCode: match.code, roundId: round.id, season, seedText };
  };
  return { start };
}

function choicesOf(input: QuickTestInput): Readonly<Record<string, unknown>> {
  return {
    'round.secretMode': input.mode,
    'round.cooldownS': input.cooldownS,
    'round.countdownS': input.countdownS,
    'round.feedbackVisibility': input.visibility,
    'round.rangeLow': input.rangeLow,
    'round.rangeHigh': input.rangeHigh,
    'round.rangeVisible': input.rangeVisible,
    'round.comments': input.comments,
    'round.halving': input.halving,
  };
}
