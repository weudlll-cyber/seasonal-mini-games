/**
 * @file   games/guess-the-number/src/rules.ts
 * @module games/guess-the-number
 * @brief  The game's acceptance checks and its decision for an accepted guess.
 *
 * Responsibility: checks 4–6 of 02 §5.1 (inside the player's current range, not removed,
 *                 not guessed before when repeats are refused); for an accepted guess the
 *                 answer to the guesser (held by Frost), the room's line at the round's
 *                 visibility (02 §6.2), and `Solved` when the number was found.
 * Depends on:     @smg/game-sdk (contract, inRange), ./feedback, ./secrets, ./state
 * Used by:        ./module
 * Spec:           docs/spec/02-game-guess-the-number.md §5.1, §6, §8
 */
import {
  inRange,
  type Decision,
  type Emitted,
  type GameCtx,
  type PlayerAction,
} from '@smg/game-sdk';

import { band, feedbackFor, type Answer } from './feedback.js';
import { secretOf, type Secrets } from './secrets.js';
import type { GtnEvent, GtnState } from './state.js';

export interface GuessAction {
  readonly value: number;
}

export type GtnCode = 'OUT_OF_RANGE' | 'NUMBER_REMOVED' | 'ALREADY_GUESSED';

export function validate(state: GtnState, playerId: string, action: GuessAction): GtnCode | null {
  const player = state.players[playerId];
  if (player === undefined || !inRange(player.range, action.value)) return 'OUT_OF_RANGE';
  if (state.removed.includes(action.value)) return 'NUMBER_REMOVED';
  if (state.repeatRejected && player.guesses.some((g) => g.value === action.value)) {
    return 'ALREADY_GUESSED';
  }
  return null;
}

// The room's line: individual mode and `own` say only that a guess happened (02 §6.2).
function fed(
  state: GtnState,
  playerId: string,
  guesses: number,
  answer: Answer,
): Emitted<GtnEvent> {
  const base = { type: 'GuessFed', playerId, guesses } as const;
  if (state.mode === 'individual' || state.visibility === 'own') {
    return { audience: 'room', event: base };
  }
  if (state.visibility === 'numbers') {
    return { audience: 'room', event: { ...base, value: answer.value } };
  }
  const sharedBand = band(state.sharedBand, [answer]);
  return { audience: 'room', feedback: true, event: { ...base, ...answer, sharedBand } };
}

export function decide(
  state: GtnState,
  act: PlayerAction<GuessAction>,
  ctx: GameCtx<Secrets>,
): Decision<GtnEvent> {
  const player = state.players[act.playerId];
  if (player === undefined) return { ok: false, code: 'OUT_OF_RANGE' };
  const { value } = act.action;
  const answer = { value, feedback: feedbackFor(value, secretOf(ctx.secrets, act.playerId)) };
  const given: GtnEvent = {
    type: 'FeedbackGiven',
    playerId: act.playerId,
    receiveSeq: act.receiveSeq,
    receivedAt: act.receivedAt,
    ...answer,
    band: band(player.band, [answer]),
  };
  const events: Emitted<GtnEvent>[] = [
    { audience: `player:${act.playerId}`, feedback: true, event: given },
    fed(state, act.playerId, player.guesses.length + 1, answer),
  ];
  const signals =
    answer.feedback === 'correct' ? [{ type: 'Solved', playerId: act.playerId } as const] : [];
  return { ok: true, events, signals };
}
