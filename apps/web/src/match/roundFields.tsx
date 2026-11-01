/**
 * @file   apps/web/src/match/roundFields.tsx
 * @module web/match
 * @brief  The fields of the host's round form: one per setting, and the season controls.
 *
 * Responsibility: a setting definition becomes a switch, a choice or a number field with its
 *                 label and one-line help and the bounds in force (the document's narrowed
 *                 bounds, never wider than the catalogue, 08 §1); the Quick Test uses the same
 *                 fields. The season choice offers In Season only while it is usable, and the
 *                 halving switch only on a halving day (03 §3, §4).
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

// In Season when the feed is usable, else Spring by hand; halving off (`GET /seasons/current`).
export function useSeasonChoice(): SeasonChoice {
  const [season, setSeason] = useState<SeasonName | 'inSeason'>('inSeason');
  const [halving, setHalving] = useState(false);
  const [now, setNow] = useState<SeasonsCurrentView | null>(null);
  useEffect(() => {
    void api<SeasonsCurrentView>('/seasons/current').then((s) => {
      setNow(s);
      if (s.inSeason === null) setSeason('spring');
    });
  }, []);
  return { now, season, setSeason, halving, setHalving };
}
