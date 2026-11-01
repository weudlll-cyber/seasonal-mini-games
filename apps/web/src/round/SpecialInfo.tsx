/**
 * @file   apps/web/src/round/SpecialInfo.tsx
 * @module web/round
 * @brief  The top bar's info button beside the season chip: what the round's special does.
 *
 * Responsibility: a round button ("i", named "What Leaf Fall does") opens a small note under
 *                 the top bar with the special's one plain sentence, the same as on the intro
 *                 screen (O35, O36); the button or Escape closes it again and the focus goes
 *                 back to the button. With the special off there is no button.
 * Depends on:     react, @smg/contracts, ../components/useDisclosure, ../season/season,
 *                 ./roundSpecials.css
 * Used by:        ./RoundScreen
 * Spec:           docs/spec/02-game-guess-the-number.md §12; docs/spec/03-seasonal-specials.md §2
 */
import type { SeasonName } from '@smg/contracts';
import type { ReactElement } from 'react';

import { useDisclosure } from '../components/useDisclosure.js';
import { SPECIALS } from '../season/season.js';
import './roundSpecials.css';

export function SpecialInfo({ season }: { readonly season: SeasonName }): ReactElement {
  const note = useDisclosure();
  const special = SPECIALS[season];
  return (
    <span className="round-info" onKeyDown={note.onKeyDown}>
      <button
        ref={note.button}
        type="button"
        className="round-info-button"
        aria-expanded={note.open}
        aria-controls={note.panelId}
        aria-label={`What ${special.name} does`}
        data-testid="special-info"
        onClick={note.toggle}
      >
        <span aria-hidden="true">i</span>
      </button>
      <span id={note.panelId} className="round-info-note" role="note" hidden={!note.open}>
        <strong>{special.name}:</strong> {special.rule}
      </span>
    </span>
  );
}
