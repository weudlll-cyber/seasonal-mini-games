/**
 * @file   packages/application/src/round/roundSettings.ts
 * @module application/round
 * @brief  A game's settings document, and the frozen settings of a new round.
 *
 * Responsibility: the document `game.<id>` is the platform's round keys followed by the
 *                 game's own. A round's settings are the document's values with the host's
 *                 choices on top: only keys the host chooses, each inside the bounds in force,
 *                 then the game's cross-key rule. Anything else is ROUND_SETTINGS_INVALID with
 *                 a sentence for the host form (08 §3).
 * Depends on:     @smg/game-sdk (definitions, checks, round keys)
 * Used by:        ./roundSession tests, ../index, apps/server (round creation, settings service)
 * Spec:           docs/spec/08-admin-settings.md §1, §3; docs/spec/06-data-model-api-realtime.md §3.1
 */
import {
  PLATFORM_ROUND_SETTINGS,
  readPlatformRound,
  resolveSettings,
  settingProblem,
  type GameModule,
  type PlatformRoundConfig,
  type SettingDef,
  type SettingOverride,
} from '@smg/game-sdk';

export class RoundSettingsError extends Error {
  readonly code = 'ROUND_SETTINGS_INVALID';
}

export function gameSettingsDefs<S, A, E, Cfg, Sec>(
  module: GameModule<S, A, E, Cfg, Sec>,
): readonly SettingDef[] {
  return [...PLATFORM_ROUND_SETTINGS, ...module.settings.defs];
}

export interface RoundSettings<Cfg> {
  readonly platform: PlatformRoundConfig;
  readonly game: Cfg;
}

export function chooseRoundSettings<S, A, E, Cfg, Sec>(
  module: GameModule<S, A, E, Cfg, Sec>,
  overrides: Readonly<Record<string, SettingOverride>>,
  choices: Readonly<Record<string, unknown>>,
): RoundSettings<Cfg> {
  const defs = gameSettingsDefs(module);
  const byKey = new Map(defs.map((d) => [d.key, d]));
  const values = resolveSettings(defs, overrides);
  for (const [key, value] of Object.entries(choices)) {
    const def = byKey.get(key);
    if (def?.hostChooses !== true) throw new RoundSettingsError(`${key}: not a round setting`);
    const problem = settingProblem(def, value, overrides[key]);
    if (problem !== null) throw new RoundSettingsError(`${def.label}: ${problem}`);
    values[key] = value as (typeof values)[string];
  }
  const game = module.settings.read(values);
  const problem = module.settings.problem(game);
  if (problem !== null) throw new RoundSettingsError(problem);
  return { platform: readPlatformRound(values), game };
}
