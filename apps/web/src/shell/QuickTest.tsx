/**
 * @file   apps/web/src/shell/QuickTest.tsx
 * @module web/shell
 * @brief  The development Quick Test: one round against bots, with a seed field.
 *
 * Responsibility: choose the seed text (the same text gives the same secret and season), the
 *                 secret mode, the season (or the seed's), what others see, the bots, the
 *                 cooldown, the lowest and highest number, whether the range is shown, the
 *                 closeness comments (O21) and the fast test profile; start it (`POST /dev/quicktest`) and go to the match,
 *                 where the round counts down at once and the player hosts it. Every field has
 *                 its one-line help under it: the settings with the words and bounds of their
 *                 definitions through the host form's own `Field`, the rest from FORM_HELP, so
 *                 both forms say the same. Development builds only: the shell loads this module
 *                 on demand and a production build leaves it out.
 * Depends on:     react, @smg/contracts, @smg/game-sdk (definitions), @smg-game/registry/web,
 *                 ./http, ./router, ../season/season, ../components/fields, ../match/* (and its
 *                 form grid, ../match/match.css)
 * Used by:        ./AppShell (lazy, development only)
 * Spec:           docs/spec/11-roadmap.md (phase 1 Quick Test); docs/spec/09-testing-strategy.md §1, §4
 */
import { GAME_SCREENS } from '@smg-game/registry/web';
import type { QuickTestStartedView, SeasonName } from '@smg/contracts';
import { PLATFORM_ROUND_SETTINGS, type SettingDef, type SettingValue } from '@smg/game-sdk';
import { useState, type ReactElement, type SyntheticEvent } from 'react';

import { ChoiceField, NumberField, Problem, SwitchField, TextField } from '../components/fields.js';
import { FORM_HELP } from '../match/formHelp.js';
import { Field } from '../match/roundFields.js';
import { SEASON_NAMES, SEASONS } from '../season/season.js';
import { api } from './http.js';
import { navigate } from './router.js';
import '../match/match.css';

const GAME = 'guess-the-number';
// The settings the Quick Test offers, in the form's order, with its own starting values.
const KEYS = ['round.secretMode', 'round.feedbackVisibility', 'round.cooldownS'] as const;
const RANGE_KEYS = [
  'round.rangeLow',
  'round.rangeHigh',
  'round.rangeVisible',
  'round.comments',
] as const;
const START: Readonly<Record<string, SettingValue>> = {
  'round.secretMode': 'shared',
  'round.feedbackVisibility': 'full',
  'round.cooldownS': 5,
  'round.rangeLow': 1,
  'round.rangeHigh': 100,
  'round.rangeVisible': true,
  'round.comments': true,
};
const SEASON_CHOICES = [
  { value: '' as const, label: 'from the seed' },
  ...SEASONS.map((s) => ({ value: s, label: SEASON_NAMES[s] })),
];

const defs: readonly SettingDef[] = [
  ...PLATFORM_ROUND_SETTINGS,
  ...(GAME_SCREENS[GAME]?.settings ?? []),
];
const defOf = (key: string) => defs.find((d) => d.key === key);

interface Extra {
  readonly seedText: string;
  readonly season: SeasonName | '';
  readonly bots: number;
  readonly fast: boolean;
}

type Values = Readonly<Record<string, SettingValue>>;

function SettingFields(p: {
  readonly keys: readonly string[];
  readonly values: Values;
  readonly set: (key: string, v: SettingValue) => void;
}): ReactElement {
  return (
    <>
      {p.keys.map((key) => {
        const def = defOf(key);
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

// The request body: the server's Quick Test names its fields itself.
function bodyOf(values: Values, extra: Extra) {
  return {
    mode: values['round.secretMode'],
    visibility: values['round.feedbackVisibility'],
    cooldownS: values['round.cooldownS'],
    rangeLow: values['round.rangeLow'],
    rangeHigh: values['round.rangeHigh'],
    rangeVisible: values['round.rangeVisible'],
    comments: values['round.comments'],
    bots: extra.bots,
    fast: extra.fast,
    ...(extra.seedText.trim() === '' ? {} : { seedText: extra.seedText }),
    ...(extra.season === '' ? {} : { season: extra.season }),
  };
}

// The fields that are not settings, by name, to place between the settings.
function extraFields(p: { readonly extra: Extra; readonly set: (e: Partial<Extra>) => void }) {
  const { extra, set } = p;
  return {
    seed: (
      <TextField
        label="Seed"
        help={FORM_HELP.seed}
        value={extra.seedText}
        maxLength={64}
        placeholder="any text, e.g. meadow"
        testId="seed"
        onChange={(seedText) => {
          set({ seedText });
        }}
      />
    ),
    season: (
      <ChoiceField<SeasonName | ''>
        label="Season"
        help={FORM_HELP.season}
        value={extra.season}
        options={SEASON_CHOICES}
        onChange={(season) => {
          set({ season });
        }}
      />
    ),
    bots: (
      <NumberField
        label="Bots"
        help={FORM_HELP.bots}
        value={extra.bots}
        min={1}
        max={50}
        onChange={(bots) => {
          set({ bots });
        }}
      />
    ),
    fast: (
      <SwitchField
        label="Fast specials"
        help={FORM_HELP.fast}
        checked={extra.fast}
        onChange={(fast) => {
          set({ fast });
        }}
      />
    ),
  };
}

export function QuickTest(): ReactElement {
  const [values, setValues] = useState<Values>(START);
  const [extra, setExtra] = useState<Extra>({ seedText: '', season: '', bots: 3, fast: true });
  const [problem, setProblem] = useState<string | null>(null);
  const set = (key: string, v: SettingValue): void => {
    setValues((old) => ({ ...old, [key]: v }));
  };
  const more = extraFields({
    extra,
    set: (e) => {
      setExtra((old) => ({ ...old, ...e }));
    },
  });
  const start = (e: SyntheticEvent): void => {
    e.preventDefault();
    api<QuickTestStartedView>('/dev/quicktest', { method: 'POST', body: bodyOf(values, extra) })
      .then((started) => {
        navigate({ name: 'match', code: started.matchCode });
      })
      .catch(() => {
        setProblem(
          'The Quick Test could not start. Are you signed in, and is the range at least 10 numbers?',
        );
      });
  };
  return (
    <form className="smg-panel smg-stack" onSubmit={start} data-testid="quick-test">
      <h1>Quick Test</h1>
      <p className="smg-muted">
        One round against bots, which you host and play. The same seed gives the same secret and the
        same season.
      </p>
      <div className="host-form">
        {more.seed}
        <SettingFields keys={KEYS.slice(0, 1)} values={values} set={set} />
        {more.season}
        <SettingFields keys={KEYS.slice(1, 2)} values={values} set={set} />
        {more.bots}
        <SettingFields keys={[...KEYS.slice(2), ...RANGE_KEYS]} values={values} set={set} />
        {more.fast}
      </div>
      <Problem text={problem} />
      <button type="submit" className="smg-btn smg-btn--primary" data-testid="start-quick-test">
        Start Quick Test
      </button>
    </form>
  );
}
