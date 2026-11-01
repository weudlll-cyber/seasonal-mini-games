/**
 * @file   games/bomb-defusal/web/ResultPanel.tsx
 * @module games/bomb-defusal/web
 * @brief  The game's part of the result page: the secret sequence revealed, and every sequence cut.
 *
 * Responsibility: the shared secret as numbered wire chips (swatch and name), or in
 *                 individual mode every player's own sequence with the viewer's line first
 *                 (02c §9), and each player's sequences with their answers in words. The
 *                 platform shows placings, points, margin or closest miss, teams and the
 *                 fairness proof around it.
 * Depends on:     react, @smg/game-sdk (props), @smg-game/bomb-defusal (types, wording),
 *                 ./text, ./WireChip
 * Used by:        ./index
 * Spec:           docs/spec/02c-game-bomb-defusal.md §9
 */
import { sequenceText, type ResultView } from '@smg-game/bomb-defusal';
import type { ResultPanelProps } from '@smg/game-sdk';
import type { ReactElement } from 'react';

import { answerText } from './text.js';
import { SequenceChips } from './WireChip.js';

export function ResultPanel({ view, names, viewerKey }: ResultPanelProps): ReactElement {
  const v = view as ResultView;
  const players = Object.keys(v.guesses).sort(
    (a, b) => Number(b === viewerKey) - Number(a === viewerKey),
  );
  return (
    <div className="bd-result" data-testid="bd-result">
      {v.secret === null ? null : (
        <div className="bd-secret">
          <p>The sequence was:</p>
          <SequenceChips sequence={v.secret} label="The secret sequence" testId="secret" />
        </div>
      )}
      <ul className="bd-players" aria-label="Every sequence">
        {players.map((id) => {
          const own = v.secrets?.[id];
          const cut = (v.guesses[id] ?? []).map(
            (g) => `${sequenceText(g.value)}: ${answerText(g.feedback, v.cuts).text}`,
          );
          return (
            <li key={id} className={id === viewerKey ? 'bd-you' : undefined}>
              <strong>{names[id] ?? id}</strong>
              {own === undefined ? null : (
                <SequenceChips sequence={own} label={`${names[id] ?? id}'s sequence`} />
              )}
              <span>{cut.join('; ') || 'no sequences'}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
