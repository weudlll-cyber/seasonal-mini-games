/**
 * @file   apps/server/src/match/play.ts
 * @module server/match
 * @brief  The match and round use cases the routes and intents share.
 *
 * Responsibility: a host creates a round (one at a time, ROUND_RUNNING; its season and
 *                 settings in ./roundCreation) and starts it with
 *                 the players connected right now, the host among them (O16, 02 §4), every one
 *                 with their match team (placed in the smallest team when none, O26); host end
 *                 and abort; team choice once per match (TEAM_LOCKED after the player's first
 *                 round, TEAMS_LOCKED while a round counts down or runs, TEAMS_OFF in a match
 *                 without teams, whose rounds run without them, O34); joining and leaving
 *                 (leaving ends a round whose roster all left, "no players left"); staff kick a
 *                 player, who leaves the same way and whose guesses the running round refuses
 *                 from then on; closing or aborting the match (O27, O28); every change of
 *                 players, teams or status is told to listeners, and a match opened or closed to
 *                 the lifecycle listeners (webhooks, 07 §3.2); in shared mode the roster keeps
 *                 only players the anti-multi rules admit (./rosterRules). It keeps each match's
 *                 player numbers for the public answers (./publicIds). A phased round (04 §4.8
 *                 rule 3) starts with every active match player admitted (at least the minimum
 *                 connected), is told of players who join (admitted) or leave while it runs,
 *                 and plays on when its players leave; a game without teams gets no team keys;
 *                 a phased round's settings are kept for a series' next round (./series); a
 *                 player's pre-picks (./prefs) go when they leave or are removed.
 * Depends on:     @smg/application (settings), ../round/*, ../seasons/seasons, ./roundCreation,
 *                 ./matches, ./playError, ./presence, ./publicIds, ./rosterRules, ./teams,
 *                 ../db/pool
 * Used by:        ../http/routes/*, ../realtime/intents, ../dev/quickTest
 * Spec:           docs/spec/02-game-guess-the-number.md §2–§4, §8.3; docs/spec/04-software-architecture.md §4.8;
 *                 docs/spec/06-data-model-api-realtime.md §3.1
 */
import type { SettingsService } from '@smg/application';
import type { Reply } from '@smg/domain';
import type { RosterPlayer } from '@smg/game-sdk';

import { inTransaction, type DbPool } from '../db/pool.js';
import { withdrawMatch } from '../league/awards.js';
import { leagueRules } from '../league/rules.js';
import type { LiveRound } from '../round/liveRound.js';
import type { Rounds } from '../round/rounds.js';
import {
  activePlayers,
  currentRoundId,
  joinMatch,
  kickPlayer,
  leaveMatch,
  openMatch,
  setMatchStatus,
  type JoinResult,
  type MatchEnd,
  type MatchRow,
  type NewMatch,
  type PlayerRow,
  type Team,
} from './matches.js';
import { PlayError } from './playError.js';
import { deletePrefs, PlayerPrefs } from './prefs.js';
import { newRound, type RoundRequest } from './roundCreation.js';
import { rememberNext } from './series.js';
import type { Admission } from './rosterRules.js';
import type { Seasons } from '../seasons/seasons.js';
import type { Presence } from './presence.js';
import { PlayerNumbers } from './publicIds.js';
import { fixTeams, setTeam, teamLocked, teamRoster } from './teams.js';

// The host's End match (O27).
const HOST_CLOSE: MatchEnd = { status: 'closed', reason: null, by: 'host' };

const RUNNING = new Set(['created', 'countdown', 'open']);

type MatchLifecycle = (event: 'opened' | 'closed', match: MatchRow) => void;

export class Play {
  private readonly matchListeners: ((matchId: string) => void)[] = [];
  private readonly lifecycleListeners: MatchLifecycle[] = [];

  readonly presence: Presence;
  // Per-match player numbers for every public answer and frame (./publicIds, T104).
  readonly numbers: PlayerNumbers;
  // A phased game's per-player match data, the pre-picks (./prefs, 04 §4.8 rule 8).
  readonly prefs: PlayerPrefs;
  private readonly seasons: Seasons;
  // The anti-multi rules of this install (./rosterRules).
  private readonly admit: Admission;

  constructor(
    private readonly pool: DbPool,
    readonly rounds: Rounds,
    private readonly settings: SettingsService,
    live: { readonly presence: Presence; readonly seasons: Seasons; readonly admit: Admission },
  ) {
    this.presence = live.presence;
    this.seasons = live.seasons;
    this.admit = live.admit;
    this.numbers = new PlayerNumbers(pool);
    this.prefs = new PlayerPrefs(pool, rounds);
  }

  // The numbers of the matches whose rounds a starting server recovered (./publicIds).
  async loadRunningNumbers(): Promise<void> {
    const r = await this.pool.query<{ match_id: string }>(
      `SELECT DISTINCT match_id::text FROM smg.rounds WHERE status IN ('created', 'countdown', 'open')`,
    );
    for (const row of r.rows) await this.numbers.load(row.match_id);
  }

  // Players, their presence, teams or status of a match changed: the gateway tells its room.
  onMatchChanged(listener: (matchId: string) => void): void {
    this.matchListeners.push(listener);
  }

  changed(matchId: string): void {
    for (const l of this.matchListeners) l(matchId);
  }

  // A match was opened, or closed or aborted (the row carries its new status).
  onLifecycle(listener: MatchLifecycle): void {
    this.lifecycleListeners.push(listener);
  }

  async open(m: NewMatch): Promise<MatchRow> {
    const match = await openMatch(this.pool, m);
    for (const l of this.lifecycleListeners) l('opened', match);
    return match;
  }

  async join(
    match: MatchRow,
    player: { key: string; accountId: string | null },
  ): Promise<JoinResult> {
    const result = await joinMatch(this.pool, match, player);
    if (result === 'joined') {
      await this.numbers.load(match.id);
      await this.tellMember(match, player.key, true);
      this.changed(match.id);
    }
    return result;
  }

  // A phased round (04 §4.8 rule 3): a player who joins while it runs may enter once the
  // anti-multi rules admit them; one who leaves or is removed may not act any more.
  private async tellMember(match: MatchRow, key: string, active: boolean): Promise<void> {
    const round = await this.runningRound(match);
    if (round === null || !round.phased || round.status() === 'created') return;
    const admitted =
      !active || (await this.admit(round.id, [{ playerId: key, team: null }])).length > 0;
    await round.member(key, admitted);
  }

  async runningRound(match: MatchRow): Promise<LiveRound | null> {
    const id = await currentRoundId(this.pool, match.id);
    const round = id === null ? null : await this.rounds.get(id);
    return round !== null && RUNNING.has(round.status()) ? round : null;
  }

  // The round's season: the one the host picked, else In Season while it is usable (03 §3).
  async createRound(match: MatchRow, hostId: string, req: RoundRequest): Promise<LiveRound> {
    if (match.status === 'closed' || match.status === 'aborted') {
      throw new PlayError('MATCH_CLOSED');
    }
    if ((await this.runningRound(match)) !== null) throw new PlayError('ROUND_RUNNING');
    const { pool, rounds, settings, seasons } = this;
    const round = await newRound({ pool, rounds, settings, seasons }, match, hostId, req);
    // A series keeps these settings for its next round until the host changes them (rule 7).
    if (round.phased) {
      await rememberNext(pool, match.id, { choices: req.choices, season: req.season ?? null });
    }
    // Watchers learn of the new round and load it.
    this.changed(match.id);
    return round;
  }

  // The match's active players connected now, in join order.
  private present(match: MatchRow, players: readonly PlayerRow[]): RosterPlayer[] {
    const connected = this.presence.connected(match.id);
    return players
      .filter((p) => connected.has(p.playerKey))
      .map((p) => ({ playerId: p.playerKey, team: p.team }));
  }

  // The roster: the players present; the host plays along (O16, 02 §4). Every roster player
  // has their match team; one without is placed now and keeps it (O26).
  // `auto`: a series starts its next round itself, without the minimum (04 §4.8 rule 7).
  async startRound(
    match: MatchRow,
    round: LiveRound,
    roster?: readonly RosterPlayer[],
    auto = false,
  ): Promise<Reply> {
    const players = await activePlayers(this.pool, match.id);
    // Every roster player has a number before the round's first frame goes out.
    await this.numbers.load(match.id);
    const present = this.present(match, players);
    // A phased round is open to every active match player; the minimum counts those here.
    const everyone = players.map((p) => ({ playerId: p.playerKey, team: p.team }));
    // A given roster (the Quick Test) is taken as it is; others pass the anti-multi rules (05 §6).
    const chosen = roster ?? (await this.admit(round.id, round.phased ? everyone : present));
    const teams = teamRoster(match, chosen, players, round.id);
    const values = await this.settings.values('matchmaking');
    const minPlayers = roster === undefined ? (values['match.minPlayersPerRound'] as number) : 1;
    if (round.phased && !auto && present.length < minPlayers)
      return { ok: false, code: 'NOT_ENOUGH_PLAYERS' };
    const reply = await round.run({
      type: 'startCountdown',
      roster: teams.roster,
      minPlayers: round.phased ? 1 : minPlayers,
    });
    if (reply.ok && teams.placed.length > 0) {
      await fixTeams(this.pool, match.id, teams.placed);
      this.changed(match.id);
    }
    return reply;
  }

  // Once per match: refused after the player's first round (O26), and while a round runs.
  async chooseTeam(match: MatchRow, playerKey: string, team: Team): Promise<boolean> {
    if (!match.teamMatch) throw new PlayError('TEAMS_OFF');
    if (await teamLocked(this.pool, match.id, playerKey)) throw new PlayError('TEAM_LOCKED');
    const running = await this.runningRound(match);
    if (running !== null && running.status() !== 'created') throw new PlayError('TEAMS_LOCKED');
    const ok = await setTeam(this.pool, match.id, playerKey, team);
    if (ok) this.changed(match.id);
    return ok;
  }

  // Leaving ends a running round once no roster player is left in the match (02 §8.3).
  async leave(match: MatchRow, playerKey: string): Promise<void> {
    await leaveMatch(this.pool, match.id, playerKey);
    // Pre-picks go with the player (04 §4.8 rule 8).
    await deletePrefs(this.pool, match.id, playerKey);
    await this.departed(match, playerKey, false);
  }

  // Staff (06 §3.2): false when the player is not active in the match.
  async kick(match: MatchRow, playerKey: string): Promise<boolean> {
    if (!(await kickPlayer(this.pool, match.id, playerKey))) return false;
    await deletePrefs(this.pool, match.id, playerKey);
    await this.departed(match, playerKey, true);
    return true;
  }

  private async departed(match: MatchRow, playerKey: string, kicked: boolean): Promise<void> {
    this.changed(match.id);
    const round = await this.runningRound(match);
    if (round === null) return;
    if (kicked) round.exclude(playerKey);
    if (round.status() === 'created') return;
    // A phased round plays on: the choices of those who left stand (04 §4.8 rule 3).
    if (round.phased) {
      await round.member(playerKey, false);
      return;
    }
    const active = new Set((await activePlayers(this.pool, match.id)).map((p) => p.playerKey));
    if (!round.rosterKeys().some((k) => active.has(k)))
      await round.run({ type: 'end', reason: 'noPlayers' });
  }

  // Ends the match; a round still set up or running is aborted. A close keeps the results
  // and points of the ended rounds; only an abort is a failed match (O27, O28).
  async close(match: MatchRow, end: MatchEnd = HOST_CLOSE): Promise<void> {
    const round = await this.runningRound(match);
    if (round !== null) {
      await round.run({
        type: 'abort',
        // A host's close says "match closed"; the idle close and an abort give their reason.
        reason: end.reason ?? 'match closed',
        by: end.by,
      });
    }
    await setMatchStatus(this.pool, match.id, end.status, end);
    // The round's last frames went out with the abort above; the numbers can go.
    this.numbers.forget(match.id);
    for (const l of this.lifecycleListeners) l('closed', { ...match, status: end.status });
    // A close keeps the league points of its ended rounds (O27, O28); an aborted match takes
    // them back unless the setting keeps them (T88).
    if (end.status === 'aborted' && !(await leagueRules(this.settings)).abortedMatchesCount) {
      await inTransaction(this.pool, (c) => withdrawMatch(c, match.id));
    }
    this.changed(match.id);
  }
}
