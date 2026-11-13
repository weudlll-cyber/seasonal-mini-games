/**
 * @file   games/mind-games/web/seasons.ts
 * @module games/mind-games/web
 * @brief  The five choices on screen: their names, the seasons' original icons and colours.
 *
 * Responsibility: each season's original Seasonal Tokens icon from assets/seasons, used as
 *                 delivered (03 §6), the same files the player client's own season parts use,
 *                 and its colour token; All has the neutral surface colour and the four icons
 *                 (02e §11).
 * Depends on:     @smg-game/mind-games (Choice), assets/seasons/*.svg
 * Used by:        ./ChoiceButtons, ./ResultPanel, ./text
 * Spec:           docs/spec/02e-game-mind-games.md §1, §11; docs/spec/03-seasonal-specials.md §6
 */
import type { Choice } from '@smg-game/mind-games';

import autumn from '../../../assets/seasons/autumn.svg';
import spring from '../../../assets/seasons/spring.svg';
import summer from '../../../assets/seasons/summer.svg';
import winter from '../../../assets/seasons/winter.svg';

type Season = Exclude<Choice, 'all'>;

const SEASON_ICONS: Readonly<Record<Season, string>> = { spring, summer, autumn, winter };

// The icons a choice shows: its season's, or all four for All.
export const iconsOf = (c: Choice): readonly string[] =>
  c === 'all' ? [spring, summer, autumn, winter] : [SEASON_ICONS[c]];

// A choice's colour: its season's token, All the neutral surface.
export const colorOf = (c: Choice): string =>
  c === 'all' ? 'var(--color-surface-2)' : `var(--color-${c})`;
