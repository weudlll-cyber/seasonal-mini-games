/**
 * @file   games/guess-the-number/web/ResultPanel.tsx
 * @module games/guess-the-number/web
 * @brief  The game's part of the result page: the secret or every player's, and the guesses.
 *
 * Responsibility: the revealed secret in shared mode, or every player's own number in
 *                 individual mode with the viewer's line first (02 §9), the round's range
 *                 (revealed here when it was hidden, T52), and each player's guesses with
 *                 their answers. The platform shows placings, points, margin, teams and the
 *                 fairness proof around it.
 * Depends on:     react, @smg/game-sdk (props), @smg-game/guess-the-number (types)
 * Used by:        ./index
 * Spec:           docs/spec/02-game-guess-the-number.md §9
 */
import type { ResultView } from '@smg-game/guess-the-number';
import type { ResultPanelProps } from '@smg/game-sdk';
import type { ReactElement } from 'react';

export function ResultPanel({ view, names, viewerKey }: ResultPanelProps): ReactElement {
  const v = view as ResultView;
  const players = Object.keys(v.guesses).sort(
    (a, b) => Number(b === viewerKey) - Number(a === viewerKey),
  );
  return (
    <div className="gtn-result" data-testid="gtn-result">
      {v.secret === null ? null : (
        <p className="gtn-secret">
          The number was <strong data-testid="secret">{v.secret}</strong>.
        </p>
      )}
      <p data-testid="result-range">
        The range was {v.range.low} to {v.range.high}.
      </p>
      <ul className="gtn-players" aria-label="Every guess">
        {players.map((id) => (
          <li key={id} className={id === viewerKey ? 'gtn-you' : undefined}>
            <strong>{names[id] ?? id}</strong>
            {v.secrets?.[id] === undefined ? null : <> — number {v.secrets[id]}</>}:{' '}
            {(v.guesses[id] ?? []).map((g) => `${String(g.value)} ${g.feedback}`).join(', ') ||
              'no guesses'}
          </li>
        ))}
      </ul>
    </div>
  );
}
