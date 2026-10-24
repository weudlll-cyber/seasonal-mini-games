/**
 * @file   apps/server/src/match/play.ts
 * @module server/match
 * @brief  The match and round use cases the routes and intents share.
 *
 * Responsibility: a host creates a round (one at a time, ROUND_RUNNING; settings from the
 *                 game's document and the host's choices, ROUND_SETTINGS_INVALID; the host's
 *                 season or In Season while it is usable, IN_SEASON_UNAVAILABLE otherwise; a
 *                 halving round only on a halving day, NOT_A_HALVING_DAY) and starts it with
 *                 the players connected right now, the host excluded (02 §4); host end and
 *                 abort; team choice, locked while a round counts down or runs (TEAMS_LOCKED);
 *                 joining and leaving (leaving ends a round whose roster all left, "no players
 *                 left"); every change of players, teams or status is told to listeners.
 * Depends on:     node:crypto, @smg/application (settings), ../round/*, ../seasons/seasons,
 *                 ./matches, ./presence, ../db/pool
 * Used by:        ../http/routes/*, ../realtime/intents, ../dev/quickTest
 * Spec:           docs/spec/02-game-guess-the-number.md §2–§4, §8.3; docs/spec/06-data-model-api-realtime.md §3.1
 */
import { randomBytes } from 'node:crypto';

import { RoundSettingsError, type SettingsService } from '@smg/application';
import type { Reply } from '@smg/domain';
import type { RosterPlayer, Season } from '@smg/game-sdk';
import { SEED_BYTES } from '@smg/game-sdk/crypto';

import type { DbPool } from '../db/pool.js';
import type { LiveRound } from '../round/liveRound.js';
import type { Rounds } from '../round/rounds.js';
import {
  activePlayers,
  currentRoundId,
  joinMatch,
  leaveMatch,
  setMatchStatus,
  setTeam,
  type JoinResult,
  type MatchRow,
  type Team,
} from './matches.js';
import type { Seasons } from '../seasons/seasons.js';
import type { Presence } from './presence.js';

export type PlayCode =
  | 'ROUND_RUNNING'
  | 'ROUND_SETTINGS_INVALID'
  | 'IN_SEASON_UNAVAILABLE'
  | 'NOT_A_HALVING_DAY'
  | 'TEAMS_LOCKED'
  | 'MATCH_CLOSED';

export class PlayError extends Error {
  constructor(
    readonly code: PlayCode,
    readonly detail: string = code,
  ) {
    super(detail);
  }
}

export interface RoundRequest {
  readonly choices: Readonly<Record<string, unknown>>;
  readonly season?: Season | undefined;
  // Development Quick Test only: a fixed seed, and the fast test profile (09 §4).
  readonly seed?: Uint8Array | undefined;
  readonly fast?: boolean | undefined;
}

const RUNNING = new Set(['created', 'countdown', 'open']);

export class Play {
  private readonly matchListeners: ((matchId: string) => void)[] = [];

  readonly presence: Presence;
  private readonly seasons: Seasons;

  constructor(
    private readonly pool: DbPool,
    readonly rounds: Rounds,
    private readonly settings: SettingsService,
    live: { readonly presence: Presence; readonly seasons: Seasons },
  ) {
    this.presence = live.presence;
    this.seasons = live.seasons;
  }

  // Players, teams or status of a match changed: the gateway tells its room.
  onMatchChanged(listener: (matchId: string) => void): void {
    this.matchListeners.push(listener);
  }

  private changed(matchId: string): void {
    for (const l of this.matchListeners) l(matchId);
  }

  async join(
    match: MatchRow,
    player: { key: string; accountId: string | null },
  ): Promise<JoinResult> {
    const result = await joinMatch(this.pool, match, player);
    if (result === 'joined') this.changed(match.id);
    return result;
  }

  async runningRound(match: MatchRow): Promise<LiveRound | null> {
    const id = await currentRoundId(this.pool, match.id);
    const round = id === null ? null : await this.rounds.get(id);
    return round !== null && RUNNING.has(round.status()) ? round : null;
  }

  // The round's season: the one the host picked, else In Season while it is usable (03 §3).
  private async seasonOf(
    req: RoundRequest,
  ): Promise<{ season: Season; source: 'inSeason' | 'manual' }> {
    if (req.season !== undefined) return { season: req.season, source: 'manual' };
    const now = await this.seasons.inSeason();
    if (now === null) throw new PlayError('IN_SEASON_UNAVAILABLE');
    return { season: now.season, source: 'inSeason' };
  }

  async createRound(match: MatchRow, hostId: string, req: RoundRequest): Promise<LiveRound> {
    if (match.status === 'closed' || match.status === 'aborted') {
      throw new PlayError('MATCH_CLOSED');
    }
    if ((await this.runningRound(match)) !== null) throw new PlayError('ROUND_RUNNING');
    // A halving round only on a real halving day, checked again here (03 §4).
    if (req.choices['round.halving'] === true && (await this.seasons.halvingToday()) === null) {
      throw new PlayError('NOT_A_HALVING_DAY');
    }
    const { season, source } = await this.seasonOf(req);
    const doc = await this.settings.view(`game.${match.gameId}`, []);
    try {
      const round = await this.rounds.create(match.gameId, {
        matchId: match.id,
        overrides: doc.overrides,
        choices: { ...req.choices, 'round.seasonSource': source },
        season,
        seasonSource: source,
        createdBy: hostId,
        seed: req.seed ?? new Uint8Array(randomBytes(SEED_BYTES)),
        fast: req.fast === true,
      });
      if (match.status === 'lobby') await setMatchStatus(this.pool, match.id, 'open');
      return round;
    } catch (error) {
      if (error instanceof RoundSettingsError)
        throw new PlayError('ROUND_SETTINGS_INVALID', error.message);
      throw error;
    }
  }

  // The roster: active players connected now, in join order, the host excluded (02 §4).
  async startRound(
    match: MatchRow,
    round: LiveRound,
    roster?: readonly RosterPlayer[],
  ): Promise<Reply> {
    const connected = this.presence.connected(match.id);
    const players =
      roster ??
      (await activePlayers(this.pool, match.id))
        .filter((p) => p.playerKey !== match.hostId && connected.has(p.playerKey))
        .map((p) => ({ playerId: p.playerKey, team: p.team }));
    const values = await this.settings.values('matchmaking');
    const minPlayers = values['match.minPlayersPerRound'] as number;
    return round.run({
      type: 'startCountdown',
      roster: players,
      minPlayers: roster === undefined ? minPlayers : 1,
    });
  }

  async chooseTeam(match: MatchRow, playerKey: string, team: Team): Promise<boolean> {
    const running = await this.runningRound(match);
    if (running !== null && running.status() !== 'created') throw new PlayError('TEAMS_LOCKED');
    const ok = await setTeam(this.pool, match.id, playerKey, team);
    if (ok) this.changed(match.id);
    return ok;
  }

  // Leaving ends a running round once no roster player is left in the match (02 §8.3).
  async leave(match: MatchRow, playerKey: string): Promise<void> {
    await leaveMatch(this.pool, match.id, playerKey);
    this.changed(match.id);
    const round = await this.runningRound(match);
    if (round === null || round.status() === 'created') return;
    const active = new Set((await activePlayers(this.pool, match.id)).map((p) => p.playerKey));
    if (!round.rosterKeys().some((k) => active.has(k)))
      await round.run({ type: 'end', reason: 'noPlayers' });
  }

  async close(match: MatchRow, abort?: { reason: string; by: 'host' | 'system' }): Promise<void> {
    const round = await this.runningRound(match);
    if (round !== null) {
      await round.run({
        type: 'abort',
        reason: abort?.reason ?? 'match closed',
        by: abort?.by ?? 'host',
      });
    }
    await setMatchStatus(this.pool, match.id, abort === undefined ? 'closed' : 'aborted', abort);
    this.changed(match.id);
  }
}
