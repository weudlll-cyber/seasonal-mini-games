/**
 * @file   apps/web/src/season/SeasonIcon.tsx
 * @module web/season
 * @brief  One original season icon with its name, optionally on its season colour or in one colour.
 *
 * Responsibility: render the delivered SVG for a season with an accessible name, so colour
 *                 is never the only carrier of meaning (03 §6). `mono` draws the icon's shape
 *                 in the current text colour (the SVG as a mask), for an icon on a season
 *                 colour such as the pressed team button (O26 checks: 3:1 against it).
 *                 Adapted from Bingo's components/SeasonIcon.tsx.
 * Depends on:     react, @smg/contracts (SeasonName), ./season
 * Used by:        ../round/*, ../match/*
 * Spec:           docs/spec/03-seasonal-specials.md §6
 */
import type { SeasonName } from '@smg/contracts';
import type { CSSProperties, ReactElement } from 'react';

import { SEASON_ICON_URLS, SEASON_NAMES, seasonColor } from './season.js';

export function SeasonIcon({
  season,
  size = '1.25rem',
  onColor = false,
  mono = false,
}: {
  readonly season: SeasonName;
  readonly size?: string;
  readonly onColor?: boolean;
  readonly mono?: boolean;
}): ReactElement {
  const box: CSSProperties = { width: size, height: size, display: 'inline-block' };
  if (mono) {
    const mask = `url("${SEASON_ICON_URLS[season]}") center / contain no-repeat`;
    return (
      <span
        role="img"
        aria-label={SEASON_NAMES[season]}
        data-season={season}
        style={{
          ...box,
          verticalAlign: 'middle',
          background: 'currentColor',
          mask,
          WebkitMask: mask,
        }}
      />
    );
  }
  return (
    <img
      src={SEASON_ICON_URLS[season]}
      alt={SEASON_NAMES[season]}
      data-season={season}
      style={{
        ...box,
        verticalAlign: 'middle',
        borderRadius: '50%',
        background: onColor ? seasonColor(season) : 'transparent',
      }}
    />
  );
}
