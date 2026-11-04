/**
 * @file   packages/guess-engine/src/rules.ts
 * @module guess-engine
 * @brief  A guess's acceptance checks and the decision for an accepted guess, with a game's rules.
 *
 * Responsibility: the checks in the order of 02 §5.1 — the game's own (range, map, fallen
 *                 values, a well-formed code), then the repeat rule — and for an accepted guess:
 *                 the answer to the guesser with its closeness comment when the round has them
 *                 (both held by Frost), the room's line at the round's visibility (02 §6.2)
 *                 carrying the comment exactly where it carries the answer (T73), `Solved` when
 *                 the game's rule says so, and the game's extra cooldown if any (T120). The
 *                 comment is drawn with the round's DRBG under `comment/<receiveSeq>` (T72).
 * Depends on:     @smg/game-sdk (contract types), ./comments, ./secrets, ./state, ./tiers
 * Used by:        ./module, ./index
 * Spec:           docs/spec/04-software-architecture.md §4.2, §4.7; docs/spec/02-game-guess-the-number.md §5.1, §6
 */
import type { Decision, Emitted, GameCtx, PlayerAction } from '@smg/game-sdk';

import type { Comment, CommentPicker } from './comments.js';
import { secretOf, type Secrets } from './secrets.js';
import type { GuessBase, GuessEvent } from './state.js';
import type { Tier } from './tiers.js';

export interface GuessAction<V> {
  readonly value: V;
}

// What a game plugs into the engine's checks and decision.
export interface GuessRules<S extends GuessBase<V, F>, V, F, T> {
  // The code for an action of a player the game state does not know.
  readonly unknownPlayer: string;
  // The game's own checks before the repeat rule; a code, or null to go on.
  readonly check: (state: S, playerId: string, value: V) => string | null;
  // Whether two guesses are the same guess (the repeat rule).
  readonly same: (a: V, b: V) => boolean;
  // The feedback rule.
  readonly answer: (value: V, secret: T) => F;
  readonly solved: (feedback: F) => boolean;
  readonly tier: (state: S, value: V, secret: T, feedback: F) => Tier;
  // Milliseconds added to this guesser's cooldown (Bomb Defusal's explosion, O40); none if absent.
  readonly extraCooldownMs?: (state: S, feedback: F) => number;
}

const ALREADY_GUESSED = 'ALREADY_GUESSED';

export function validateGuess<S extends GuessBase<V, F>, V, F, T>(
  rules: GuessRules<S, V, F, T>,
  state: S,
  playerId: string,
  value: V,
): string | null {
  const player = state.players[playerId];
  if (player === undefined) return rules.unknownPlayer;
  const own = rules.check(state, playerId, value);
  if (own !== null) return own;
  if (state.repeatRejected && player.guesses.some((g) => rules.same(g.value, value))) {
    return ALREADY_GUESSED;
  }
  return null;
}

interface Answered<V, F> {
  readonly value: V;
  readonly feedback: F;
  readonly comment: Comment | null;
}

// The room's line: individual mode and `own` say only that a guess happened (02 §6.2); the
// comment goes only where the answer goes.
function fed<V, F>(
  state: GuessBase<V, F>,
  playerId: string,
  guesses: number,
  answer: Answered<V, F>,
): Emitted<GuessEvent<V, F>> {
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

export function decideGuess<S extends GuessBase<V, F>, V, F, T>(
  game: { readonly rules: GuessRules<S, V, F, T>; readonly picker: CommentPicker },
  state: S,
  act: PlayerAction<GuessAction<V>>,
  ctx: GameCtx<Secrets<T>>,
): Decision<GuessEvent<V, F>> {
  const { rules, picker } = game;
  const player = state.players[act.playerId];
  if (player === undefined) return { ok: false, code: rules.unknownPlayer };
  const { value } = act.action;
  const secret = secretOf(ctx.secrets, act.playerId);
  const feedback = rules.answer(value, secret);
  const c = state.comments;
  // The closeness comment, chosen with the round's DRBG under this guess's own label (T72).
  const comment = c.on
    ? picker.pickComment(
        rules.tier(state, value, secret, feedback),
        player.guesses.at(-1)?.comment?.tier ?? null,
        c,
        ctx.rng.child('comment', String(act.receiveSeq)),
      )
    : null;
  const answer = { value, feedback, comment };
  const given: GuessEvent<V, F> = {
    type: 'FeedbackGiven',
    playerId: act.playerId,
    receiveSeq: act.receiveSeq,
    receivedAt: act.receivedAt,
    ...answer,
  };
  const events: Emitted<GuessEvent<V, F>>[] = [
    { audience: `player:${act.playerId}`, feedback: true, event: given },
    fed(state, act.playerId, player.guesses.length + 1, answer),
  ];
  const signals = rules.solved(feedback)
    ? [{ type: 'Solved', playerId: act.playerId } as const]
    : [];
  const extra = rules.extraCooldownMs?.(state, feedback) ?? 0;
  return extra > 0
    ? { ok: true, events, signals, extraCooldownMs: extra }
    : { ok: true, events, signals };
}
