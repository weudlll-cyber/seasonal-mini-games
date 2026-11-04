/**
 * @file   apps/web/src/round/FocusIcons.tsx
 * @module web/round
 * @brief  The round bar's small line icons: chat, players, host, full screen on and off.
 *
 * Responsibility: one 20 px line drawing per bar button, in the text colour (`currentColor`),
 *                 hidden from screen readers: each button carries its words, shown beside the
 *                 icon on a desktop and read out on a phone, where only the icon shows (O46).
 * Depends on:     react
 * Used by:        ./FocusBar
 * Spec:           docs/spec/02-game-guess-the-number.md §12
 */
import type { ReactElement } from 'react';

// Each icon's strokes on a 24 × 24 grid.
const PATHS = {
  chat: 'M4 5h16v10H9l-4 4v-4H4z',
  players:
    'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 19c0-3 3-5 6-5s6 2 6 5M16 5.5a3 3 0 0 1 0 5.5M18 14c2 .6 3 2.4 3 5',
  host: 'M4 7h10M18 7h2M4 17h4M12 17h8M14 4.5v5M8 14.5v5',
  expand: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
  shrink: 'M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5',
} as const;

export type IconName = keyof typeof PATHS;

export function FocusIcon({ name }: { readonly name: IconName }): ReactElement {
  return (
    <svg
      className="focus-icon"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={PATHS[name]}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
