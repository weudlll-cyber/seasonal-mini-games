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
 *                 host room (06 §4.2, §4.4).
 * Depends on:     @smg/application (RoundSession), @smg/domain (results, types),
 *                 @smg/game-sdk (GameViews), ./pgRoundStore (types)
 * Used by:        ./rounds, ../realtime/gateway, ../http/routes/rounds
 * Spec:           docs/spec/02-game-guess-the-number.md §11; docs/spec/06-data-model-api-realtime.md §4.2, §4.4
 */
import type { RoundSession } from '@smg/application';
import { playerResults, type RoundEvent, type RoundState } from '@smg/domain';
import type { GameViews } from '@smg/game-sdk';

import type { StoredEvent } from './pgRoundStore.js';

// Frost (03 §2.4) joins with the specials; until then every answer is released.
const ALL_RELEASED = { releasedBefore: Infinity };

function platformPart<S, Cfg>(state: RoundState<S, Cfg>) {
  return {
    roundId: state.roundId,
    status: state.status,
    season: state.season,
    secretMode: state.config.secretMode,
    commitment: state.commitment,
    opensAt: state.opensAt,
    endsAt: state.endsAt,
    endedAt: state.endedAt,
    cooldownMs: state.cooldownMs,
    endReason: state.endReason,
    abortReason: state.abortReason,
    winner: state.winner,
    margin: state.margin,
    roster: Object.entries(state.roster).map(([playerKey, e]) => ({
      playerKey,
      team: e.team,
      guesses: e.guesses,
      cooldownEndsAt: e.cooldownEndsAt,
      place: e.place,
      solved: e.solvedSeq !== null,
    })),
  };
}

export function roundView<S, A, E, Cfg, Sec>(
  session: RoundSession<S, A, E, Cfg, Sec>,
  views: GameViews<S, Sec>,
  viewerKey: string | null,
  seq: number,
) {
  const state = session.state;
  const base = { ...platformPart(state), seq };
  if (state.status === 'ended') {
    const results = playerResults(state);
    return {
      ...base,
      role: 'result' as const,
      results,
      seed: session.revealedSeed(),
      game: session.result(),
    };
  }
  const onRoster = viewerKey !== null && state.roster[viewerKey] !== undefined;
  if (state.game === null) return { ...base, role: 'spectator' as const, game: null };
  if (onRoster) {
    return {
      ...base,
      role: 'player' as const,
      game: views.player(state.game, viewerKey, ALL_RELEASED),
    };
  }
  return { ...base, role: 'spectator' as const, game: views.spectator(state.game, ALL_RELEASED) };
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

export function framesOf(events: readonly StoredEvent[], result: () => unknown): Frames {
  const frames: Frames = { room: [], players: new Map(), host: [] };
  for (const stored of events) {
    const e = stored.event as RoundEvent<unknown, unknown, unknown>;
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
