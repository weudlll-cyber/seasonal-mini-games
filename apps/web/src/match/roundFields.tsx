/**
 * @file   apps/web/src/match/roundFields.tsx
 * @module web/match
 * @brief  The fields of the host's round form: one per setting, and the season controls.
 *
 * Responsibility: a setting definition becomes a switch, a choice or a number field with its
 *                 label and one-line help and the bounds in force (the document's narrowed
 *                 bounds, never wider than the catalogue, 08 §1); the Quick Test uses the same
 *                 fields. The season choice offers In Season only while it is usable, and the
 *                 halving switch only on a halving day (03 §3, §4). `HostFields` shows the
 *                 host's fields of the round's season (`formSeason`): Heatwave's step and
 *                 interval only for summer (`forSeason`, O63).
 * Depends on:     react, @smg/contracts, @smg/game-sdk (bounds), ../components/fields,
 *                 ./formHelp, ../season/season, ../shell/http
 * Used by:        ./HostMenu, ../shell/QuickTest
 * Spec:           docs/spec/08-admin-settings.md §1, §3; docs/spec/03-seasonal-specials.md §3, §4
 */
import type { MatchDetailsView, SeasonName, SeasonsCurrentView } from '@smg/contracts';
import { effectiveBounds, type SettingDef, type SettingValue } from '@smg/game-sdk';
import { useEffect, useState, type ReactElement } from 'react';

import { ChoiceField, NumberField, plain, SwitchField } from '../components/fields.js';
import { SEASON_NAMES, SEASONS } from '../season/season.js';
import { FORM_HELP } from './formHelp.js';
import { api } from '../shell/http.js';

type Doc = NonNullable<MatchDetailsView['nextRoundDefaults']>;

// One setting as a field, its label and help from the definition (the same words wherever it is
// shown); the bounds are the document's when there is one, else the definition's.
export function Field(p: {
  def: SettingDef;
  doc?: Doc;
  value: SettingValue;
  set: (v: SettingValue) => void;
}): ReactElement | null {
  const { def } = p;
  const common = { label: def.label, help: def.help };
  if (def.kind === 'bool')
    return <SwitchField {...common} checked={p.value === true} onChange={p.set} />;
  if (def.kind === 'enum')
    return (
      <ChoiceField
        {...common}
        value={String(p.value)}
        options={plain(def.options)}
        onChange={p.set}
      />
    );
  if (def.kind !== 'int' && def.kind !== 'number') return null;
  const b = effectiveBounds(def, p.doc?.overrides[def.key]);
  const step = def.kind === 'number' ? def.step : 1;
  return (
    <NumberField
      {...common}
      value={Number(p.value)}
      min={b.min}
      max={b.max}
      step={step}
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

// The host's fields of the round's season: Heatwave's only for summer (O63).
// The settings document's bounds in force where there is one (the host menu); the Quick Test
// has the definitions' own (T208).
export function HostFields(p: {
  readonly fields: readonly SettingDef[];
  readonly doc?: MatchDetailsView['nextRoundDefaults'] & object;
  readonly season: SeasonName | null;
  readonly values: Readonly<Record<string, SettingValue>>;
  readonly set: (key: string, v: SettingValue) => void;
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
            set={(v) => {
              p.set(d.key, v);
            }}
          />
        ))}
    </>
  );
}
