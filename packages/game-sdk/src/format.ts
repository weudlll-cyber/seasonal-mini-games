/**
 * @file   packages/game-sdk/src/format.ts
 * @module game-sdk
 * @brief  The one way a number or a span of time is written on a screen.
 *
 * Responsibility: "1,000,000", "-12,500", "42": every number a player reads (range, guesses,
 *                 the round's list, fallen numbers, intro, result, summary, the chat's round-end
 *                 line) goes through `formatNumber`, so all screens agree. Input fields are not
 *                 formatted: they take what the player types. Pure, no locale of the browser.
 *                 `clockText`: milliseconds as "9:30", whole seconds down; the round's "… left"
 *                 in the platform's bar and every countdown of a game's screens use it, so two
 *                 clocks on one screen always show the same seconds (owner, 2026-11-18, O107).
 * Used by:        ./index, games/<game>/src and web, apps/web
 * Spec:           docs/spec/02-game-guess-the-number.md §12; docs/spec/02e-game-mind-games.md §11
 */
const GROUPED = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export const formatNumber = (n: number): string => GROUPED.format(n);

// Milliseconds as "9:30", whole seconds down.
export function clockText(ms: number): string {
  const secs = Math.floor((ms % 60_000) / 1_000);
  return `${String(Math.floor(ms / 60_000))}:${String(secs).padStart(2, '0')}`;
}
