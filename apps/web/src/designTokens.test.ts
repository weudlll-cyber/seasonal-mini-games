/**
 * @file   apps/web/src/designTokens.test.ts
 * @module web
 * @brief  WCAG AA contrast of the design tokens in the light and the dark theme (01 §13).
 *
 * Responsibility: the kit's `findLowContrast` over the tokens as the clients load them (the
 *                 kit's, then the game's own from @smg/ui) with this game's pairs: body, muted,
 *                 winter (Frost's line) and success text ("higher") on the page, the opaque
 *                 surfaces and the translucent cards over each token glow; the top bar's text
 *                 on its gradient; the solid pill; danger and success on the surfaces; the
 *                 inactivity countdown on the warning surface (O71); text and the pressed team
 *                 button's icon on every season colour (O26); the board ink at 7:1 (the hero
 *                 element); a row's text on the viewer's own-row tint of each season colour,
 *                 the mix the page makes (T261), on the panel's card over the page.
 * Depends on:     vitest, @seasonal/kit/testing, @seasonal/kit/tokens.css, @smg/ui/tokens.css
 *                 (raw)
 * Spec:           Bingo 01 §13 (WCAG 2.2 AA)
 */
import kitCss from '@seasonal/kit/tokens.css?raw';
import { findLowContrast, type ContrastPair } from '@seasonal/kit/testing';
import gameCss from '@smg/ui/tokens.css?raw';
import { describe, expect, it } from 'vitest';

const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const PAGE = ['--sk-color-background'] as const;
const GLOWS = [...PAGE, '--sk-page-background'] as const;
// Everything text sits on: page, surfaces, cards over the base and over each glow.
const BACKGROUNDS: readonly (readonly string[])[] = [
  PAGE,
  ['--sk-color-surface'],
  ['--sk-color-surface-2'],
  [...PAGE, '--sk-color-card'],
  GLOWS,
  [...GLOWS, '--sk-color-card'],
];
const TEXTS = [
  '--sk-color-text',
  // Muted text on surface-2 is also every disabled button (base.css).
  '--sk-color-text-muted',
  '--color-winter-text',
  '--color-success-text',
];
// The text of a row: names and comments, Frost's held answer, "higher", "lower" and "Boom!".
const ROW_TEXT = [...TEXTS, '--sk-color-danger'];
// A season's own-row tint as round/players.css and round/roundLog.css mix it.
const ownTint = (season: string): string =>
  `color-mix(in srgb, var(--sk-color-${season}) var(--own-tint), var(--color-own-base))`;

const pairs: readonly ContrastPair[] = [
  ...TEXTS.flatMap((text) => BACKGROUNDS.map((on) => ({ text, on }))),
  { text: '--sk-color-text', on: [...PAGE, '--sk-sidebar-background'] },
  { text: '--sk-color-on-solid', on: ['--sk-color-solid'] },
  ...['--sk-color-danger', '--sk-color-success'].flatMap((text) =>
    ['--sk-color-surface', '--sk-color-surface-2'].map((bg) => ({ text, on: [bg] })),
  ),
  { text: '--sk-color-text', on: ['--sk-color-warning-surface'] },
  ...SEASONS.map((season) => ({ text: '--sk-color-on-season', on: [`--sk-color-${season}`] })),
  ...SEASONS.flatMap((season) =>
    ROW_TEXT.map((text) => ({ text, on: [...PAGE, '--sk-color-card', ownTint(season)] })),
  ),
  { text: '--color-board-ink', on: ['--color-board'], min: 7 },
  { text: '--color-board-marked-ink', on: ['--color-board-marked'], min: 7 },
];

describe('token contrast (WCAG AA), light and dark', () => {
  it('keeps every pair readable', () => {
    expect(findLowContrast({ css: [kitCss, gameCss], pairs })).toEqual([]);
  });
});
