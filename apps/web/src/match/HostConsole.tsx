/**
 * @file   apps/web/src/match/HostConsole.tsx
 * @module web/match
 * @brief  The host's controls: the next round's settings, Start, End and Abort.
 *
 * Responsibility: a form with every setting the host chooses per round, prefilled with the
 *                 last round's choices or the document's values and limited to the bounds in
 *                 force (08 §3; the server checks again), the season (In Season when it is
 *                 usable, or one by hand), the halving round only on a halving day; then
 *                 Start round, End round and Abort round with a reason (02 §4, §9, §11).
 *                 Refusals in plain words.
 * Depends on:     react, @smg/contracts, @smg/game-sdk (types), ../shell/http, ../live/socket,
 *                 ../round/roundText, ./roundFields
 * Used by:        ./MatchPage
 * Spec:           docs/spec/02-game-guess-the-number.md §3, §4, §9; docs/spec/08-admin-settings.md §3
 */
import type { MatchDetailsView } from '@smg/contracts';
import type { SettingValue } from '@smg/game-sdk';
import { useState, type ReactElement, type SyntheticEvent } from 'react';

import { ActionButton, Problem } from '../components/fields.js';
import { intent } from '../live/socket.js';
import { codeText } from '../round/roundText.js';
import { api, ApiError } from '../shell/http.js';
import { Field, SeasonControls, useSeasonChoice } from './roundFields.js';

// Season and halving have their own controls below the generic fields.
const OWN_CONTROLS = new Set(['round.seasonSource', 'round.halving']);

type Doc = NonNullable<MatchDetailsView['nextRoundDefaults']>;
type Values = Record<string, SettingValue>;

interface RoundFormProps {
  readonly match: MatchDetailsView;
  readonly doc: Doc;
  // The settings of the round created last, prefilled for the next one (02 §9).
  readonly last: Readonly<Values> | null;
  readonly done: (used: Values) => void;
}

function RoundForm({ match, doc, last, done }: RoundFormProps): ReactElement {
  const fields = doc.defs.filter((d) => d.hostChooses && !OWN_CONTROLS.has(d.key));
  const [values, setValues] = useState<Values>(() =>
    Object.fromEntries(fields.map((d) => [d.key, last?.[d.key] ?? doc.values[d.key] ?? d.default])),
  );
  const choice = useSeasonChoice();
  const { season, halving } = choice;
  const [problem, setProblem] = useState<string | null>(null);
  const create = (startNow: boolean): void => {
    const body = {
      settings: { ...values, 'round.halving': halving },
      startNow,
      ...(season === 'inSeason' ? {} : { season }),
    };
    api(`/matches/${match.code}/rounds`, { method: 'POST', body })
      .then(() => {
        setProblem(null);
        done(values);
      })
      .catch((error: unknown) => {
        setProblem(
          error instanceof ApiError ? codeText(error.code) : 'The round could not be created.',
        );
      });
  };
  const submit = (e: SyntheticEvent): void => {
    e.preventDefault();
    create(true);
  };
  return (
    <form className="smg-stack" onSubmit={submit} data-testid="round-form">
      <div className="host-form">
        <SeasonControls {...choice} />
        {fields.map((d) => (
          <Field
            key={d.key}
            def={d}
            doc={doc}
            value={values[d.key] ?? d.default}
            set={(v) => {
              setValues((old) => ({ ...old, [d.key]: v }));
            }}
          />
        ))}
      </div>
      <Problem text={problem} />
      <div className="smg-row">
        <button type="submit" className="smg-btn smg-btn--primary" data-testid="create-start">
          Create and start round
        </button>
        <ActionButton
          label="Create round"
          onClick={() => {
            create(false);
          }}
        />
      </div>
    </form>
  );
}

function RunningControls({
  roundId,
  created,
  reload,
}: {
  roundId: string | undefined;
  created: boolean;
  reload: () => void;
}): ReactElement {
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const run = (t: string, data: object): void => {
    void intent(t, { roundId, ...data }).then((answer) => {
      setProblem(answer.ok ? null : codeText(answer.code));
      reload();
    });
  };
  return (
    <>
      <div className="smg-row">
        {created ? (
          <ActionButton
            label="Start round"
            kind="primary"
            testId="start-round"
            onClick={() => {
              run('round.start', {});
            }}
          />
        ) : null}
        <ActionButton
          label="End round"
          testId="end-round"
          onClick={() => {
            run('round.end', {});
          }}
        />
        <input
          className="smg-input"
          placeholder="Reason to abort"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
          }}
          aria-label="Reason to abort"
        />
        <ActionButton
          label="Abort round"
          kind="danger"
          disabled={reason.trim() === ''}
          onClick={() => {
            run('round.abort', { reason });
          }}
        />
      </div>
      <Problem text={problem} />
    </>
  );
}

export function HostConsole({
  match,
  roundStatus,
  reload,
}: {
  readonly match: MatchDetailsView;
  readonly roundStatus: string | null;
  readonly reload: () => void;
}): ReactElement | null {
  const [last, setLast] = useState<Values | null>(null);
  if (!match.youHost || match.nextRoundDefaults === null) return null;
  const running =
    roundStatus === 'created' || roundStatus === 'countdown' || roundStatus === 'open';
  return (
    <section
      className="smg-panel smg-stack"
      aria-labelledby="host-title"
      data-testid="host-console"
    >
      <h2 id="host-title">Host</h2>
      {running ? (
        <RunningControls
          roundId={match.round?.id}
          created={roundStatus === 'created'}
          reload={reload}
        />
      ) : (
        <>
          <p>
            {roundStatus === null
              ? 'Set up the first round.'
              : 'Next round — the last settings are filled in.'}
          </p>
          <RoundForm
            match={match}
            doc={match.nextRoundDefaults}
            last={last}
            done={(used) => {
              setLast(used);
              reload();
            }}
          />
        </>
      )}
    </section>
  );
}
