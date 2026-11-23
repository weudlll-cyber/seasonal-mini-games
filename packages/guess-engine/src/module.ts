/**
 * @file   packages/guess-engine/src/module.ts
 * @module guess-engine
 * @brief  A guessing game's parts put together as one GameModule of the platform's contract.
 *
 * Responsibility: from a game's meta, settings, value schema, secret draw, state, rules,
 *                 comment catalogue, own events, views and specials, the `GameModule` of 04 §4:
 *                 the action `{ value }` checked by the game's schema, secrets per round or per
 *                 player, the game's checks then the repeat rule, the engine's decision, and
 *                 folding the engine's events and then the game's own; with the game's
 *                 distance, each player's best guess after the end (`closest`, O110). The
 *                 platform sees an ordinary module (04 §4.7).
 * Depends on:     zod, @smg/game-sdk (contract types), ./closestMiss, ./comments, ./rules,
 *                 ./secrets, ./state
 * Used by:        ./index, games/* (their module)
 * Spec:           docs/spec/04-software-architecture.md §4, §4.7
 */
import type {
  Drbg,
  GameMeta,
  GameModule,
  GameSettings,
  GameViews,
  RoundInput,
  SpecialHooks,
} from '@smg/game-sdk';
import { z, type ZodType } from 'zod';

import type { CommentPicker } from './comments.js';
import { decideGuess, validateGuess, type GuessAction, type GuessRules } from './rules.js';
import { bestGuessesBy } from './closestMiss.js';
import { deriveSecrets, secretOf, type Secrets } from './secrets.js';
import { evolveGuess, isGuessEvent, type Guess, type GuessBase, type GuessEvent } from './state.js';

export interface GuessGame<S extends GuessBase<V, F>, V, F, GE, Cfg, T> {
  readonly meta: GameMeta;
  readonly settings: GameSettings<Cfg>;
  // One guess's value as the input takes it; the game's checks run on top (`rules.check`).
  readonly valueSchema: ZodType<V>;
  // One secret, from the DRBG of its label.
  readonly drawSecret: (rng: Drbg, config: Cfg) => T;
  readonly createState: (input: RoundInput<Cfg>) => S;
  readonly rules: GuessRules<S, V, F, T>;
  readonly picker: CommentPicker;
  // The game's own events (hints, falls, halvings) folded in.
  readonly evolveGame: (state: S, event: GE) => S;
  readonly views: GameViews<S, Secrets<T>>;
  readonly viewSchemas: {
    readonly player: ZodType;
    readonly spectator: ZodType;
    readonly result: ZodType;
  };
  readonly specials?: Partial<SpecialHooks<S, GuessEvent<V, F> | GE, Secrets<T>>>;
  readonly reveal?: (result: unknown, winner: string | null) => string | null;
  readonly found?: string;
  // How far a guess is from the guesser's secret, 0 when it solved (the game's measure, O110):
  // with it the module names each player's best guess (`closest`); without it, none.
  readonly distance?: (guess: Guess<V, F>, secret: T, state: S) => number;
}

export function guessModule<S extends GuessBase<V, F>, V, F, GE, Cfg, T>(
  game: GuessGame<S, V, F, GE, Cfg, T>,
): GameModule<S, GuessAction<V>, GuessEvent<V, F> | GE, Cfg, Secrets<T>> {
  const { rules, picker } = game;
  return {
    meta: game.meta,
    settings: game.settings,
    actionSchema: z.object({ value: game.valueSchema }).strict(),
    deriveSecrets: (input, rng) =>
      deriveSecrets(input, rng, (r) => game.drawSecret(r, input.config)),
    createRound: game.createState,
    validate: (state, playerId, action) => validateGuess(rules, state, playerId, action.value),
    decide: (state, act, ctx) => decideGuess({ rules, picker }, state, act, ctx),
    evolve: (state, event) =>
      isGuessEvent(event as { readonly type: string })
        ? evolveGuess(state, event as GuessEvent<V, F>, picker)
        : game.evolveGame(state, event as GE),
    views: game.views,
    viewSchemas: game.viewSchemas,
    ...(game.specials === undefined ? {} : { specials: game.specials }),
    ...(game.reveal === undefined ? {} : { reveal: game.reveal }),
    ...(game.found === undefined ? {} : { found: game.found }),
    ...closestOf(game),
  };
}

// The module's `closest` from the game's distance (O110): each guess measured against the
// guesser's own secret (the shared one, or theirs in individual mode).
function closestOf<S extends GuessBase<V, F>, V, F, GE, Cfg, T>(
  game: GuessGame<S, V, F, GE, Cfg, T>,
): Pick<GameModule<S, unknown, unknown, Cfg, Secrets<T>>, 'closest'> {
  const distance = game.distance;
  if (distance === undefined) return {};
  return {
    closest: (state, secrets) =>
      bestGuessesBy(state, (g, playerId) => distance(g, secretOf(secrets, playerId), state)),
  };
}
