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
 *                 round instead (DECISIONS T55). A `phased` game's document holds only the
 *                 platform keys it uses (the countdown and the season's source); its other
 *                 platform values are fixed off, its longest time is its plan's end, and the
 *                 plan travels with the settings (04 §4.8 rules 1 and 4).
 * Depends on:     @smg/game-sdk (definitions, checks, round keys)
 * Used by:        ./roundSession tests, ../index, apps/server (round creation, settings service)
 * Spec:           docs/spec/08-admin-settings.md §1, §3, §3.4; docs/spec/06-data-model-api-realtime.md §3.1;
 *                 docs/spec/04-software-architecture.md §4.8
 */
import {
  inactivityIssue,
  planIssue,
  PLATFORM_ROUND_SETTINGS,
  readPlatformRound,
  resolveSettings,
  settingIssue,
  type GameModule,
  type PhasePlan,
  type PlatformRoundConfig,
  type SettingDef,
  type SettingOverride,
  type SettingValue,
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

// The platform keys a `phased` game's document holds (04 §4.8 rule 4, 08 §3.4).
const PHASED_PLATFORM_KEYS: ReadonlySet<string> = new Set([
  'round.countdownS',
  'round.seasonSource',
]);

export function gameSettingsDefs<S, A, E, Cfg, Sec>(
  module: GameModule<S, A, E, Cfg, Sec>,
): readonly SettingDef[] {
  const platform =
    module.meta.timing === 'phased'
      ? PLATFORM_ROUND_SETTINGS.filter((d) => PHASED_PLATFORM_KEYS.has(d.key))
      : PLATFORM_ROUND_SETTINGS;
  return [...platform, ...module.settings.defs];
}

export interface RoundSettings<Cfg> {
  readonly platform: PlatformRoundConfig;
  readonly game: Cfg;
  // A `phased` round's plan (04 §4.8); absent for the guess games.
  readonly plan?: PhasePlan;
}

// A phased round: the plan from the game's config; the platform values its document does
// not hold are their defaults, with everything a phased round does not have switched off.
// The cooldown keeps its default, which the round never uses: the rounds table's CHECK wants
// one (DECISIONS T288).
function phasedSettings<S, A, E, Cfg, Sec>(
  module: GameModule<S, A, E, Cfg, Sec>,
  values: Readonly<Record<string, SettingValue>>,
  game: Cfg,
): RoundSettings<Cfg> {
  if (module.phased === undefined) throw new Error('a phased game gives its plan');
  const plan = module.phased.plan(game);
  const issue = planIssue(plan);
  if (issue !== null) throw new RoundSettingsError(issue);
  const base = readPlatformRound({ ...resolveSettings(PLATFORM_ROUND_SETTINGS, {}), ...values });
  const platform: PlatformRoundConfig = {
    ...base,
    secretMode: 'shared',
    inactivityLimitMs: 0,
    inactivityWarnMs: 0,
    maxDurationMs: plan.endMs,
    marginWindowMs: 0,
    specialOn: false,
    teamsOn: false,
    halving: false,
    commitReveal: false,
  };
  return { platform, game, plan };
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
  // A rule across keys says its sentence under the setting it names, if it names one (T335).
  if (typeof problem === 'string') throw new RoundSettingsError(problem);
  if (problem !== null) throw new RoundSettingsError(problem.message, problem.key);
  if (module.meta.timing === 'phased') return phasedSettings(module, values, game);
  const platform = readPlatformRound(values);
  // A game may rule halving out for these values: the round keeps its season and special.
  const halving = platform.halving && module.settings.halvingAllowed?.(game) !== false;
  return { platform: { ...platform, halving }, game };
}
