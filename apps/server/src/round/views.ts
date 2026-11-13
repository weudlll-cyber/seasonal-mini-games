/**
 * @file   apps/server/src/round/views.ts
 * @module server/round
 * @brief  What a viewer gets of a round, over HTTP and as realtime frames.
 *
 * Responsibility: the round view: the platform part (status, times, cooldown, the inactivity
 *                 limit and warning as settings (O75), roster with guess counts, cooldown
 *                 ends, places and "timed out" (O71), winner, margin, results, the seed once
 *                 revealed) and the game's view for this viewer: the player view for a
 *                 roster player, the spectator view for everyone else, the result view (the
 *                 only one with secrets) after the end (02 §11); a roster player's view also
 *                 carries their own inactivity deadlines, no other view any (O73). Frames:
 *                 every committed event
 *                 in its public form to the match room (a value only through the game's own
 *                 room line), a player's own events to that player's room, host events to the
 *                 host room (06 §4.2, §4.4). Under Frost a view shows nothing that was not
 *                 announced yet, and frames hold such events back (09 §6 "Frost early read").
 *                 A phased round (04 §4.8 rule 5) is shown as it was at its delayed room's cut:
 *                 the game's views get that cut, the round lists a player only once their entry
 *                 is older, without action counts, and `phasedPublic` gives its events' public
 *                 forms for the delayed room (./delayedRoom); its round state carries the plan.
 * Depends on:     @smg/application (RoundSession), @smg/domain (results, inactivity, types),
 *                 @smg/game-sdk (GameViews), ./pgRoundStore (types)
 * Used by:        ./rounds, ../realtime/gateway, ../http/routes/rounds
 * Spec:           docs/spec/02-game-guess-the-number.md §11; docs/spec/04-software-architecture.md §4.8;
 *                 docs/spec/06-data-model-api-realtime.md §4.2, §4.4
 */
import type { RoundSession } from '@smg/application';
import {
  frostDelay,
  inactivityDeadline,
  playerResults,
  teamResults,
  type RoundEvent,
  type RoundState,
} from '@smg/domain';
import type { GameViews } from '@smg/game-sdk';

import type { StoredEvent } from './pgRoundStore.js';

// Under Frost, what happened at or after `cut` is not announced yet (03 §2.4): answers,
// solves, the win and an end that a win caused.
const shown = (at: number | null, cut: number) => at !== null && at < cut;

// The round's players: a phased round lists only those whose entry is older than the cut,
// and no counts of their actions, which would show switches as they happen (04 §4.8 rule 5).
function rosterPart<S, Cfg>(state: RoundState<S, Cfg>, cut: number) {
  const entries = Object.entries(state.roster);
  if (state.plan !== undefined) {
    return entries
      .filter(([, e]) => e.enteredAt != null && e.enteredAt < cut)
      .map(([playerKey]) => ({
        playerKey,
        team: null,
        guesses: 0,
        cooldownEndsAt: 0,
        place: null,
        solved: false,
        timedOut: false,
      }));
  }
  return entries.map(([playerKey, e]) => ({
    playerKey,
    team: e.team,
    guesses: e.guesses,
    cooldownEndsAt: e.cooldownEndsAt,
    place: shown(e.solvedAt, cut) ? e.place : null,
    solved: shown(e.solvedAt, cut),
    // The inactivity limit (O71): out or not; the deadlines are the viewer's own (O73).
    timedOut: e.timedOut,
  }));
}

function platformPart<S, Cfg>(state: RoundState<S, Cfg>, cut: number) {
  const ended = state.status === 'ended' && !announcedEnd(state, cut) ? 'open' : state.status;
  const winner = shown(state.winnerAt, cut) ? state.winner : null;
  return {
    roundId: state.roundId,
    status: ended,
    season: state.season,
    secretMode: state.config.secretMode,
    // Teams play in shared rounds only (03 §5).
    teamsOn: state.config.teamsOn && state.config.secretMode === 'shared',
    specialOn: state.config.specialOn,
    halving: state.config.halving,
    frostDelayMs: frostDelay(state),
    commitment: state.commitment,
    opensAt: state.opensAt,
    endsAt: state.endsAt,
    endedAt: ended === 'ended' ? state.endedAt : null,
    // A phased round has no cooldown (04 §4.8 rule 4).
    cooldownMs: state.plan === undefined ? state.cooldownMs : 0,
    // The round's own limit and warning for the next round's form (O75); a round frozen
    // before O71 has no key and the limit off.
    inactivityLimitMs: state.config.inactivityLimitMs > 0 ? state.config.inactivityLimitMs : 0,
    inactivityWarnMs: state.config.inactivityWarnMs > 0 ? state.config.inactivityWarnMs : 0,
    endReason: ended === 'ended' ? state.endReason : null,
    abortReason: state.abortReason,
    winner,
    margin: winner === null ? null : state.margin,
    roster: rosterPart(state, cut),
    // A phased round's plan, so the client shows its phases (rule 1); the guess games have none.
    ...(state.plan === undefined ? {} : { plan: state.plan }),
  };
}

function announcedEnd<S, Cfg>(state: RoundState<S, Cfg>, cut: number): boolean {
  const byWin = state.endReason === 'solved' || state.endReason === 'allSolved';
  return !byWin || shown(state.endedAt, cut);
}

export function roundView<S, A, E, Cfg, Sec>(
  session: RoundSession<S, A, E, Cfg, Sec>,
  views: GameViews<S, Sec>,
  // `cut`: a phased round's delayed room cut (./delayedRoom); else Frost's, from `now`.
  viewer: { readonly key: string | null; readonly now: number; readonly cut?: number },
  seq: number,
) {
  const state = session.state;
  const delay = frostDelay(state);
  const cut = viewer.cut ?? (delay === null ? Infinity : viewer.now - delay);
  const base = { ...platformPart(state, cut), seq, ownInactivity: null };
  if (base.status === 'ended') {
    return {
      ...base,
      role: 'result' as const,
      results: playerResults(state),
      teams: teamResults(state),
      seed: session.revealedSeed(),
      game: session.result(),
    };
  }
  const released = { releasedBefore: cut };
  const key = viewer.key;
  if (state.game === null) return { ...base, role: 'spectator' as const, game: null };
  const entry = key === null ? undefined : state.roster[key];
  if (key !== null && entry !== undefined) {
    // Only the player's own deadlines, never another player's (O73).
    const ownInactivity = inactivityDeadline(state, entry);
    const game = views.player(state.game, key, released);
    return { ...base, role: 'player' as const, ownInactivity, game };
  }
  return { ...base, role: 'spectator' as const, game: views.spectator(state.game, released) };
}

export interface FrameEvent {
  readonly s: number;
  readonly at: number;
  readonly event: unknown;
}

export interface Frames {
  // Every seq, so the room can find gaps; events not for the room are null.
  readonly room: FrameEvent[];
  readonly players: Map<string, FrameEvent[]>;
  readonly host: FrameEvent[];
}

// The public form of a platform event: a guess shows who and when, never the value.
function roomForm(e: RoundEvent<unknown, unknown, unknown>, result: () => unknown): unknown {
  switch (e.type) {
    case 'GuessAccepted':
      return {
        type: e.type,
        playerKey: e.playerId,
        receiveSeq: e.receiveSeq,
        cooldownEndsAt: e.cooldownEndsAt,
      };
    case 'Game':
      return e.audience === 'room' ? { type: 'Game', event: e.event } : null;
    case 'RoundEnded':
      return { ...e, result: result() };
    default:
      return e;
  }
}

// A phased round's event for the delayed room (./delayedRoom): its public room or host form,
// whether it waits for the delay, or null when only its own player or nobody sees it. An
// accepted action and a change of match players never reach the room: what the room may see
// of an action is the game's own room event (04 §4.8 rule 5).
export function phasedPublic(
  stored: StoredEvent,
  result: () => unknown,
): { readonly room: unknown; readonly host: unknown; readonly delayed: boolean } | null {
  const e = stored.event as RoundEvent<unknown, unknown, unknown>;
  switch (e.type) {
    case 'GuessAccepted':
    case 'MemberChanged':
    case 'HeldDelivered':
      return null;
    case 'Game':
      if (e.audience === 'room')
        return { room: { type: 'Game', event: e.event }, host: null, delayed: true };
      if (e.audience === 'host')
        return { room: null, host: { type: 'Game', event: e.event }, delayed: true };
      return null;
    case 'PlayerEntered':
      return { room: { type: e.type, playerKey: e.playerId, at: e.at }, host: null, delayed: true };
    default:
      return { room: roomForm(e, result), host: null, delayed: false };
  }
}

export function framesOf(
  events: readonly StoredEvent[],
  held: ReadonlySet<number>,
  result: () => unknown,
): Frames {
  const frames: Frames = { room: [], players: new Map(), host: [] };
  for (const stored of events) {
    const e = stored.event as RoundEvent<unknown, unknown, unknown>;
    // Held by Frost: the room learns the seq now and the event at its delivery.
    if (held.has(stored.seq)) {
      frames.room.push({ s: stored.seq, at: stored.at, event: null });
      continue;
    }
    frames.room.push({ s: stored.seq, at: stored.at, event: roomForm(e, result) });
    if (e.type !== 'Game' || e.audience === 'room') continue;
    const item = { s: stored.seq, at: stored.at, event: { type: 'Game', event: e.event } };
    if (e.audience === 'host') {
      frames.host.push(item);
      continue;
    }
    const key = e.audience.slice('player:'.length);
    frames.players.set(key, [...(frames.players.get(key) ?? []), item]);
  }
  return frames;
}
