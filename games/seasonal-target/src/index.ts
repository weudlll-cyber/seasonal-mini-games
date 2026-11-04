/**
 * @file   games/seasonal-target/src/index.ts
 * @module games/seasonal-target
 * @brief  Public entry point of @smg-game/seasonal-target: the module and its types.
 *
 * Responsibility: export the GameModule, its conformance kit and its development bot for the
 *                 registry, and the types and pure helpers its screens name (the compass, the
 *                 cell and area shapes, the views and events). Nothing here is imported by
 *                 platform packages.
 * Depends on:     ./conformance, ./devBot, ./geometry, ./module, ./rules, ./secrets,
 *                 ./settings, ./state, ./views
 * Used by:        games/registry, games/seasonal-target/web
 * Spec:           docs/spec/04-software-architecture.md §4.6; docs/spec/02d-game-seasonal-target.md
 */
export { stConformance as seasonalTargetConformance } from './conformance.js';
export { stDevBot as seasonalTargetDevBot } from './devBot.js';
export {
  inArea,
  sameCell,
  type Area,
  type Cell,
  type Compass,
  type Feedback,
  type MapSize,
  type MissTier,
} from './geometry.js';
export { seasonalTarget } from './module.js';
export type { GuessAction, StCode } from './rules.js';
export type { Secrets } from './secrets.js';
export { stSettings, type StConfig } from './settings.js';
export { QUARTER_NAMES } from './state.js';
export type { Quarter, QuarterPair, StEvent, StState } from './state.js';
export type { PlayerView, ResultView, SpectatorView } from './views.js';
