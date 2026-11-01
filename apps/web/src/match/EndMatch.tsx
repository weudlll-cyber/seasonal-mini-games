/**
 * @file   apps/web/src/match/EndMatch.tsx
 * @module web/match
 * @brief  The host menu's "End match", asked once more with its confirm sentence (O27).
 *
 * Responsibility: a button that first shows the confirm sentence "End this match for
 *                 everyone? A running round is aborted." with End match and Cancel (the confirm
 *                 pattern of the chat's moderator actions: the sentence, then the action);
 *                 confirmed, it closes the match (`POST /matches/:code/close`) and every
 *                 viewer then sees the match summary. Refusals in plain words.
 * Depends on:     react, ../components/fields, ../shell/http, ../round/roundText
 * Used by:        ./HostMenu
 * Spec:           docs/spec/02-game-guess-the-number.md §2; docs/spec/06-data-model-api-realtime.md §3.1
 */
import { useState, type ReactElement } from 'react';

import { ActionButton, Problem } from '../components/fields.js';
import { codeText } from '../round/roundText.js';
import { api, ApiError } from '../shell/http.js';

const END_MATCH_CONFIRM = 'End this match for everyone? A running round is aborted.';

export function EndMatch({
  code,
  done,
}: {
  readonly code: string;
  // After the match was closed.
  readonly done: () => void;
}): ReactElement {
  const [asking, setAsking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const end = (): void => {
    api(`/matches/${code}/close`, { method: 'POST', body: {} })
      .then(() => {
        setProblem(null);
        done();
      })
      .catch((error: unknown) => {
        setProblem(error instanceof ApiError ? codeText(error.code) : 'That did not work.');
      });
  };
  if (!asking) {
    return (
      <div className="smg-row host-end">
        <ActionButton
          label="End match"
          testId="end-match"
          onClick={() => {
            setAsking(true);
          }}
        />
      </div>
    );
  }
  return (
    <div className="smg-stack host-end" role="group" aria-label="End match">
      <p data-testid="end-match-confirm">{END_MATCH_CONFIRM}</p>
      <div className="smg-row">
        <ActionButton label="End match" kind="danger" testId="end-match-yes" onClick={end} />
        <ActionButton
          label="Cancel"
          onClick={() => {
            setAsking(false);
          }}
        />
      </div>
      <Problem text={problem} />
    </div>
  );
}
