/**
 * @file   games/bomb-defusal/web/ResultPanel.tsx
 * @module games/bomb-defusal/web
 * @brief  The game's part of the result page: the secret sequence revealed, and every sequence cut.
 *
 * Responsibility: the reveal (`part`, T150): the shared secret as numbered wire chips
 *                 (swatch and name) on one line; the history: each player's sequences as the
 *                 round's colour dots (their names read out and on hover) with their answers
 *                 in words, in individual mode with the player's own sequence, the viewer's
 *                 line first (02c §9), "did not guess" without one. The
 *                 platform shows placings, points, margin or closest miss, teams and the
 *                 fairness proof around it.
 * Depends on:     react, @smg/game-sdk (props), @smg-game/bomb-defusal (types, wording),
 *                 ./text, ./WireChip, ./result.css
 * Used by:        ./index
 * Spec:           docs/spec/02c-game-bomb-defusal.md §9
 */
import type { ResultView } from '@smg-game/bomb-defusal';
import { NO_GUESSES, type ResultPanelProps } from '@smg/game-sdk';
import type { ReactElement } from 'react';

import { answerText } from './text.js';
import { SequenceChips, SequenceDots } from './WireChip.js';
import './result.css';

export function ResultPanel({ view, names, viewerKey, part }: ResultPanelProps): ReactElement {
  const v = view as ResultView;
  const players = Object.keys(v.guesses).sort(
    (a, b) => Number(b === viewerKey) - Number(a === viewerKey),
  );
  if (part === 'reveal') {
    return (
      <div className="bd-result" data-testid="bd-result">
        {v.secret === null ? (
          <p>Everyone had their own sequence.</p>
        ) : (
          <div className="bd-secret">
            <p>The sequence was:</p>
            <SequenceChips sequence={v.secret} label="The secret sequence" testId="secret" />
          </div>
        )}
      </div>
    );
  }
  return (
    <ul className="bd-players" aria-label="Every sequence">
      {players.map((id) => {
        const own = v.secrets?.[id];
        const cuts = v.guesses[id] ?? [];
        return (
          <li key={id} className={id === viewerKey ? 'bd-you' : undefined}>
            <strong>{names[id] ?? id}</strong>
            {own === undefined ? null : (
              <SequenceChips sequence={own} label={`${names[id] ?? id}'s sequence`} />
            )}
            {cuts.length === 0 ? (
              <span>{NO_GUESSES}</span>
            ) : (
              <ol className="bd-cuts">
                {cuts.map((g, i) => (
                  <li key={i}>
                    <SequenceDots sequence={g.value} /> {answerText(g.feedback, v.cuts).text}
                  </li>
                ))}
              </ol>
            )}
          </li>
        );
      })}
    </ul>
  );
}
