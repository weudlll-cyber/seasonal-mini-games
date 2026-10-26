/**
 * @file   games/guess-the-number/src/index.ts
 * @module games/guess-the-number
 * @brief  Public entry point of @smg-game/guess-the-number: the module and its types.
 *
 * Responsibility: export the GameModule, its conformance kit and its development bot for
 *                 the registry, and the
 *                 types its screens and tests name. Nothing here is imported by platform packages.
 * Depends on:     ./conformance, ./devBot, ./feedback, ./module, ./rules, ./secrets, ./settings, ./state
 * Used by:        games/registry, games/guess-the-number/web
 * Spec:           docs/spec/04-software-architecture.md §4.6
 */
export { gtnConformance } from './conformance.js';
export { gtnDevBot } from './devBot.js';
export type { Feedback } from './feedback.js';
export { guessTheNumber } from './module.js';
export { GUESS_LIMIT, type GtnCode, type GuessAction } from './rules.js';
export type { Secrets } from './secrets.js';
export { gtnSettings, type GtnConfig, type Visibility } from './settings.js';
export type { GtnEvent, GtnState } from './state.js';
export type { PlayerView, ResultView, SpectatorView } from './views.js';
