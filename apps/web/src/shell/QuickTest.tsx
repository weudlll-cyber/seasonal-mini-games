/**
 * @file   apps/web/src/shell/QuickTest.tsx
 * @module web/shell
 * @brief  The development Quick Test: one round against bots, with a seed field.
 *
 * Responsibility: choose the seed text (the same text gives the same secret and season),
 *                 mode, number of bots, cooldown, range, visibility, season (or the seed's)
 *                 and the fast test profile; start it (`POST /dev/quicktest`) and go to the
 *                 match, where the round counts down at once. Development builds only: the
 *                 shell loads this module on demand and a production build leaves it out.
 * Depends on:     react, @smg/contracts, ./http, ./router, ../season/season, ../components/fields
 * Used by:        ./AppShell (lazy, development only)
 * Spec:           docs/spec/11-roadmap.md (phase 1 Quick Test); docs/spec/09-testing-strategy.md §1, §4
 */
import type { QuickTestStartedView, SeasonName } from '@smg/contracts';
import { useState, type ReactElement, type SyntheticEvent } from 'react';

import {
  ChoiceField,
  NumberField,
  plain,
  Problem,
  SwitchField,
  TextField,
} from '../components/fields.js';
import { SEASON_NAMES, SEASONS } from '../season/season.js';
import { api } from './http.js';
import { navigate } from './router.js';

interface Choice {
  readonly seedText: string;
  readonly mode: 'shared' | 'individual';
  readonly bots: number;
  readonly cooldownS: number;
  readonly rangeHigh: number;
  readonly visibility: 'own' | 'numbers' | 'full';
  readonly season: SeasonName | '';
  readonly fast: boolean;
}

const START: Choice = {
  seedText: '',
  mode: 'shared',
  bots: 3,
  cooldownS: 5,
  rangeHigh: 100,
  visibility: 'full',
  season: '',
  fast: true,
};
const SEASON_CHOICES = [
  { value: '' as const, label: 'from the seed' },
  ...SEASONS.map((s) => ({ value: s, label: SEASON_NAMES[s] })),
];

type Set = (change: Partial<Choice>) => void;

// What the round is: seed, mode, season, visibility.
function RoundFields({ c, set }: { readonly c: Choice; readonly set: Set }): ReactElement {
  return (
    <>
      <TextField
        label="Seed"
        value={c.seedText}
        maxLength={64}
        placeholder="any text, e.g. meadow"
        testId="seed"
        onChange={(seedText) => {
          set({ seedText });
        }}
      />
      <ChoiceField
        label="Secret"
        value={c.mode}
        options={plain(['shared', 'individual'] as const)}
        onChange={(mode) => {
          set({ mode });
        }}
      />
      <ChoiceField<SeasonName | ''>
        label="Season"
        value={c.season}
        options={SEASON_CHOICES}
        onChange={(season) => {
          set({ season });
        }}
      />
      <ChoiceField
        label="What others see"
        value={c.visibility}
        options={plain(['own', 'numbers', 'full'] as const)}
        onChange={(visibility) => {
          set({ visibility });
        }}
      />
    </>
  );
}

// How it plays: bots, cooldown, range, fast specials.
function PaceFields({ c, set }: { readonly c: Choice; readonly set: Set }): ReactElement {
  return (
    <>
      <NumberField
        label="Bots"
        value={c.bots}
        min={1}
        max={50}
        onChange={(bots) => {
          set({ bots });
        }}
      />
      <NumberField
        label="Cooldown (s)"
        value={c.cooldownS}
        min={3}
        max={60}
        onChange={(cooldownS) => {
          set({ cooldownS });
        }}
      />
      <NumberField
        label="Highest number"
        value={c.rangeHigh}
        min={10}
        max={1_000_000}
        onChange={(rangeHigh) => {
          set({ rangeHigh });
        }}
      />
      <SwitchField
        label="Fast specials (every few seconds)"
        checked={c.fast}
        onChange={(fast) => {
          set({ fast });
        }}
      />
    </>
  );
}

export function QuickTest(): ReactElement {
  const [c, setC] = useState<Choice>(START);
  const [problem, setProblem] = useState<string | null>(null);
  const set: Set = (change) => {
    setC((old) => ({ ...old, ...change }));
  };
  const start = (e: SyntheticEvent): void => {
    e.preventDefault();
    const { seedText, season, ...rest } = c;
    const body = {
      ...rest,
      ...(seedText.trim() === '' ? {} : { seedText }),
      ...(season === '' ? {} : { season }),
    };
    api<QuickTestStartedView>('/dev/quicktest', { method: 'POST', body })
      .then((started) => {
        navigate({ name: 'match', code: started.matchCode });
      })
      .catch(() => {
        setProblem('The Quick Test could not start. Are you signed in?');
      });
  };
  return (
    <form className="smg-panel smg-stack" onSubmit={start} data-testid="quick-test">
      <h1>Quick Test</h1>
      <p className="smg-muted">
        One round against bots. The same seed gives the same secret and the same season.
      </p>
      <div className="host-form">
        <RoundFields c={c} set={set} />
        <PaceFields c={c} set={set} />
      </div>
      <Problem text={problem} />
      <button type="submit" className="smg-btn smg-btn--primary" data-testid="start-quick-test">
        Start Quick Test
      </button>
    </form>
  );
}
