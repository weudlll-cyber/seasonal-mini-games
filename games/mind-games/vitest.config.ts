/**
 * @file   games/mind-games/vitest.config.ts
 * @module games/mind-games
 * @brief  The game's Vitest project: its name, and the one stylesheet its tests read as text.
 *
 * Responsibility: the flights' timeline lives in web/flights.css, which jsdom does not run;
 *                 web/landing.test reads it as raw text (Vitest skips CSS otherwise), as the
 *                 player client's tests read motion.css (apps/web/vite.config.ts).
 * Used by:        the root vitest.config.ts (projects `games/*`)
 * Spec:           docs/spec/09-testing-strategy.md §4.2
 */
import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: '@smg-game/mind-games',
    css: { include: [/flights\.css/] },
  },
});
