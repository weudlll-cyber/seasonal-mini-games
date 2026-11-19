/**
 * @file   packages/game-sdk/src/names.ts
 * @module game-sdk
 * @brief  The one order of players' display names: case-insensitive and numeric-aware.
 *
 * Responsibility: wherever players are listed by name (a shared place in the standings, a
 *                 phased round's result rows), "bot-9" comes before "bot-10" and "anna"
 *                 beside "Anna" (O102): English collation, case ignored, accents kept, digit
 *                 runs compared as numbers. Pure, no locale of the browser.
 * Used by:        ./index, apps/server (league standings), apps/web (round results)
 * Spec:           docs/spec/02-game-guess-the-number.md §9; docs/spec/02e-game-mind-games.md §8.2
 */
const BY_NAME = new Intl.Collator('en', { sensitivity: 'accent', numeric: true });

export const compareNames = (a: string, b: string): number => BY_NAME.compare(a, b);
