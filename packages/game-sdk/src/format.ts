/**
 * @file   packages/game-sdk/src/format.ts
 * @module game-sdk
 * @brief  The one way a number is written on a screen.
 *
 * Responsibility: "1,000,000", "-12,500", "42": every number a player reads (range, guesses,
 *                 the round's list, fallen numbers, intro, result, summary, the chat's round-end
 *                 line) goes through `formatNumber`, so all screens agree. Input fields are not
 *                 formatted: they take what the player types. Pure, no locale of the browser.
 *                 A span of time ("9:30", O107) is the shared kit's `clockText`.
 * Used by:        ./index, games/<game>/src and web, apps/web
 * Spec:           docs/spec/02-game-guess-the-number.md §12; docs/spec/02e-game-mind-games.md §11
 */
const GROUPED = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export const formatNumber = (n: number): string => GROUPED.format(n);
