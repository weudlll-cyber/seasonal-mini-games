/**
 * @file   apps/web/src/match/dockedResult.test.ts
 * @module web/match
 * @brief  A list game's result on the docked page scrolls as one area above the chat (O110).
 *
 * Responsibility: on a desktop the result and the waiting area beside it are one scroll box
 *                 (`.match-after`) in the height above the chat, holding what it places inside
 *                 (`position: relative`), and the column beside the result has no cap and no
 *                 scroll of its own; a game with its own result (Seasonal Mind Games) keeps its
 *                 box that fills the height without scrolling.
 * Depends on:     vitest, node:fs
 * Spec:           docs/spec/02-game-guess-the-number.md §12
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./docked.css', import.meta.url), 'utf8');
const rule = (selector: string): string => {
  const start = css.indexOf(`${selector} {`);
  expect(start, selector).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf('}', start));
};

describe('the docked page’s platform result', () => {
  it('is one scroll area above the chat on a desktop', () => {
    const area = rule('  .match-docked .match-after:not(.match-after--docked)');
    expect(area).toMatch(/overflow-y: auto/);
    expect(area).toMatch(/flex: 1 1 0/);
    expect(area).toMatch(/min-height: 0/);
    expect(area).toMatch(/position: relative/);
  });

  it('has no scroll and no cap of its own in the column beside the result', () => {
    const side = rule('.match-docked .match-after:not(.match-after--docked) > .match-side');
    expect(side).toMatch(/max-height: none/);
    expect(side).toMatch(/overflow: visible/);
  });

  it('leaves a game’s own result filling the height without a scroll', () => {
    expect(rule('.match-after.match-after--docked')).not.toMatch(/overflow/);
  });
});
