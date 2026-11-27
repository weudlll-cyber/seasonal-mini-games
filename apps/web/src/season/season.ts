/**
 * @file   apps/web/src/season/season.ts
 * @module web/season
 * @brief  The four seasons on screen: names, colours and specials.
 *
 * Responsibility: each season's colour token, its name, and its special's name and the one
 *                 plain sentence on what it does, in the owner's words (O35, O36; 03 §2). The
 *                 drawings are the kit's SeasonIcon (03 §6, DECISIONS T443).
 *                 Adapted from Bingo's types.ts.
 * Depends on:     @smg/contracts (SeasonName)
 * Used by:        ./TeamIcon, ../round/*, ../match/*, ../lobby/*
 * Spec:           docs/spec/03-seasonal-specials.md §2, §6; kit DECISIONS K83
 */
import type { SeasonName } from '@smg/contracts';

export const SEASONS: readonly SeasonName[] = ['spring', 'summer', 'autumn', 'winter'];

export const SEASON_NAMES: Readonly<Record<SeasonName, string>> = {
  spring: 'Spring',
  summer: 'Summer',
  autumn: 'Autumn',
  winter: 'Winter',
};

// A season team's name wherever a team appears: "Team Spring" (O52).
export const teamName = (team: SeasonName): string => `Team ${SEASON_NAMES[team]}`;

export const SPECIALS: Readonly<
  Record<SeasonName, { readonly name: string; readonly rule: string }>
> = {
  spring: { name: 'Spring Herald', rule: 'Everyone gets one free hint when the round opens.' },
  summer: {
    name: 'Heatwave',
    rule: 'The waiting time between guesses gets shorter as the round goes on.',
  },
  autumn: { name: 'Leaf Fall', rule: 'Every so often, some wrong numbers fall out of the game.' },
  winter: { name: 'Frost', rule: 'Answers arrive a few seconds late.' },
};

// A round with its season's special switched off.
export const NO_SPECIAL = 'No special this round.';

export function seasonColor(season: SeasonName): string {
  return `var(--sk-color-${season})`;
}
