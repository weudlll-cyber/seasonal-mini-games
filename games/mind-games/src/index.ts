/**
 * @file   games/mind-games/src/index.ts
 * @module games/mind-games
 * @brief  Public entry point of @smg-game/mind-games: the module, its kit and its bot.
 *
 * Responsibility: export the GameModule, its conformance kit and its development bot for the
 *                 registry. Nothing here is imported by platform packages.
 * Depends on:     ./conformance, ./devBot, ./module
 * Used by:        games/registry
 * Spec:           docs/spec/04-software-architecture.md §4.6; docs/spec/02e-game-mind-games.md
 */
export { mindConformance } from './conformance.js';
export { mindDevBot } from './devBot.js';
export { mindGames } from './module.js';
