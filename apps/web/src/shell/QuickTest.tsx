/**
 * @file   apps/web/src/shell/QuickTest.tsx
 * @module web/shell
 * @brief  The development Quick Test: one round against bots, with a seed field.
 *
 * Responsibility: choose the game (O41, with a help line), whether to start from the lobby
 *                 (on by default, O24), the seed text (the same text gives the same secret and
 *                 season), the secret mode, the season (or the seed's), what others see, the
 *                 bots, the cooldown, the countdown with the round's intro screen (O36), the
 *                 chosen game's own host settings and only those (Guess The Number: lowest and
 *                 highest number, whether the range is shown, the closeness comments, O21),
 *                 the fast test profile and whether it is a team match (O34); start it
 *                 (`POST /dev/quicktest`, the game's settings by key, T121) and go to the
 *                 match, where the player hosts it: in the waiting area, where the bots join
 *                 and the player starts the round from the host menu, or with the round
 *                 counting down at once. Every field has
 *                 its one-line help under it: the settings with the words and bounds of their
 *                 definitions through the host form's own `Field`, the rest from FORM_HELP, so
 *                 both forms say the same. Development builds only: the shell loads this module
 *                 on demand and a production build leaves it out.
 * Depends on:     react, @smg/contracts, @smg-game/registry/web, ./quickTestSettings,
 *                 ./http, ./router, ../season/season, ../components/fields, ../lobby/games,
 *                 ../match/* (and its form grid, ../match/match.css)
 * Used by:        ./AppShell (lazy, development only)
 * Spec:           docs/spec/11-roadmap.md (phase 1 Quick Test); docs/spec/09-testing-strategy.md §1, §4
 */
import { GAME_SCREENS } from '@smg-game/registry/web';
import type { GameInfoView, QuickTestStartedView, SeasonName } from '@smg/contracts';
import type { SettingValue } from '@smg/game-sdk';
import { useState, type ReactElement, type SyntheticEvent } from 'react';

import { ChoiceField, NumberField, Problem, SwitchField, TextField } from '../components/fields.js';
import { useGames } from '../lobby/games.js';
import { FORM_HELP } from '../match/formHelp.js';
import { SEASON_NAMES, SEASONS } from '../season/season.js';
import { api } from './http.js';
import {
  bodyOf,
  defsOf,
  gameKeysOf,
  KEYS,
  SettingFields,
  START,
  type Extra,
  type Values,
} from './quickTestSettings.js';
import { navigate } from './router.js';
import '../match/match.css';

const SEASON_CHOICES = [
  { value: '' as const, label: 'from the seed' },
  ...SEASONS.map((s) => ({ value: s, label: SEASON_NAMES[s] })),
];

// The fields that are not settings, by name, to place between the settings.
function extraFields(p: {
  readonly extra: Extra;
  readonly set: (e: Partial<Extra>) => void;
  readonly games: readonly GameInfoView[];
}) {
  const { extra, set } = p;
  return {
    game: (
      <ChoiceField
        label="Game"
        help={FORM_HELP.game}
        value={extra.gameId}
        options={p.games.map((g) => ({ value: g.id, label: g.name }))}
        testId="quick-game"
        onChange={(gameId) => {
          set({ gameId });
        }}
      />
    ),
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
    ...switchFields(p),
  };
}

// The switches that are not settings: fast specials, the start from the lobby, team match.
function switchFields(p: { readonly extra: Extra; readonly set: (e: Partial<Extra>) => void }) {
  const { extra, set } = p;
  return {
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
    lobby: (
      <SwitchField
        label="Start from the lobby"
        help={FORM_HELP.lobby}
        checked={extra.lobby}
        testId="quick-lobby"
        onChange={(lobby) => {
          set({ lobby });
        }}
      />
    ),
    teamMatch: (
      <SwitchField
        label="Team match"
        help={FORM_HELP.teamMatch}
        checked={extra.teamMatch}
        testId="quick-team-match"
        onChange={(teamMatch) => {
          set({ teamMatch });
        }}
      />
    ),
  };
}

// The form's fields in order: the game first, then the settings every game has, then the
// chosen game's own (O41).
function QuickTestFields(p: {
  readonly extra: Extra;
  readonly values: Values;
  readonly set: (key: string, v: SettingValue) => void;
  readonly more: ReturnType<typeof extraFields>;
}): ReactElement {
  const { extra, values, set, more } = p;
  const defs = defsOf(extra.gameId);
  const fields = (keys: readonly string[]) => (
    <SettingFields keys={keys} defs={defs} values={values} set={set} />
  );
  return (
    <div className="host-form">
      {more.game}
      {more.lobby}
      {more.teamMatch}
      {more.seed}
      {fields(KEYS.slice(0, 1))}
      {more.season}
      {fields(KEYS.slice(1, 2))}
      {more.bots}
      {fields([...KEYS.slice(2), ...gameKeysOf(extra.gameId)])}
      {more.fast}
    </div>
  );
}

export function QuickTest(): ReactElement {
  const games = useGames();
  const [values, setValues] = useState<Values>(START);
  const [extra, setExtra] = useState<Extra>({
    // The registry's first game until the player chooses.
    gameId: Object.keys(GAME_SCREENS)[0] ?? '',
    seedText: '',
    season: '',
    bots: 3,
    fast: true,
    lobby: true,
    teamMatch: true,
  });
  const [problem, setProblem] = useState<string | null>(null);
  const set = (key: string, v: SettingValue): void => {
    setValues((old) => ({ ...old, [key]: v }));
  };
  const more = extraFields({
    extra,
    games,
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
          'The Quick Test could not start. Are you signed in, and do the game’s settings fit together?',
        );
      });
  };
  return (
    <form className="smg-panel smg-stack" onSubmit={start} data-testid="quick-test">
      <h1>Quick Test</h1>
      <p className="smg-muted">
        One round against bots, which you host and play: from the lobby, where the bots join and you
        start the round, or at once. The same seed gives the same secret and the same season.
      </p>
      <QuickTestFields extra={extra} values={values} set={set} more={more} />
      <Problem text={problem} />
      <button type="submit" className="smg-btn smg-btn--primary" data-testid="start-quick-test">
        Start Quick Test
      </button>
    </form>
  );
}
