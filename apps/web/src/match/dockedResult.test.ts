/**
 * @file   apps/web/src/match/dockedResult.test.ts
 * @module web/match
 * @brief  A list game's result on the docked page scrolls as one area above the chat (O110).
 *
 * Responsibility: on a desktop the result and the waiting area beside it are one scroll box
 *                 (`.match-after`) in the height above the chat, holding what it places inside
 *                 (`position: relative`), and the column beside the result has no cap and no
 *                 scroll of its own; a game with its own result (Seasonal Mind Games) keeps its
 *                 box that fills the height without scrolling. A list game's running round on a
 *                 phone keeps its list's head whole in the short height the kit's bar and the
 *                 keyboard leave: its row has the head's height as its floor and its panel gives
 *                 its padding in a short container; and the page draws no bar of its own, the
 *                 kit's dock.css alone does (T424).
 * Depends on:     vitest, node:fs
 * Spec:           docs/spec/02-game-guess-the-number.md §12
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./docked.css', import.meta.url), 'utf8');
const round = readFileSync(new URL('../round/round.css', import.meta.url), 'utf8');
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

describe('a list game’s round above the kit’s dock bar (T424)', () => {
  it('keeps the head’s height as its row’s floor and gives the panel’s padding in a short container', () => {
    const start = round.indexOf(".round-live[data-view='phone'][data-layout='list'] {");
    expect(start).toBeGreaterThanOrEqual(0);
    expect(round.slice(start, round.indexOf('}', start))).toContain(
      'minmax(calc(var(--sk-hit-target) + 2px), 1fr)',
    );
    expect(css).toMatch(/container-type: size/);
    const query = css.indexOf('@container (max-height: 21rem)');
    expect(query).toBeGreaterThanOrEqual(0);
    expect(css.slice(query, css.indexOf('}', css.indexOf('padding-block', query)))).toMatch(
      /\.round-main \{\s*padding-block: 0/,
    );
  });

  it('draws no bar of its own: the kit’s dock.css alone sizes every form', () => {
    expect(css).not.toMatch(/data-sk-bar='line'/);
    expect(css).not.toMatch(/\.chat-writer \{\s*display: none/);
  });
});
