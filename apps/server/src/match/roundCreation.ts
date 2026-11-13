/**
 * @file   apps/server/src/match/roundCreation.ts
 * @module server/match
 * @brief  A host's new round: its season, its settings and the round itself.
 *
 * Responsibility: the part of ./play's round creation that needs no other round: a halving
 *                 round only on a halving day (NOT_A_HALVING_DAY), the host's season or In
 *                 Season while it is usable (IN_SEASON_UNAVAILABLE), the settings from the
 *                 game's document with the host's choices (ROUND_SETTINGS_INVALID with the
 *                 refused key, O74), a match without teams overruling the team key of a game
 *                 that has teams (O34; a game without teams has no team keys, 04 §4.8 rule 3),
 *                 a fresh seed from the CSPRNG unless the Quick Test gives one, and the match
 *                 opened by its first round.
 * Depends on:     node:crypto, @smg/application (settings), @smg/game-sdk, ../db/pool,
 *                 ../round/*, ../seasons/seasons, ./matches, ./playError, ./teams
 * Used by:        ./play
 * Spec:           docs/spec/02-game-guess-the-number.md §2–§4; docs/spec/06-data-model-api-realtime.md §3.1
 */
import { randomBytes } from 'node:crypto';

import { RoundSettingsError, type SettingsService } from '@smg/application';
import type { Season } from '@smg/game-sdk';
import { SEED_BYTES } from '@smg/game-sdk/crypto';

import type { DbPool } from '../db/pool.js';
import type { LiveRound } from '../round/liveRound.js';
import type { Rounds } from '../round/rounds.js';
import type { Seasons } from '../seasons/seasons.js';
import { setMatchStatus, type MatchRow } from './matches.js';
import { PlayError } from './playError.js';
import { teamChoices } from './teams.js';

export interface RoundRequest {
  readonly choices: Readonly<Record<string, unknown>>;
  readonly season?: Season | undefined;
  // Development Quick Test only: a fixed seed, and the fast test profile (09 §4).
  readonly seed?: Uint8Array | undefined;
  readonly fast?: boolean | undefined;
}

export interface CreationDeps {
  readonly pool: DbPool;
  readonly rounds: Rounds;
  readonly settings: SettingsService;
  readonly seasons: Seasons;
}

// The round's season: the one the host picked, else In Season while it is usable (03 §3).
async function seasonOf(
  seasons: Seasons,
  req: RoundRequest,
): Promise<{ season: Season; source: 'inSeason' | 'manual' }> {
  if (req.season !== undefined) return { season: req.season, source: 'manual' };
  const now = await seasons.inSeason();
  if (now === null) throw new PlayError('IN_SEASON_UNAVAILABLE');
  return { season: now.season, source: 'inSeason' };
}

export async function newRound(
  deps: CreationDeps,
  match: MatchRow,
  hostId: string,
  req: RoundRequest,
): Promise<LiveRound> {
  // A halving round only on a real halving day, checked again here (03 §4).
  if (req.choices['round.halving'] === true && (await deps.seasons.halvingToday()) === null) {
    throw new PlayError('NOT_A_HALVING_DAY');
  }
  const { season, source } = await seasonOf(deps.seasons, req);
  const doc = await deps.settings.view(`game.${match.gameId}`, []);
  try {
    const round = await deps.rounds.create(match.gameId, {
      matchId: match.id,
      overrides: doc.overrides,
      choices: {
        ...req.choices,
        ...(deps.rounds.teams(match.gameId) ? teamChoices(match) : {}),
        'round.seasonSource': source,
      },
      season,
      seasonSource: source,
      createdBy: hostId,
      seed: req.seed ?? new Uint8Array(randomBytes(SEED_BYTES)),
      fast: req.fast === true,
    });
    if (match.status === 'lobby') await setMatchStatus(deps.pool, match.id, 'open');
    return round;
  } catch (error) {
    if (error instanceof RoundSettingsError)
      throw new PlayError('ROUND_SETTINGS_INVALID', error.message, error.field);
    throw error;
  }
}
