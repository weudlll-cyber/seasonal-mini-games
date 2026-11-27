/**
 * @file   games/mind-games/web/seasons.ts
 * @module games/mind-games/web
 * @brief  The five choices on screen: the seasons their icons show, and their colours.
 *
 * Responsibility: which of the kit's season icons a choice shows (the website's drawings,
 *                 03 §6) and its colour token; All has the neutral surface colour and the four
 *                 icons (02e §11).
 * Depends on:     @smg-game/mind-games (Choice)
 * Used by:        ./ChoiceButtons, ./FlightBand, ./ResultPanel, ./text
 * Spec:           docs/spec/02e-game-mind-games.md §1, §11; docs/spec/03-seasonal-specials.md §6
 */
import type { Choice } from '@smg-game/mind-games';

type Season = Exclude<Choice, 'all'>;

// The seasons whose icons a choice shows: its own, or all four for All.
export const seasonsOf = (c: Choice): readonly Season[] =>
  c === 'all' ? ['spring', 'summer', 'autumn', 'winter'] : [c];

// A choice's colour: its season's token, All the neutral surface.
export const colorOf = (c: Choice): string =>
  c === 'all' ? 'var(--sk-color-surface-2)' : `var(--sk-color-${c})`;
