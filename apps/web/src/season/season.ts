/**
 * @file   apps/web/src/season/season.ts
 * @module web/season
 * @brief  The four seasons on screen: names, colours, icons and specials.
 *
 * Responsibility: the original Seasonal Tokens icons from assets/seasons (Vite copies them
 *                 into the bundle, used as delivered, never redrawn), each season's colour
 *                 token, its name, and its special's name and one-line rule (03 §2, §6).
 *                 Adapted from Bingo's seasonIcons.ts and types.ts.
 * Depends on:     @smg/contracts (SeasonName), assets/seasons/*.svg
 * Used by:        ./SeasonIcon, ../round/*, ../match/*, ../lobby/*
 * Spec:           docs/spec/03-seasonal-specials.md §2, §6
 */
import type { SeasonName } from '@smg/contracts';

import autumn from '../../../../assets/seasons/autumn.svg';
import spring from '../../../../assets/seasons/spring.svg';
import summer from '../../../../assets/seasons/summer.svg';
import winter from '../../../../assets/seasons/winter.svg';

export const SEASONS: readonly SeasonName[] = ['spring', 'summer', 'autumn', 'winter'];

export const SEASON_ICON_URLS: Readonly<Record<SeasonName, string>> = {
  spring,
  summer,
  autumn,
  winter,
};

export const SEASON_NAMES: Readonly<Record<SeasonName, string>> = {
  spring: 'Spring',
  summer: 'Summer',
  autumn: 'Autumn',
  winter: 'Winter',
};

export const SPECIALS: Readonly<
  Record<SeasonName, { readonly name: string; readonly rule: string }>
> = {
  spring: { name: 'Spring Herald', rule: 'Everyone gets one free hint at the start.' },
  summer: { name: 'Heatwave', rule: 'The cooldown shrinks step by step, never below 3 s.' },
  autumn: { name: 'Leaf Fall', rule: 'Every so often, wrong numbers fall from the range.' },
  winter: { name: 'Frost', rule: 'Every answer arrives a few seconds late.' },
};

export function seasonColor(season: SeasonName): string {
  return `var(--color-${season})`;
}
