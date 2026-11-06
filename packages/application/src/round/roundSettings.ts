/**
 * @file   packages/application/src/round/roundSettings.ts
 * @module application/round
 * @brief  A game's settings document, and the frozen settings of a new round.
 *
 * Responsibility: the document `game.<id>` is the platform's round keys followed by the
 *                 game's own. A round's settings are the document's values with the host's
 *                 choices on top: only keys the host chooses, each inside the bounds in force,
 *                 then the platform's cross-key rule (the inactivity warning below the limit,
 *                 O71) and the game's. Anything else is ROUND_SETTINGS_INVALID with
 *                 a sentence for the host form (08 §3) and, where the problem belongs to one
 *                 field, that setting's key: the form shows the sentence under it (O74). A
 *                 game that rules halving out for the chosen values gets a normal season
 *                 round instead (DECISIONS T55).
 * Depends on:     @smg/game-sdk (definitions, checks, round keys)
 * Used by:        ./roundSession tests, ../index, apps/server (round creation, settings service)
 * Spec:           docs/spec/08-admin-settings.md §1, §3; docs/spec/06-data-model-api-realtime.md §3.1
 */
import {
  inactivityIssue,
  PLATFORM_ROUND_SETTINGS,
  readPlatformRound,
  resolveSettings,
  settingIssue,
  type GameModule,
  type PlatformRoundConfig,
  type SettingDef,
  type SettingOverride,
} from '@smg/game-sdk';

// `field`: the setting the sentence belongs to, or null for a rule of the game as a whole.
export class RoundSettingsError extends Error {
  readonly code = 'ROUND_SETTINGS_INVALID';
  constructor(
    message: string,
    readonly field: string | null = null,
  ) {
    super(message);
  }
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
    if (def?.hostChooses !== true) {
      throw new RoundSettingsError(`${key} is not a setting of a round.`, key);
    }
    const issue = settingIssue(def, value, overrides[key]);
    if (issue !== null) throw new RoundSettingsError(issue.message, key);
    values[key] = value as (typeof values)[string];
  }
  // The platform's cross-key rule over the admin defaults and the host's choices (O71).
  const inactivity = inactivityIssue(values);
  if (inactivity !== null) throw new RoundSettingsError(inactivity.message, inactivity.key);
  const game = module.settings.read(values);
  const problem = module.settings.problem(game);
  if (problem !== null) throw new RoundSettingsError(problem);
  const platform = readPlatformRound(values);
  // A game may rule halving out for these values: the round keeps its season and special.
  const halving = platform.halving && module.settings.halvingAllowed?.(game) !== false;
  return { platform: { ...platform, halving }, game };
}
