/**
 * @file   games/mind-games/src/index.ts
 * @module games/mind-games
 * @brief  Public entry point of @smg-game/mind-games: the module, its kit, its bot and its types.
 *
 * Responsibility: export the GameModule, its conformance kit and its development bot for the
 *                 registry, and for the game's screens the settings, the options, the view
 *                 types and the result's words. Nothing here is imported by platform packages.
 * Depends on:     ./choices, ./conformance, ./devBot, ./module, ./settings, ./views, ./words
 * Used by:        games/registry, games/mind-games/web
 * Spec:           docs/spec/04-software-architecture.md §4.6; docs/spec/02e-game-mind-games.md
 */
export { mindConformance } from './conformance.js';
export { mindDevBot, mindDevPrefs } from './devBot.js';
export { mindGames } from './module.js';
export { optionsOf, type Choice } from './choices.js';
export { DEFAULT_CONFIG, mindSettings } from './settings.js';
export type { FeedLineView, PlayerView, ResultView, SpectatorView } from './views.js';
export { CHOICE_NAMES, headline, placeWords } from './words.js';
