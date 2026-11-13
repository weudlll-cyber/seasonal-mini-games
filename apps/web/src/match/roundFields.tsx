/**
 * @file   apps/web/src/match/roundFields.tsx
 * @module web/match
 * @brief  The fields of the host's round form: one per setting, and the season controls.
 *
 * Responsibility: a setting definition becomes a switch, a choice or a number field with its
 *                 label and one-line help and the bounds in force (the document's narrowed
 *                 bounds, never wider than the catalogue, 08 §1; an off value beside them, the
 *                 inactivity limit's 0, O71), checked while typing with the setting's own check
 *                 and its sentence under the field, where a refused round setup's sentence for
 *                 that field shows too (O74, `problemsOf`); the Quick Test uses the same
 *                 fields. The season choice offers In Season only while it is usable, and the
 *                 halving switch only on a halving day (03 §3, §4); the next round starts from
 *                 the last round's season, halving and inactivity pair (`keptOf`, T209, O75).
 *                 `HostFields` shows the
 *                 host's fields of the round's season (`formSeason`): Heatwave's step and
 *                 interval only for summer (`forSeason`, O63).
 * Depends on:     react, @smg/contracts, @smg/game-sdk (bounds, check), ../components/fields,
 *                 ./formHelp, ../round/roundText, ../season/season, ../shell/http
 * Used by:        ./HostMenu, ../shell/QuickTest
 * Spec:           docs/spec/08-admin-settings.md §1, §3; docs/spec/03-seasonal-specials.md §3, §4
 */
import { GAME_SCREENS, type GameWeb } from '@smg-game/registry/web';
import type {
  MatchDetailsView,
  RoundStateView,
  SeasonName,
  SeasonsCurrentView,
} from '@smg/contracts';
import {
  type FieldState,
  effectiveBounds,
  settingIssue,
  type SettingDef,
  type SettingValue,
} from '@smg/game-sdk';
import { useEffect, useState, type ReactElement } from 'react';

import { ChoiceField, NumberField, plain, SwitchField } from '../components/fields.js';
import { codeText } from '../round/roundText.js';
import { SEASON_NAMES, SEASONS } from '../season/season.js';
import { FORM_HELP } from './formHelp.js';
import { api, ApiError } from '../shell/http.js';

type Doc = NonNullable<MatchDetailsView['nextRoundDefaults']>;

// A form's problems after a refused round setup (O74): the server's sentence under the field
// it names while the form shows that field, else one line for the whole form.
export interface FormProblems {
  readonly fields: Readonly<Record<string, string>>;
  readonly form: string | null;
}

export const NO_PROBLEMS: FormProblems = { fields: {}, form: null };

export function problemsOf(error: unknown, shown: readonly string[], other: string): FormProblems {
  const refusal = error instanceof ApiError ? error.refusal : null;
  if (refusal === null) return { fields: {}, form: other };
  if (!shown.includes(refusal.field)) return { fields: {}, form: refusal.detail };
  return { fields: { [refusal.field]: refusal.detail }, form: null };
}

// The host form's problems: any other refusal's code in plain words.
export const setupProblems = (error: unknown, shown: readonly string[]): FormProblems =>
  problemsOf(
    error,
    shown,
    error instanceof ApiError ? codeText(error.code) : 'The round could not be created.',
  );

// One setting as a field, its label and help from the definition (the same words wherever it is
// shown); the bounds are the document's when there is one, else the definition's. A number
// is checked with the setting's own check, its sentence under the field (O74); `problem` is
// the server's for this field.
// A field's words and value with the game's word on it (T335).
function shownOf(p: {
  def: SettingDef;
  value: SettingValue;
  problem?: string | undefined;
  state?: FieldState | null | undefined;
}) {
  const help = p.state?.help ?? p.def.help;
  const common = { label: p.def.label, help, problem: p.problem, disabled: p.state?.disabled };
  return { common, value: p.state?.value ?? p.value };
}

export function Field(p: {
  def: SettingDef;
  doc?: Doc;
  value: SettingValue;
  set: (v: SettingValue) => void;
  problem?: string | undefined;
  // The game's word on how the field shows now (T335).
  state?: FieldState | null | undefined;
}): ReactElement | null {
  const { def } = p;
  const { common, value } = shownOf(p);
  if (def.kind === 'bool')
    return <SwitchField {...common} checked={value === true} onChange={p.set} />;
  if (def.kind === 'enum')
    return (
      <ChoiceField
        {...common}
        value={String(value)}
        options={plain(def.options)}
        onChange={p.set}
      />
    );
  if (def.kind !== 'int' && def.kind !== 'number') return null;
  const override = p.doc?.overrides[def.key];
  const b = effectiveBounds(def, override);
  const step = def.kind === 'number' ? def.step : 1;
  return (
    <NumberField
      {...common}
      value={Number(value)}
      min={b.min}
      max={b.max}
      step={step}
      // The inactivity limit's 0 switches it off (O71).
      off={def.kind === 'int' ? def.off : undefined}
      check={(v) => settingIssue(def, v, override)?.message ?? null}
      onChange={p.set}
    />
  );
}

export function SeasonControls(p: {
  now: SeasonsCurrentView | null;
  season: SeasonName | 'inSeason';
  setSeason: (s: SeasonName | 'inSeason') => void;
  halving: boolean;
  setHalving: (h: boolean) => void;
}): ReactElement {
  const inSeason = p.now?.inSeason ?? null;
  const options = [
    ...(inSeason === null
      ? []
      : [{ value: 'inSeason' as const, label: `In Season (${SEASON_NAMES[inSeason.season]})` }]),
    ...SEASONS.map((s) => ({ value: s, label: SEASON_NAMES[s] })),
  ];
  return (
    <>
      <ChoiceField<SeasonName | 'inSeason'>
        label="Season"
        help={FORM_HELP.season}
        value={p.season}
        options={options}
        onChange={p.setSeason}
      />
      {p.now?.halvingToday == null ? null : (
        <SwitchField
          label="Halving round"
          help="Today is a halving day. With a hidden range the round plays as a normal season round."
          checked={p.halving}
          onChange={p.setHalving}
        />
      )}
    </>
  );
}

export interface SeasonChoice {
  readonly now: SeasonsCurrentView | null;
  readonly season: SeasonName | 'inSeason';
  readonly setSeason: (s: SeasonName | 'inSeason') => void;
  readonly halving: boolean;
  readonly setHalving: (h: boolean) => void;
}

// The round's season as the form stands: the one chosen by hand, or In Season's; null while
// the feed is not known.
export const formSeason = (c: SeasonChoice): SeasonName | null =>
  c.season === 'inSeason' ? (c.now?.inSeason?.season ?? null) : c.season;

// A season's own fields show only for that season: Heatwave's in summer (O63).
export const forSeason = (key: string, season: SeasonName | null): boolean =>
  !key.startsWith('summer.') || season === 'summer';

// The host settings that belong to one season (Heatwave's), for a form that lists them apart.
export const seasonalDefs = (defs: readonly SettingDef[]): SettingDef[] =>
  defs.filter((d) => d.hostChooses && !forSeason(d.key, null));

// Where the round form keeps its season choice among the last round's values, beside the
// halving switch's own key (T209).
export const SEASON_CHOICE = 'round.seasonChoice';

// The last round's values the next round's form starts from when the host's form did not
// make it (a Quick Test's first round, the page loaded again): its season and halving (T209)
// and its inactivity limit and warning (O75), the round view's own; a round made before O71
// has no warning and leaves the pair to the document's values.
export function keptOf(state: RoundStateView, game?: GameWeb): Record<string, SettingValue> {
  // A game's own settings of the round just ended, where it gives them (T338).
  const own = state.status === 'ended' && game?.kept !== undefined ? game.kept(state.game) : {};
  const inactivity =
    state.inactivityWarnMs > 0
      ? {
          'round.inactivityLimitS': state.inactivityLimitMs / 1_000,
          'round.inactivityWarnS': state.inactivityWarnMs / 1_000,
        }
      : {};
  return { [SEASON_CHOICE]: state.season, 'round.halving': state.halving, ...inactivity, ...own };
}

const choiceOf = (v: SettingValue | undefined): SeasonName | 'inSeason' | null =>
  v === 'inSeason' || SEASONS.includes(v as SeasonName) ? (v as SeasonName | 'inSeason') : null;

// The last round's choice where the form keeps one (the next round starts from it, In Season
// still selectable, T209); else In Season when the feed is usable, else Spring by hand;
// halving as last time, else off (`GET /seasons/current`).
export function useSeasonChoice(
  last?: Readonly<Record<string, SettingValue>> | null,
): SeasonChoice {
  const kept = choiceOf(last?.[SEASON_CHOICE]);
  const [season, setSeason] = useState<SeasonName | 'inSeason'>(kept ?? 'inSeason');
  const [halving, setHalving] = useState(last?.['round.halving'] === true);
  const [now, setNow] = useState<SeasonsCurrentView | null>(null);
  useEffect(() => {
    void api<SeasonsCurrentView>('/seasons/current').then((s) => {
      setNow(s);
      // In Season without a usable feed falls back to Spring, a kept choice or not.
      if (s.inSeason === null) setSeason((was) => (was === 'inSeason' ? 'spring' : was));
    });
  }, []);
  return { now, season, setSeason, halving, setHalving };
}

// The game's word on its fields (02e §3, T335), from the form's values: the host form's and
// the Quick Test's alike (T344); none for a game without it.
export const gameFieldState = (
  gameId: string,
  values: Readonly<Record<string, SettingValue>>,
  firstRound: boolean,
) => {
  const state = GAME_SCREENS[gameId]?.fieldState;
  return state === undefined ? undefined : (key: string) => state(key, values, firstRound);
};

// The host form's: a series' first round has no series yet.
export const fieldStateOf = (
  match: MatchDetailsView,
  values: Readonly<Record<string, SettingValue>>,
) => gameFieldState(match.gameId, values, match.series == null);

// The host's fields of the round's season: Heatwave's only for summer (O63).
// The settings document's bounds in force where there is one (the host menu); the Quick Test
// has the definitions' own (T208).
export function HostFields(p: {
  readonly fields: readonly SettingDef[];
  readonly doc?: MatchDetailsView['nextRoundDefaults'] & object;
  readonly season: SeasonName | null;
  readonly values: Readonly<Record<string, SettingValue>>;
  readonly set: (key: string, v: SettingValue) => void;
  // The server's sentence per field after a refused round setup (O74).
  readonly problems?: FormProblems['fields'];
  // A game's word on how one of its fields shows now (T335); none keeps every definition's.
  readonly fieldState?: ((key: string) => FieldState | null) | undefined;
}): ReactElement {
  return (
    <>
      {p.fields
        .filter((d) => forSeason(d.key, p.season))
        .map((d) => (
          <Field
            key={d.key}
            def={d}
            {...(p.doc === undefined ? {} : { doc: p.doc })}
            value={p.values[d.key] ?? d.default}
            problem={p.problems?.[d.key]}
            state={p.fieldState?.(d.key)}
            set={(v) => {
              p.set(d.key, v);
            }}
          />
        ))}
    </>
  );
}
