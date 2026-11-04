/**
 * @file   games/bomb-defusal/src/index.ts
 * @module games/bomb-defusal
 * @brief  Public entry point of @smg-game/bomb-defusal: the module and its types.
 *
 * Responsibility: export the GameModule, its conformance kit and its development bot for the
 *                 registry, and the settings, the wording of a sequence and the types its screens
 *                 name. Nothing here is imported by platform packages.
 * Depends on:     ./conformance, ./devBot, ./module, ./rules, ./settings, ./state, ./views,
 *                 ./wires
 * Used by:        games/registry, games/bomb-defusal/web
 * Spec:           docs/spec/04-software-architecture.md §4.6; docs/spec/02c-game-bomb-defusal.md
 */
export { bombDefusalConformance } from './conformance.js';
export { bombDefusalDevBot } from './devBot.js';
export { bombDefusal } from './module.js';
export type { GuessAction } from './rules.js';
export { bdSettings, type BdConfig } from './settings.js';
export type { BdEvent, BdState } from './state.js';
export type { PlayerView, ResultView, SpectatorView } from './views.js';
export { sequenceText, type Feedback, type Sequence, type Wire } from './wires.js';
