/**
 * @file   apps/web/src/round/SpecialInfo.tsx
 * @module web/round
 * @brief  The top bar's info button beside the season chip: what the round's special does.
 *
 * Responsibility: a round button ("i", named "What Leaf Fall does") opens a small note under
 *                 the top bar with the special's one plain sentence, the same as on the intro
 *                 screen (O35, O36); the button or Escape closes it again and the focus goes
 *                 back to the button. With the special off there is no button. The sentence is
 *                 the game's own where it words its special (`ruleOf`, T119), else the
 *                 platform's.
 * Depends on:     react, @smg/contracts, @smg/ui (useDisclosure), @smg-game/registry/web
 *                 (types), ../season/season, ./roundSpecials.css
 * Used by:        ./RoundScreen, ./RoundIntro
 * Spec:           docs/spec/02-game-guess-the-number.md §12; docs/spec/03-seasonal-specials.md §2
 */
import type { GameWeb } from '@smg-game/registry/web';
import type { SeasonName } from '@smg/contracts';
import type { ReactElement } from 'react';
import { useDisclosure } from '@smg/ui';

import { SPECIALS } from '../season/season.js';
import './roundSpecials.css';

// The special's sentence: the game's own words, or the platform's.
export const ruleOf = (game: GameWeb | null, season: SeasonName): string =>
  game?.text.specialRule?.(season) ?? SPECIALS[season].rule;

export function SpecialInfo(p: {
  readonly season: SeasonName;
  readonly rule: string;
}): ReactElement {
  const note = useDisclosure();
  const special = SPECIALS[p.season];
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
        <strong>{special.name}:</strong> {p.rule}
      </span>
    </span>
  );
}
