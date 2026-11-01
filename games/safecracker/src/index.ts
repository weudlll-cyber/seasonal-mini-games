/**
 * @file   games/safecracker/src/index.ts
 * @module games/safecracker
 * @brief  Public entry point of @smg-game/safecracker: the module and its types.
 *
 * Responsibility: export the GameModule, its conformance kit and its development bot for the
 *                 registry, and the types and helpers its screens name (the code's form check
 *                 the input row repeats, 02b §4). Nothing here is imported by platform packages.
 * Depends on:     ./conformance, ./devBot, ./feedback, ./module, ./rules, ./settings, ./state,
 *                 ./views
 * Used by:        games/registry, games/safecracker/web
 * Spec:           docs/spec/04-software-architecture.md §4.6; docs/spec/02b-game-safecracker.md
 */
export { scConformance as safecrackerConformance } from './conformance.js';
export { scDevBot as safecrackerDevBot } from './devBot.js';
export type { Feedback } from './feedback.js';
export { safecracker } from './module.js';
export { wellFormed, type GuessAction, type ScCode } from './rules.js';
export { scSettings, type ScConfig } from './settings.js';
export type { Hint, ScEvent, ScState } from './state.js';
export type { PlayerView, ResultView, SpectatorView } from './views.js';
