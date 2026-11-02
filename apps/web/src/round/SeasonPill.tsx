/**
 * @file   apps/web/src/round/SeasonPill.tsx
 * @module web/round
 * @brief  The round bar's season pill, which also tells what the round's special does.
 *
 * Responsibility: the pill in the season's token colour with its icon, the season's name and
 *                 the special's ("Autumn · Leaf Fall", "Summer · no special", O35) and the
 *                 halving badge. With the special on the pill is a button with a small "i":
 *                 it opens a note under the bar with the special's one plain sentence, the same
 *                 as on the intro screen (O36); the pill or Escape closes it and the focus goes
 *                 back to the pill. One control instead of a pill and an info button keeps the
 *                 phone's bar to one row (O46). The sentence is the game's own where it words
 *                 its special (`ruleOf`, T119), else the platform's.
 * Depends on:     react, @smg/contracts, @smg/ui (useDisclosure), @smg-game/registry/web
 *                 (types), ../season/*, ./roundSpecials.css
 * Used by:        ./FocusBar, ./RoundIntro
 * Spec:           docs/spec/02-game-guess-the-number.md §12; docs/spec/03-seasonal-specials.md §2
 */
import type { GameWeb } from '@smg-game/registry/web';
import type { RoundStateView, SeasonName } from '@smg/contracts';
import type { ReactElement } from 'react';
import { useDisclosure } from '@smg/ui';

import { SeasonIcon } from '../season/SeasonIcon.js';
import { SEASON_NAMES, SPECIALS } from '../season/season.js';
import './roundSpecials.css';

// The special's sentence: the game's own words, or the platform's.
export const ruleOf = (game: GameWeb | null, season: SeasonName): string =>
  game?.text.specialRule?.(season) ?? SPECIALS[season].rule;

// What the pill shows: icon, season, special, the halving badge.
function PillFace({ state }: { readonly state: RoundStateView }): ReactElement {
  return (
    <>
      {/* On a light disc: the token icon would vanish on its own season colour. */}
      <span className="round-season-icon">
        <SeasonIcon season={state.season} size="1.25rem" />
      </span>
      {/* On a phone the season's name stays and the special's goes to screen readers. */}
      <span className="round-season-text">
        <strong className="round-season-name" data-testid="round-season">
          {SEASON_NAMES[state.season]}{' '}
        </strong>
        <span className="round-special" data-testid="round-special">
          {state.specialOn ? SPECIALS[state.season].name : 'no special'}
        </span>
      </span>
      {state.halving ? <span className="round-badge">Halving round</span> : null}
    </>
  );
}

export function SeasonPill(p: {
  readonly state: RoundStateView;
  readonly rule: string;
}): ReactElement {
  const note = useDisclosure();
  const { state } = p;
  if (!state.specialOn) {
    return (
      <span className="round-season" data-season={state.season}>
        <PillFace state={state} />
      </span>
    );
  }
  const special = SPECIALS[state.season];
  return (
    <span className="round-info" onKeyDown={note.onKeyDown}>
      <button
        ref={note.button}
        type="button"
        className="round-season round-season--button"
        data-season={state.season}
        aria-expanded={note.open}
        aria-controls={note.panelId}
        aria-label={`${SEASON_NAMES[state.season]} · ${special.name}: what it does`}
        data-testid="special-info"
        onClick={note.toggle}
      >
        <PillFace state={state} />
        <span className="round-info-mark" aria-hidden="true">
          i
        </span>
      </button>
      <span id={note.panelId} className="round-info-note" role="note" hidden={!note.open}>
        <strong>{special.name}:</strong> {p.rule}
      </span>
    </span>
  );
}
