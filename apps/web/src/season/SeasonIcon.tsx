/**
 * @file   apps/web/src/season/SeasonIcon.tsx
 * @module web/season
 * @brief  One original season icon with its name, optionally on its season colour.
 *
 * Responsibility: render the delivered SVG for a season with an accessible name, so colour
 *                 is never the only carrier of meaning (03 §6). Adapted from Bingo's
 *                 components/SeasonIcon.tsx.
 * Depends on:     react, @smg/contracts (SeasonName), ./season
 * Used by:        ../round/*, ../match/*
 * Spec:           docs/spec/03-seasonal-specials.md §6
 */
import type { SeasonName } from '@smg/contracts';
import type { ReactElement } from 'react';

import { SEASON_ICON_URLS, SEASON_NAMES, seasonColor } from './season.js';

export function SeasonIcon({
  season,
  size = '1.25rem',
  onColor = false,
}: {
  readonly season: SeasonName;
  readonly size?: string;
  readonly onColor?: boolean;
}): ReactElement {
  return (
    <img
      src={SEASON_ICON_URLS[season]}
      alt={SEASON_NAMES[season]}
      data-season={season}
      style={{
        width: size,
        height: size,
        display: 'inline-block',
        verticalAlign: 'middle',
        borderRadius: '50%',
        background: onColor ? seasonColor(season) : 'transparent',
      }}
    />
  );
}
