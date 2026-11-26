/**
 * @file   apps/web/src/match/JoinLeave.tsx
 * @module web/match
 * @brief  Joining or leaving a match: one button, and a refusal in plain words.
 *
 * Responsibility: "Join match" for a signed-in viewer who may join and is not in the match,
 *                 "Leave match" for a player in it; nothing for the host or once the match is
 *                 closed or aborted (02 §2). The server decides; the page reloads the match.
 * Depends on:     react, @smg/contracts, ../round/roundText, ../shell/http, ../shell/session
 * Used by:        ./MatchPage
 * Spec:           docs/spec/02-game-guess-the-number.md §2
 */
import type { MatchDetailsView } from '@smg/contracts';
import { useState, type ReactElement } from 'react';

import { codeText } from '../round/roundText.js';
import { api, ApiError } from '../shell/http.js';
import { useSession } from '../shell/session.js';

export function JoinLeave({
  match,
  reload,
}: {
  readonly match: MatchDetailsView;
  readonly reload: () => void;
}): ReactElement | null {
  const { can } = useSession();
  const [problem, setProblem] = useState<string | null>(null);
  if (
    match.youHost ||
    !can('match.join') ||
    match.status === 'closed' ||
    match.status === 'aborted'
  )
    return null;
  const go = async (what: 'join' | 'leave'): Promise<void> => {
    try {
      await api(`/matches/${match.code}/${what}`, { method: 'POST', body: {} });
      setProblem(null);
    } catch (error) {
      setProblem(error instanceof ApiError ? codeText(error.code) : 'That did not work.');
    }
    reload();
  };
  return (
    <div className="smg-row">
      {match.youPlayer ? (
        <button type="button" className="sk-btn" onClick={() => void go('leave')}>
          Leave match
        </button>
      ) : (
        <button
          type="button"
          className="sk-btn sk-btn--primary"
          onClick={() => void go('join')}
          data-testid="join"
        >
          Join match
        </button>
      )}
      {problem === null ? null : (
        <p role="alert" className="round-refusal">
          {problem}
        </p>
      )}
    </div>
  );
}
