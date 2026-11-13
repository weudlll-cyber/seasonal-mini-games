/**
 * @file   apps/web/src/match/HostMenu.tsx
 * @module web/match
 * @brief  The host menu: one button that opens the next round's settings, Start, End and Abort.
 *
 * Responsibility: the host's controls (`HostConsole`) sit behind one button of at least 44 px
 *                 (O16): in the match head between rounds, a menu that opens on its own before
 *                 the first round, closes with Escape (focus goes back to the button) and after
 *                 a successful action; while a round runs, the focus mode's Host panel from the
 *                 round bar (../round/FocusShell, O46), which closes the same way. Inside: while a round
 *                 runs, Start (a created round), End and Abort with a reason; otherwise a form
 *                 with every setting the host chooses per round (in a match without teams not
 *                 the season teams, O34; Heatwave's step and interval only for a summer round,
 *                 O63), prefilled with the
 *                 last round's choices or the document's values and limited to the bounds in
 *                 force (08 §3; the server checks again), the season (In Season when it is
 *                 usable, or one by hand), the halving round only on a halving day; then
 *                 Start round, End round and Abort round with a reason (02 §4, §9, §11). Last,
 *                 always: End match with its confirm sentence (./EndMatch, O27). Refusals in
 *                 plain words; a refused setting's sentence under its field (O74). The host plays the round like every player; the menu holds no
 *                 secret.
 * Depends on:     react, @smg/contracts, @smg/game-sdk (types), ../components/*, ../shell/http,
 *                 ../live/socket, ../round/roundText, ./EndMatch, ./roundFields, ./roundRequest
 * Used by:        ./MatchPage
 * Spec:           docs/spec/02-game-guess-the-number.md §3, §4, §9; docs/spec/08-admin-settings.md §3
 */
import type { MatchDetailsView } from '@smg/contracts';
import type { SettingValue } from '@smg/game-sdk';
import { useState, type ReactElement, type SyntheticEvent } from 'react';
import { useDisclosure } from '@smg/ui';

import { ActionButton, Problem } from '../components/fields.js';
import { intent } from '../live/socket.js';
import { codeText } from '../round/roundText.js';
import { api } from '../shell/http.js';
import { EndMatch } from './EndMatch.js';
import { roundRequest } from './roundRequest.js';
import {
  fieldStateOf,
  formSeason,
  forSeason,
  HostFields,
  NO_PROBLEMS,
  SEASON_CHOICE,
  SeasonControls,
  setupProblems,
  useSeasonChoice,
  type FormProblems,
} from './roundFields.js';

// Season and halving have their own controls below the generic fields.
const OWN_CONTROLS = new Set(['round.seasonSource', 'round.halving']);

type Doc = NonNullable<MatchDetailsView['nextRoundDefaults']>;
export type Values = Record<string, SettingValue>;

interface RoundFormProps {
  readonly match: MatchDetailsView;
  readonly doc: Doc;
  // The settings of the round created last, prefilled for the next one (02 §9).
  readonly last: Readonly<Values> | null;
  readonly done: (used: Values) => void;
}

// The settings the host chooses per round; in a match without teams not the teams (O34).
const shown = (match: MatchDetailsView, key: string) =>
  !OWN_CONTROLS.has(key) && (match.teamMatch || key !== 'round.teamsOn');

function RoundForm({ match, doc, last, done }: RoundFormProps): ReactElement {
  const fields = doc.defs.filter((d) => d.hostChooses && shown(match, d.key));
  const [values, setValues] = useState<Values>(() =>
    Object.fromEntries(fields.map((d) => [d.key, last?.[d.key] ?? doc.values[d.key] ?? d.default])),
  );
  const choice = useSeasonChoice(last);
  const { season, halving } = choice;
  const [problems, setProblems] = useState<FormProblems>(NO_PROBLEMS);
  const create = (startNow: boolean): void => {
    const keys = doc.defs.map((d) => d.key);
    const { path, method, body } = roundRequest(match, { keys, values, halving, season }, startNow);
    api(path, { method, body })
      .then(() => {
        // The season choice and halving are kept with the settings for the next round (T209).
        done({ ...values, 'round.halving': halving, [SEASON_CHOICE]: season });
      })
      .catch((error: unknown) => {
        // A refused setting's sentence goes under its field while the form shows it (O74).
        const keys = fields.filter((d) => forSeason(d.key, formSeason(choice))).map((d) => d.key);
        setProblems(setupProblems(error, keys));
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
        <HostFields
          fields={fields}
          doc={doc}
          season={formSeason(choice)}
          values={values}
          problems={problems.fields}
          fieldState={fieldStateOf(match, values)}
          set={(key, v) => {
            setValues((was) => ({ ...was, [key]: v }));
            setProblems(NO_PROBLEMS);
          }}
        />
      </div>
      <Problem text={problems.form} />
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
  done,
}: {
  roundId: string | undefined;
  created: boolean;
  // After an action: whether it worked.
  done: (ok: boolean) => void;
}): ReactElement {
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const run = (t: string, data: object): void => {
    void intent(t, { roundId, ...data }).then((answer) => {
      setProblem(answer.ok ? null : codeText(answer.code));
      done(answer.ok);
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

export interface HostMenuProps {
  readonly match: MatchDetailsView;
  readonly roundStatus: string | null;
  readonly reload: () => void;
  // The settings of the round created last; kept by the match page across its layouts.
  readonly last: Values | null;
  readonly setLast: (used: Values) => void;
}

function MenuBody({ p, close }: { readonly p: HostMenuProps; readonly close: () => void }) {
  const { match, roundStatus, reload } = p;
  const doc = match.nextRoundDefaults;
  if (doc === null) return null;
  const running =
    roundStatus === 'created' || roundStatus === 'countdown' || roundStatus === 'open';
  const after = (ok: boolean): void => {
    if (ok) close();
    reload();
  };
  // Last in the menu, whatever the round does: End match (O27).
  const endMatch = (
    <EndMatch
      code={match.code}
      done={() => {
        after(true);
      }}
    />
  );
  if (running) {
    return (
      <>
        <RunningControls
          roundId={match.round?.id}
          created={roundStatus === 'created'}
          done={after}
        />
        {endMatch}
      </>
    );
  }
  return (
    <>
      <p>
        {roundStatus === null
          ? 'Set up the first round.'
          : 'Next round — the last settings are filled in.'}
      </p>
      <RoundForm
        match={match}
        doc={doc}
        last={p.last}
        done={(used) => {
          p.setLast(used);
          after(true);
        }}
      />
      {endMatch}
    </>
  );
}

// Whether the viewer hosts this match and so gets the host's controls.
export const hosts = (match: MatchDetailsView): boolean =>
  match.youHost && match.nextRoundDefaults !== null;

// The host's controls themselves: in the menu's panel between rounds, in the focus mode's
// Host panel while a round runs (../round/FocusShell, O46).
export function HostConsole(
  p: HostMenuProps & {
    readonly close: () => void;
    readonly id?: string;
    readonly className?: string;
  },
): ReactElement {
  return (
    <section
      id={p.id}
      className={`smg-stack ${p.className ?? ''}`}
      aria-label="Host"
      data-testid="host-console"
    >
      <MenuBody p={p} close={p.close} />
    </section>
  );
}

export function HostMenu(p: HostMenuProps): ReactElement | null {
  // Open by itself before the first round, so the host sees where to start.
  const menu = useDisclosure(p.match.round === null);
  if (!hosts(p.match)) return null;
  return (
    <div className="host-menu" onKeyDown={menu.onKeyDown}>
      <button
        ref={menu.button}
        type="button"
        className="smg-btn host-menu-button"
        aria-expanded={menu.open}
        aria-controls={menu.panelId}
        data-testid="host-menu"
        onClick={menu.toggle}
      >
        Host
      </button>
      {menu.open ? (
        <HostConsole {...p} close={menu.close} id={menu.panelId} className="host-menu-panel" />
      ) : null}
    </div>
  );
}
