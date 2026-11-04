/**
 * @file   apps/web/src/shell/quickTestSettings.tsx
 * @module web/shell
 * @brief  The Quick Test's settings: which it offers for the chosen game, and the request body.
 *
 * Responsibility: the round settings every game's Quick Test shows and its starting values,
 *                 the chosen game's own host settings after them (O41), their fields through
 *                 the host form's own `Field`, and the body of `POST /dev/quicktest` with the
 *                 game's settings by key (DECISIONS T121) and, for a summer round, Heatwave's
 *                 step and interval (O63, T208). Development builds only, with
 *                 ./QuickTest.
 * Depends on:     react, @smg/contracts, @smg/game-sdk (definitions), @smg-game/registry/web,
 *                 ../match/roundFields
 * Used by:        ./QuickTest
 * Spec:           docs/spec/11-roadmap.md (phase 1 Quick Test); docs/spec/09-testing-strategy.md §1, §4
 */
import { GAME_SCREENS } from '@smg-game/registry/web';
import type { SeasonName } from '@smg/contracts';
import { PLATFORM_ROUND_SETTINGS, type SettingDef, type SettingValue } from '@smg/game-sdk';
import type { ReactElement } from 'react';

import { Field, seasonalDefs } from '../match/roundFields.js';

// The round settings the Quick Test offers for every game, in the form's order; the chosen
// game's own host settings follow (O41). Its own starting values where they differ.
export const KEYS = [
  'round.secretMode',
  'round.feedbackVisibility',
  'round.cooldownS',
  'round.countdownS',
] as const;
export const START: Readonly<Record<string, SettingValue>> = {
  'round.secretMode': 'shared',
  'round.feedbackVisibility': 'full',
  'round.cooldownS': 5,
  'round.rangeLow': 1,
  'round.rangeHigh': 100,
  'round.rangeVisible': true,
  'round.comments': true,
};
// The definitions of a game's round: the platform's keys, then the game's own.
export const defsOf = (gameId: string): readonly SettingDef[] => [
  ...PLATFORM_ROUND_SETTINGS,
  ...(GAME_SCREENS[gameId]?.settings ?? []),
];

// The game's own settings a host chooses, besides the ones the form shows for every game.
export const gameKeysOf = (gameId: string): readonly string[] =>
  (GAME_SCREENS[gameId]?.settings ?? [])
    .filter((d) => d.hostChooses && !(KEYS as readonly string[]).includes(d.key))
    .map((d) => d.key);

export interface Extra {
  readonly gameId: string;
  readonly seedText: string;
  readonly season: SeasonName | '';
  readonly bots: number;
  readonly fast: boolean;
  readonly lobby: boolean;
  readonly teamMatch: boolean;
}

export type Values = Readonly<Record<string, SettingValue>>;

export function SettingFields(p: {
  readonly keys: readonly string[];
  readonly defs: readonly SettingDef[];
  readonly values: Values;
  readonly set: (key: string, v: SettingValue) => void;
}): ReactElement {
  return (
    <>
      {p.keys.map((key) => {
        const def = p.defs.find((d) => d.key === key);
        return def === undefined ? null : (
          <Field
            key={key}
            def={def}
            value={p.values[key] ?? def.default}
            set={(v) => {
              p.set(key, v);
            }}
          />
        );
      })}
    </>
  );
}

// The request body: the server's Quick Test names the common fields; the game's own settings
// go by key (T121).
export function bodyOf(values: Values, extra: Extra) {
  const defs = defsOf(extra.gameId);
  const valueOf = (key: string) => values[key] ?? defs.find((d) => d.key === key)?.default;
  return {
    gameId: extra.gameId,
    mode: values['round.secretMode'],
    visibility: valueOf('round.feedbackVisibility'),
    cooldownS: values['round.cooldownS'],
    // The intro screen as long as in a normal round: the setting's default unless changed.
    countdownS: valueOf('round.countdownS'),
    settings: {
      ...Object.fromEntries(gameKeysOf(extra.gameId).map((key) => [key, valueOf(key)])),
      // Heatwave's step and interval for a summer round (O63, T208).
      ...(extra.season === 'summer'
        ? Object.fromEntries(seasonalDefs(defs).map((d) => [d.key, valueOf(d.key)]))
        : {}),
    },
    bots: extra.bots,
    fast: extra.fast,
    lobby: extra.lobby,
    teamMatch: extra.teamMatch,
    ...(extra.seedText.trim() === '' ? {} : { seedText: extra.seedText }),
    ...(extra.season === '' ? {} : { season: extra.season }),
  };
}
