/**
 * @file   games/guess-the-number/web/ResultPanel.tsx
 * @module games/guess-the-number/web
 * @brief  The game's part of the result page: the secret or every player's, and the guesses.
 *
 * Responsibility: the revealed secret in shared mode, or every player's own number in
 *                 individual mode with the viewer's line first (02 §9), and each player's
 *                 guesses with their answers. The platform shows placings, points, margin,
 *                 teams and the fairness proof around it.
 * Depends on:     react, @smg/game-sdk (props)
 * Used by:        ./index
 * Spec:           docs/spec/02-game-guess-the-number.md §9
 */
import type { ResultPanelProps } from '@smg/game-sdk';
import type { ReactElement } from 'react';

interface ResultView {
  readonly secret: number | null;
  readonly secrets: Readonly<Record<string, number>> | null;
  readonly guesses: Readonly<
    Record<string, readonly { readonly value: number; readonly feedback: string }[]>
  >;
}

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
