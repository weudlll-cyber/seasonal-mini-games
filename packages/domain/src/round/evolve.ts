/**
 * @file   packages/domain/src/round/evolve.ts
 * @module domain/round
 * @brief  Fold one round event into the round state; replay a whole log.
 *
 * Responsibility: the only place the round state changes. Live steps and recovery after a
 *                 restart both fold through here, so replaying the log gives the live state
 *                 (invariant P5). Game events go to the module's own evolve. A phased round
 *                 (04 §4.8) keeps per roster player whether they are a match player and when
 *                 they entered; a player who joins the match while it runs gets an entry then,
 *                 and counts no player's actions (T342).
 * Depends on:     @smg/game-sdk (module, round input), ./inactivity (clock restart), ./types
 * Used by:        ./step, ../index, packages/application (recovery)
 * Spec:           docs/spec/04-software-architecture.md §5.1, §5.3; docs/spec/09-testing-strategy.md §3 P5
 */
import type { GameModule, RosterPlayer, RoundInput } from '@smg/game-sdk';

import { readyAfter } from './inactivity.js';
import type { RosterEntry, RoundEvent, RoundState, SpecialName } from './types.js';

// The input a game gets once the roster is frozen (04 §4.1).
export function roundInput<S, Cfg>(
  state: RoundState<S, Cfg>,
  roster: readonly RosterPlayer[],
): RoundInput<Cfg> {
  return {
    roundId: state.roundId,
    roster,
    secretMode: state.config.secretMode,
    season: state.season,
    halving: state.config.halving,
    config: state.gameConfig,
  };
}

// The roster players in roster order, as the game saw them.
export function rosterPlayers<S, Cfg>(state: RoundState<S, Cfg>): RosterPlayer[] {
  return Object.entries(state.roster).map(([playerId, e]) => ({ playerId, team: e.team }));
}

function withEntry<S, Cfg>(
  state: RoundState<S, Cfg>,
  playerId: string,
  change: Partial<RosterEntry>,
): RoundState<S, Cfg> {
  const entry = state.roster[playerId];
  if (entry === undefined) return state;
  return { ...state, roster: { ...state.roster, [playerId]: { ...entry, ...change } } };
}

// The inactivity clock starts at the open (O71).
function freshEntry(team: string | null, opensAt: number): RosterEntry {
  return {
    team,
    guesses: 0,
    cooldownEndsAt: 0,
    readyAt: opensAt,
    timedOut: false,
    solvedSeq: null,
    solvedAt: null,
    place: null,
  };
}

// A phased round's entry: a match player, not in the round until their first action.
function phasedEntry(opensAt: number, member: boolean): RosterEntry {
  return { ...freshEntry(null, opensAt), member, enteredAt: null };
}

// A match player joined, left or was removed while a phased round ran (04 §4.8 rule 3).
function memberChanged<S, Cfg>(
  state: RoundState<S, Cfg>,
  e: { playerId: string; active: boolean },
): RoundState<S, Cfg> {
  if (state.roster[e.playerId] !== undefined) {
    return withEntry(state, e.playerId, { member: e.active });
  }
  const entry = phasedEntry(state.opensAt ?? 0, e.active);
  return { ...state, roster: { ...state.roster, [e.playerId]: entry } };
}

export function evolveRound<S, A, E, Cfg, Sec>(
  module: GameModule<S, A, E, Cfg, Sec>,
  state: RoundState<S, Cfg>,
  event: RoundEvent<E, A, Cfg>,
): RoundState<S, Cfg> {
  switch (event.type) {
    case 'CountdownStarted':
      return countdown(module, state, event);
    case 'GuessAccepted':
      return accepted(state, event);
    case 'Game':
      return state.game === null
        ? state
        : { ...state, game: module.evolve(state.game, event.event) };
    case 'PlayerSolved':
      return solved(state, event);
    case 'SpecialFired':
      return fired(state, event);
    default:
      return lifecycle(state, event);
  }
}

// The events that change only the round's own fields.
function lifecycle<S, A, E, Cfg>(
  state: RoundState<S, Cfg>,
  event: Exclude<
    RoundEvent<E, A, Cfg>,
    { type: 'CountdownStarted' | 'GuessAccepted' | 'Game' | 'PlayerSolved' | 'SpecialFired' }
  >,
): RoundState<S, Cfg> {
  switch (event.type) {
    case 'RoundCreated':
    case 'HeldDelivered':
      return state;
    case 'RoundOpened':
      return { ...state, status: 'open' };
    case 'RoundEnded':
      return { ...state, status: 'ended', endedAt: event.at, endReason: event.reason };
    case 'RoundAborted':
      return { ...state, status: 'aborted', endedAt: event.at, abortReason: event.reason };
    case 'MarginNoted':
      return { ...state, margin: { playerId: event.playerId, ms: event.ms } };
    case 'PlayerTimedOut':
      return withEntry(state, event.playerId, { timedOut: true });
    case 'PlayerEntered':
      return withEntry(state, event.playerId, { enteredAt: event.at });
    case 'MemberChanged':
      return memberChanged(state, event);
    case 'CooldownChanged':
      return { ...state, cooldownMs: event.cooldownMs };
  }
}

function fired<S, Cfg>(
  state: RoundState<S, Cfg>,
  e: { special: SpecialName; index: number; last: boolean },
): RoundState<S, Cfg> {
  if (e.special === 'springHerald') return state;
  const specialIndex = { ...state.specialIndex, [e.special]: e.index };
  const specialsOver = e.last ? [...state.specialsOver, e.special] : state.specialsOver;
  return { ...state, specialIndex, specialsOver };
}

// One more guess for the player, their cooldown from its receive time, their inactivity
// clock stopped until the cooldown is over and the answer has arrived, the last number used.
// A phased round counts no player's actions: a count would show their switches (02e §9, T342).
function accepted<S, Cfg>(
  state: RoundState<S, Cfg>,
  e: { playerId: string; receiveSeq: number; receivedAt: number; cooldownEndsAt: number },
): RoundState<S, Cfg> {
  const counted = state.plan === undefined ? 1 : 0;
  const guesses = (state.roster[e.playerId]?.guesses ?? 0) + counted;
  const { cooldownEndsAt } = e;
  const readyAt = readyAfter(state, e.receivedAt, cooldownEndsAt);
  const next = withEntry(state, e.playerId, { guesses, cooldownEndsAt, readyAt });
  return { ...next, lastSeq: e.receiveSeq };
}

// The roster is frozen and the game's round state created from it.
function countdown<S, A, E, Cfg, Sec>(
  module: GameModule<S, A, E, Cfg, Sec>,
  state: RoundState<S, Cfg>,
  event: Extract<RoundEvent<E, A, Cfg>, { type: 'CountdownStarted' }>,
): RoundState<S, Cfg> {
  const entry = (team: string | null) =>
    state.plan === undefined ? freshEntry(team, event.opensAt) : phasedEntry(event.opensAt, true);
  const roster = Object.fromEntries(event.roster.map((p) => [p.playerId, entry(p.team)]));
  const next = { ...state, status: 'countdown' as const, roster };
  const game = module.createRound(roundInput(next, event.roster));
  return { ...next, opensAt: event.opensAt, endsAt: event.endsAt, game };
}

function solved<S, Cfg>(
  state: RoundState<S, Cfg>,
  e: { playerId: string; receiveSeq: number; at: number; place: number },
): RoundState<S, Cfg> {
  const next = withEntry(state, e.playerId, {
    solvedSeq: e.receiveSeq,
    solvedAt: e.at,
    place: e.place,
  });
  const shared = state.config.secretMode === 'shared';
  return {
    ...next,
    solvedCount: state.solvedCount + 1,
    winner: shared ? e.playerId : state.winner,
    winnerAt: shared ? e.at : state.winnerAt,
  };
}

// The state before the first event: what RoundCreated describes.
export function initialRound<S, A, E, Cfg>(
  created: Extract<RoundEvent<E, A, Cfg>, { type: 'RoundCreated' }>,
): RoundState<S, Cfg> {
  return {
    roundId: created.roundId,
    config: created.config,
    gameConfig: created.gameConfig,
    season: created.season,
    commitment: created.commitment,
    status: 'created',
    opensAt: null,
    endsAt: null,
    endedAt: null,
    roster: {},
    lastSeq: 0,
    cooldownMs: created.config.cooldownMs,
    solvedCount: 0,
    winner: null,
    winnerAt: null,
    endReason: null,
    abortReason: null,
    margin: null,
    specialIndex: { halving: 0, leafFall: 0, heatwave: 0 },
    specialsOver: [],
    game: null,
    ...(created.plan === undefined ? {} : { plan: created.plan }),
  };
}

// Recovery: the state a log describes. The first event must be RoundCreated.
export function replayRound<S, A, E, Cfg, Sec>(
  module: GameModule<S, A, E, Cfg, Sec>,
  events: readonly RoundEvent<E, A, Cfg>[],
): RoundState<S, Cfg> {
  const [first, ...rest] = events;
  if (first?.type !== 'RoundCreated') throw new Error('a round log starts with RoundCreated');
  return rest.reduce((s, e) => evolveRound(module, s, e), initialRound<S, A, E, Cfg>(first));
}
