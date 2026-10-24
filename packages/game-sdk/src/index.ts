/**
 * @file   packages/game-sdk/src/index.ts
 * @module game-sdk
 * @brief  Public entry point of @smg/game-sdk: what every game module and the platform share.
 *
 * Responsibility: the random-number types and setting definitions with their checks; free
 *                 of node:crypto, so browser code may import it. The DRBG and the
 *                 commitment are the separate entry @smg/game-sdk/crypto. The game-module
 *                 contract joins here with the Guess The Number work (04 §4).
 * Depends on:     ./random, ./settings
 * Used by:        packages/domain, packages/contracts, games/*, apps/server
 * Spec:           docs/spec/04-software-architecture.md §3, §4
 */
export type { Drbg, RoundRng } from './random.js';
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
