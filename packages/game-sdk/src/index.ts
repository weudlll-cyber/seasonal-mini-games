/**
 * @file   packages/game-sdk/src/index.ts
 * @module game-sdk
 * @brief  Public entry point of @smg/game-sdk: what every game module and the platform share.
 *
 * Responsibility: the game-module contract, range arithmetic, the random-number types,
 *                 setting definitions with their checks and the platform's round keys; free
 *                 of node:crypto, so browser code may import it. The DRBG and the
 *                 commitment are the separate entry @smg/game-sdk/crypto.
 * Depends on:     ./module, ./range, ./random, ./roundSettings, ./settings
 * Used by:        packages/domain, packages/contracts, games/*, apps/server
 * Spec:           docs/spec/04-software-architecture.md §3, §4
 */
export type {
  Audience,
  ConformanceKit,
  Decision,
  DevBot,
  Emitted,
  GameCtx,
  GameEntry,
  GameMeta,
  GameModule,
  GameSettings,
  GameViews,
  PlayerAction,
  RosterPlayer,
  RoundInput,
  Season,
  SecretMode,
  Signal,
  ViewCtx,
} from './module.js';
export { inRange, intersect, rangeSize, type Range } from './range.js';
export type { Drbg, RoundRng } from './random.js';
export {
  PLATFORM_ROUND_SETTINGS,
  readPlatformRound,
  type PlatformRoundConfig,
  type PointsTable,
} from './roundSettings.js';
export {
  boundsProblem,
  effectiveBounds,
  resolveSettings,
  settingProblem,
  type BoolDef,
  type Bounds,
  type EnumDef,
  type IntDef,
  type IntListDef,
  type NumberDef,
  type RunningEffect,
  type SettingDef,
  type SettingOverride,
  type SettingStatus,
  type SettingValue,
  type TextDef,
} from './settings.js';
