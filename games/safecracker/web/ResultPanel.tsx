/**
 * @file   games/safecracker/web/ResultPanel.tsx
 * @module games/safecracker/web
 * @brief  The game's part of the result page: the code or every player's, and the codes tried.
 *
 * Responsibility: the reveal (`part`, T150): "Code: 1123" with its space (4 digits, 0–9) in
 *                 shared mode, or that everyone had their own; the history: each player's
 *                 codes with their right and wrong places, in individual mode with the
 *                 player's own code, the viewer's line first (02b §8), "did not guess"
 *                 without one. The platform shows
 *                 placings, points, margin or the closest miss (`text.runnerUp`), teams and the
 *                 fairness proof around it.
 * Depends on:     react, @smg/game-sdk (props), @smg-game/safecracker (types), ./text
 * Used by:        ./index
 * Spec:           docs/spec/02b-game-safecracker.md §8
 */
import type { ResultView } from '@smg-game/safecracker';
import { NO_GUESSES, type ResultPanelProps } from '@smg/game-sdk';
import type { ReactElement } from 'react';

import { counts } from './text.js';

export function ResultPanel({ view, names, viewerKey, part }: ResultPanelProps): ReactElement {
  const v = view as ResultView;
  const space = `${String(v.length)} digits, 0–${String(v.digits - 1)}`;
  const players = Object.keys(v.guesses).sort(
    (a, b) => Number(b === viewerKey) - Number(a === viewerKey),
  );
  if (part === 'reveal') {
    return (
      <div className="sc-result" data-testid="sc-result">
        {v.secret === null ? (
          <p className="sc-secret">Everyone had their own code ({space}).</p>
        ) : (
          <p className="sc-secret">
            Code: <strong data-testid="secret">{v.secret}</strong>{' '}
            <span className="sc-space">({space})</span>
          </p>
        )}
      </div>
    );
  }
  return (
    <ul className="sc-players" aria-label="Every code tried">
      {players.map((id) => (
        <li key={id} className={id === viewerKey ? 'sc-you' : undefined}>
          <strong className="smg-one-line" title={names[id] ?? id}>
            {names[id] ?? id}
          </strong>
          {v.secrets?.[id] === undefined ? null : (
            <>
              {' '}
              — code <span className="sc-code">{v.secrets[id]}</span>
            </>
          )}
          :{' '}
          {(v.guesses[id] ?? [])
            .map((g) =>
              g.feedback.solved ? `${g.value} open` : `${g.value} (${counts(g.feedback)})`,
            )
            .join(', ') || NO_GUESSES}
        </li>
      ))}
    </ul>
  );
}
