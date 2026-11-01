/**
 * @file   games/guess-the-number/src/rules.ts
 * @module games/guess-the-number
 * @brief  The game's acceptance checks and its decision for an accepted guess.
 *
 * Responsibility: checks 4–6 of 02 §5.1 (inside the player's current range when the range is
 *                 shown, not removed, not guessed before when repeats are refused); with a
 *                 hidden range any whole number is accepted and answered, because refusing
 *                 one outside the range would tell where the range is (DECISIONS T53). For an
 *                 accepted guess: the answer to the guesser with its closeness comment when the
 *                 round has them (both held by Frost), the room's line at the round's
 *                 visibility (02 §6.2) carrying the comment exactly where it carries the answer
 *                 (T73), and `Solved` when the number was found.
 * Depends on:     @smg/game-sdk (contract, inRange), ./closeness, ./comments, ./feedback,
 *                 ./secrets, ./state
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

import { tierOf } from './closeness.js';
import { pickComment, type Comment } from './comments.js';
import { feedbackFor, type Answer } from './feedback.js';
import { secretOf, type Secrets } from './secrets.js';
import type { GtnEvent, GtnState } from './state.js';

export interface GuessAction {
  readonly value: number;
}

export type GtnCode = 'OUT_OF_RANGE' | 'NUMBER_REMOVED' | 'ALREADY_GUESSED';

// The input takes any whole number from −1 000 000 000 to 1 000 000 000 (T53).
export const GUESS_LIMIT = 1_000_000_000;

export function validate(state: GtnState, playerId: string, action: GuessAction): GtnCode | null {
  const player = state.players[playerId];
  if (player === undefined) return 'OUT_OF_RANGE';
  if (state.rangeVisible && !inRange(player.range, action.value)) return 'OUT_OF_RANGE';
  if (state.removed.includes(action.value)) return 'NUMBER_REMOVED';
  if (state.repeatRejected && player.guesses.some((g) => g.value === action.value)) {
    return 'ALREADY_GUESSED';
  }
  return null;
}

// The room's line: individual mode and `own` say only that a guess happened (02 §6.2); the
// comment goes only where the answer goes.
function fed(
  state: GtnState,
  playerId: string,
  guesses: number,
  answer: Answer & { readonly comment: Comment | null },
): Emitted<GtnEvent> {
  const base = { type: 'GuessFed', playerId, guesses } as const;
  if (state.mode === 'individual' || state.visibility === 'own') {
    return { audience: 'room', event: base };
  }
  if (state.visibility === 'numbers') {
    return { audience: 'room', event: { ...base, value: answer.value } };
  }
  const { comment, ...rest } = answer;
  const event = comment === null ? { ...base, ...rest } : { ...base, ...rest, comment };
  return { audience: 'room', feedback: true, event };
}

// The closeness comment, chosen with the round's DRBG under this guess's own label (T72).
function commentOn(
  state: GtnState,
  act: PlayerAction<GuessAction>,
  secret: number,
  rng: GameCtx<Secrets>['rng'],
): Comment | null {
  const c = state.comments;
  if (!c.on) return null;
  const tier = tierOf(act.action.value, secret, state.initial, c.thresholds);
  const previous = state.players[act.playerId]?.guesses.at(-1)?.comment?.tier ?? null;
  return pickComment(tier, previous, c, rng.child('comment', String(act.receiveSeq)));
}

export function decide(
  state: GtnState,
  act: PlayerAction<GuessAction>,
  ctx: GameCtx<Secrets>,
): Decision<GtnEvent> {
  const player = state.players[act.playerId];
  if (player === undefined) return { ok: false, code: 'OUT_OF_RANGE' };
  const { value } = act.action;
  const secret = secretOf(ctx.secrets, act.playerId);
  const answer = {
    value,
    feedback: feedbackFor(value, secret),
    comment: commentOn(state, act, secret, ctx.rng),
  };
  const given: GtnEvent = {
    type: 'FeedbackGiven',
    playerId: act.playerId,
    receiveSeq: act.receiveSeq,
    receivedAt: act.receivedAt,
    ...answer,
  };
  const events: Emitted<GtnEvent>[] = [
    { audience: `player:${act.playerId}`, feedback: true, event: given },
    fed(state, act.playerId, player.guesses.length + 1, answer),
  ];
  const signals =
    answer.feedback === 'correct' ? [{ type: 'Solved', playerId: act.playerId } as const] : [];
  return { ok: true, events, signals };
}
