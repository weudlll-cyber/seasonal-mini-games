/**
 * @file   apps/web/src/round/PlayerName.tsx
 * @module web/round
 * @brief  A player's name on one line: never broken inside a word, shortened with an ellipsis.
 *
 * Responsibility: a name stays whole on its line (a hyphen in "bot-03" is no break point);
 *                 when it is longer than its room it ends in an ellipsis, and focus (Tab) or a
 *                 tap shows it in full; the full name is its accessible name and its title.
 *                 A website member's Discord steps follow it (./PlayerSteps); name and steps
 *                 are then one element, so a grid's columns stay as they are.
 * Depends on:     react, @smg/contracts (PlayerStepView), ./PlayerSteps, ./playerName.css
 * Used by:        ./ResultParts, ./MatchStandings, ./RoundSide (the Players panel), ./GuessLine
 *                 (the round's list and "Your guesses"), ../match/WaitingArea, ../chat/ChatRoom
 * Spec:           docs/spec/02-game-guess-the-number.md §9, §12; docs/spec/07-integration.md §7
 */
import type { PlayerStepView } from '@smg/contracts';
import { useState, type ReactElement } from 'react';

import { PlayerSteps } from './PlayerSteps.js';
import './playerName.css';

export function PlayerName({
  name,
  steps,
}: {
  readonly name: string;
  readonly steps?: readonly PlayerStepView[] | undefined;
}): ReactElement {
  const [full, setFull] = useState(false);
  const shown = (
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
  if (steps === undefined || steps.length === 0) return shown;
  return (
    <span className="player-named">
      {shown}
      <PlayerSteps steps={steps} />
    </span>
  );
}
