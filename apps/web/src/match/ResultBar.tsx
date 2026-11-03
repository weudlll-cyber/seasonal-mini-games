/**
 * @file   apps/web/src/match/ResultBar.tsx
 * @module web/match
 * @brief  The slim game bar over a round's result and the match summary (T145).
 *
 * Responsibility: one row like the round's bar (../round/FocusBar: at most 44 px on a desktop,
 *                 52 px on a phone), in place of the app header, which the result and the
 *                 summary hide as a running round does (`focus-mode`, ../round/focus.css): the
 *                 match's title, cut with an ellipsis, its game, the match code, the host's menu
 *                 where the viewer hosts, and "Play", the way back to the lobby, which the
 *                 hidden header held.
 * Depends on:     react, ../shell/router, ./match.css
 * Used by:        ./MatchPage, ./MatchSummary
 * Spec:           docs/spec/02-game-guess-the-number.md §9, §12
 */
import type { ReactElement, ReactNode } from 'react';

import { hrefOf } from '../shell/router.js';

export function ResultBar(p: {
  readonly title: string;
  readonly game: string;
  readonly code: string;
  // The host's menu, or null for everyone else.
  readonly host: ReactNode;
}): ReactElement {
  return (
    <header className="focus-bar result-bar" data-testid="result-bar">
      <strong className="result-bar-title">{p.title}</strong>
      <span className="smg-chip" data-testid="match-game">
        {p.game}
      </span>
      <span className="focus-fact result-bar-code">Code {p.code}</span>
      <span className="focus-actions">
        {p.host}
        <a className="smg-btn result-bar-link" href={hrefOf({ name: 'lobby' })}>
          Play
        </a>
      </span>
    </header>
  );
}
