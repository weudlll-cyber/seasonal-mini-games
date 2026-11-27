/**
 * @file   apps/web/src/match/ResultBar.tsx
 * @module web/match
 * @brief  The slim game bar over a round's result and the match summary (T145).
 *
 * Responsibility: one row like the round's bar (../round/FocusBar: at most 44 px on a desktop,
 *                 52 px on a phone; its rules are this file's, ./match.css), in place of the app header, which the result and the
 *                 summary hide as a running round does (`focus-mode`, ../round/focus.css): the
 *                 match's title, cut with an ellipsis, its game, the match code, the host's menu
 *                 where the viewer hosts, and "Play", the way back to the lobby, which the
 *                 hidden header held; before it "Back to the call" while the website's shared
 *                 call is live (the kit's BackToCall, ./sharedCall). A phone leaves the title out and shows the code without
 *                 its label, so the game's name and the code are never cut (T150); a game's
 *                 name too long for one line there breaks between its words onto a second
 *                 line inside its chip, the bar staying one row (./match.css, T372).
 * Depends on:     react, @seasonal/kit/react (BackToCall), ../shell/router, ./sharedCall,
 *                 ./match.css
 * Used by:        ./MatchPage, ./MatchSummary
 * Spec:           docs/spec/02-game-guess-the-number.md §9, §12
 */
import { BackToCall } from '@seasonal/kit/react';
import { useContext, type ReactElement, type ReactNode } from 'react';

import { hrefOf } from '../shell/router.js';
import { SharedCallContext } from './sharedCall.js';

export function ResultBar(p: {
  readonly title: string;
  readonly game: string;
  readonly code: string;
  // The host's menu, or null for everyone else.
  readonly host: ReactNode;
}): ReactElement {
  const call = useContext(SharedCallContext);
  return (
    <header className="result-bar" data-testid="result-bar">
      <strong className="result-bar-title">{p.title}</strong>
      <span className="sk-chip result-bar-game" title={p.game} data-testid="match-game">
        {p.game}
      </span>
      <span className="result-bar-code" data-testid="result-code">
        <span className="result-bar-label">Code </span>
        {p.code}
      </span>
      <span className="result-bar-actions">
        {p.host}
        <BackToCall callId={call} className="sk-btn result-bar-link" />
        <a className="sk-btn result-bar-link" href={hrefOf({ name: 'lobby' })}>
          Play
        </a>
      </span>
    </header>
  );
}
