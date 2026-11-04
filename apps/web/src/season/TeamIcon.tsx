/**
 * @file   apps/web/src/season/TeamIcon.tsx
 * @module web/season
 * @brief  A team as its season's icon alone, named for a screen reader and in its tooltip.
 *
 * Responsibility: the narrow player lists' team column under its heading "Team": the icon
 *                 of the team's season, the team's name ("Team Winter", O52) as its accessible
 *                 name and title, so the name column keeps the width (T212); a player without
 *                 a team yet a dash named "no team yet".
 * Depends on:     react, @smg/contracts, ./SeasonIcon, ./season
 * Used by:        ../match/WaitingArea, ../round/RoundSide
 * Spec:           docs/spec/03-seasonal-specials.md §5; docs/spec/02-game-guess-the-number.md §2
 */
import type { TeamName } from '@smg/contracts';
import type { ReactElement } from 'react';

import { SeasonIcon } from './SeasonIcon.js';
import { teamName } from './season.js';

export function TeamIcon(p: {
  readonly team: TeamName | null;
  readonly className: string;
  readonly size?: string;
}): ReactElement {
  const name = p.team === null ? 'no team yet' : teamName(p.team);
  return (
    <span className={p.className} role="img" aria-label={name} title={name}>
      {p.team === null ? (
        <span aria-hidden="true">–</span>
      ) : (
        <span aria-hidden="true">
          <SeasonIcon season={p.team} size={p.size ?? '1rem'} />
        </span>
      )}
    </span>
  );
}
