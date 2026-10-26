/**
 * @file   apps/server/src/round/views.ts
 * @module server/round
 * @brief  What a viewer gets of a round, over HTTP and as realtime frames.
 *
 * Responsibility: the round view: the platform part (status, times, cooldown, roster with
 *                 guess counts, cooldown ends and places, winner, margin, results, the seed
 *                 once revealed) and the game's view for this viewer: the player view for a
 *                 roster player, the spectator view for everyone else, the result view (the
 *                 only one with secrets) after the end (02 §11). Frames: every committed event
 *                 in its public form to the match room (a value only through the game's own
 *                 room line), a player's own events to that player's room, host events to the
 *                 host room (06 §4.2, §4.4). Under Frost a view shows nothing that was not
 *                 announced yet, and frames hold such events back (09 §6 "Frost early read").
 * Depends on:     @smg/application (RoundSession), @smg/domain (results, types),
 *                 @smg/game-sdk (GameViews), ./pgRoundStore (types)
 * Used by:        ./rounds, ../realtime/gateway, ../http/routes/rounds
 * Spec:           docs/spec/02-game-guess-the-number.md §11; docs/spec/06-data-model-api-realtime.md §4.2, §4.4
 */
import type { RoundSession } from '@smg/application';
import {
  frostDelay,
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

function platformPart<S, Cfg>(state: RoundState<S, Cfg>, cut: number) {
  const ended = state.status === 'ended' && !announcedEnd(state, cut) ? 'open' : state.status;
  const winner = shown(state.winnerAt, cut) ? state.winner : null;
  return {
    roundId: state.roundId,
    status: ended,
    season: state.season,
    secretMode: state.config.secretMode,
    specialOn: state.config.specialOn,
    halving: state.config.halving,
    frostDelayMs: frostDelay(state),
    commitment: state.commitment,
    opensAt: state.opensAt,
    endsAt: state.endsAt,
    endedAt: ended === 'ended' ? state.endedAt : null,
    cooldownMs: state.cooldownMs,
    endReason: ended === 'ended' ? state.endReason : null,
    abortReason: state.abortReason,
    winner,
    margin: winner === null ? null : state.margin,
    roster: Object.entries(state.roster).map(([playerKey, e]) => ({
      playerKey,
      team: e.team,
      guesses: e.guesses,
      cooldownEndsAt: e.cooldownEndsAt,
      place: shown(e.solvedAt, cut) ? e.place : null,
      solved: shown(e.solvedAt, cut),
    })),
  };
}

function announcedEnd<S, Cfg>(state: RoundState<S, Cfg>, cut: number): boolean {
  const byWin = state.endReason === 'solved' || state.endReason === 'allSolved';
  return !byWin || shown(state.endedAt, cut);
}

export function roundView<S, A, E, Cfg, Sec>(
  session: RoundSession<S, A, E, Cfg, Sec>,
  views: GameViews<S, Sec>,
  viewer: { readonly key: string | null; readonly now: number },
  seq: number,
) {
  const state = session.state;
  const delay = frostDelay(state);
  const cut = delay === null ? Infinity : viewer.now - delay;
  const base = { ...platformPart(state, cut), seq };
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
  if (key !== null && state.roster[key] !== undefined) {
    return { ...base, role: 'player' as const, game: views.player(state.game, key, released) };
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
