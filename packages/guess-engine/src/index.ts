/**
 * @file   packages/guess-engine/src/index.ts
 * @module guess-engine
 * @brief  Public entry point of @smg/guess-engine: what guessing games share (04 §4.7).
 *
 * Responsibility: secrets, the engine's state part and events, the checks and decision of a
 *                 guess, closeness tiers and comment picking, views and their schemas, the
 *                 closest miss, the Leaf Fall candidate helpers, the shared setting definitions
 *                 and `guessModule`. Pure; imported only by games/*\/src (04 §3).
 * Depends on:     ./candidates, ./closestMiss, ./comments, ./module, ./rules, ./secrets,
 *                 ./settings, ./state, ./tiers, ./views
 * Used by:        games/guess-the-number, games/safecracker, games/bomb-defusal,
 *                 games/seasonal-target
 * Spec:           docs/spec/04-software-architecture.md §4.7
 */
export { guessedValues, pickDistinct, publicGuesses } from './candidates.js';
export { closestMissBy, type ClosestMiss } from './closestMiss.js';
export {
  commentPicker,
  type Comment,
  type CommentLines,
  type CommentPicker,
  type Pool,
  type UsedLines,
} from './comments.js';
export { guessModule, type GuessGame } from './module.js';
export type { GuessAction, GuessRules } from './rules.js';
export { allSecrets, deriveSecrets, secretOf, type Secrets } from './secrets.js';
export { COMMENTS_DEF, readGuessConfig, repeatDef, TREND_DEF, visibilityDef } from './settings.js';
export {
  baseState,
  withPlayer,
  type CommentState,
  type Guess,
  type GuessBase,
  type GuessConfig,
  type GuessEvent,
  type GuessPlayer,
  type Visibility,
} from './state.js';
export { tierByPercent, TIERS, trendOf, type Thresholds, type Tier } from './tiers.js';
export { guessSchemas, LOG_LIMIT, othersGuesses, ownGuesses, resultGuesses } from './views.js';
