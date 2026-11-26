/**
 * @file   apps/web/src/match/RunningControls.tsx
 * @module web/match
 * @brief  The host's controls while a round runs: Start (a created round), End and Abort.
 *
 * Responsibility: Start round for a round still only created, End round, and Abort round with
 *                 its reason (02 §4, §9, §11), each sent as the round's intent; a refusal in plain
 *                 words; after an action the caller learns whether it worked (it closes the
 *                 menu then). Moved from ./HostMenu unchanged (O125's room there).
 * Depends on:     react, ../components/fields, ../live/socket, ../round/roundText
 * Used by:        ./HostMenu
 * Spec:           docs/spec/02-game-guess-the-number.md §4, §9, §11
 */
import { useState, type ReactElement } from 'react';

import { ActionButton, Problem } from '../components/fields.js';
import { intent } from '../live/socket.js';
import { codeText } from '../round/roundText.js';

export function RunningControls({
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
          className="sk-input"
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
