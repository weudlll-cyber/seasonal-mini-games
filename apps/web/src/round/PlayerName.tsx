/**
 * @file   apps/web/src/round/PlayerName.tsx
 * @module web/round
 * @brief  A player's name on one line: never broken inside a word, shortened with an ellipsis.
 *
 * Responsibility: a name stays whole on its line (a hyphen in "bot-03" is no break point);
 *                 when it is longer than its room it ends in an ellipsis, and focus (Tab) or a
 *                 tap shows it in full; the full name is its accessible name and its title.
 * Depends on:     react
 * Used by:        ./ResultScreen
 * Spec:           docs/spec/02-game-guess-the-number.md §9, §12
 */
import { useState, type ReactElement } from 'react';

export function PlayerName({ name }: { readonly name: string }): ReactElement {
  const [full, setFull] = useState(false);
  return (
    <span
      className="player-name"
      data-full={full}
      title={name}
      // Reachable by keyboard, so a shortened name can be read in full (WCAG 1.4.10).
      tabIndex={0}
      onClick={() => {
        setFull((f) => !f);
      }}
      onBlur={() => {
        setFull(false);
      }}
    >
      {name}
    </span>
  );
}
