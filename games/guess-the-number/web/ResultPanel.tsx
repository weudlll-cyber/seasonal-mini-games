/**
 * @file   games/guess-the-number/web/ResultPanel.tsx
 * @module games/guess-the-number/web
 * @brief  The game's part of the result page: the secret or every player's, and the guesses.
 *
 * Responsibility: the reveal (`part`, T150): the secret in shared mode and the round's range
 *                 (revealed here when it was hidden, T52); the history: each player's guesses
 *                 with their answers, in individual mode with the player's own number, the
 *                 viewer's line first (02 §9), "did not guess" without one. The platform
 *                 shows placings, points, margin, teams and the fairness proof around it.
 * Depends on:     react, @smg/game-sdk (props, formatNumber), @smg-game/guess-the-number (types)
 * Used by:        ./index
 * Spec:           docs/spec/02-game-guess-the-number.md §9
 */
import type { ResultView } from '@smg-game/guess-the-number';
import { formatNumber, NO_GUESSES, type ResultPanelProps } from '@smg/game-sdk';
import type { ReactElement } from 'react';

export function ResultPanel({ view, names, viewerKey, part }: ResultPanelProps): ReactElement {
  const v = view as ResultView;
  const players = Object.keys(v.guesses).sort(
    (a, b) => Number(b === viewerKey) - Number(a === viewerKey),
  );
  if (part === 'reveal') {
    return (
      <div className="gtn-result" data-testid="gtn-result">
        {v.secret === null ? null : (
          <p className="gtn-secret">
            The number was <strong data-testid="secret">{formatNumber(v.secret)}</strong>.
          </p>
        )}
        <p data-testid="result-range">
          The range was {formatNumber(v.range.low)} to {formatNumber(v.range.high)}.
        </p>
      </div>
    );
  }
  return (
    <ul className="gtn-players" aria-label="Every guess">
      {players.map((id) => (
        <li key={id} className={id === viewerKey ? 'gtn-you' : undefined}>
          <strong className="smg-one-line" title={names[id] ?? id}>
            {names[id] ?? id}
          </strong>
          {v.secrets?.[id] === undefined ? null : <> — number {formatNumber(v.secrets[id])}</>}:{' '}
          {(v.guesses[id] ?? []).map((g) => `${formatNumber(g.value)} ${g.feedback}`).join(', ') ||
            NO_GUESSES}
        </li>
      ))}
    </ul>
  );
}
