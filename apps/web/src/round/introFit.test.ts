/**
 * @file   apps/web/src/round/introFit.test.ts
 * @module web/round
 * @brief  The season card fits the height it has (O110): every part bounded by a share of it.
 *
 * Responsibility: the card's height is the round view's less the bar (`--intro-h`, container
 *                 units of the round's size container); the icon, the season's name, the
 *                 special's name and sentence, the facts, the countdown, the gaps and the
 *                 padding each take at most today's size and at most their share of that
 *                 height, and the shares of a card with a two-line sentence and two facts add
 *                 up to less than the whole, so nothing is cut at 1280 × 720 above the chat; on
 *                 a docked phone page of a list game the round view is a size container again.
 * Depends on:     vitest, node:fs
 * Spec:           docs/spec/02-game-guess-the-number.md §12
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./roundIntro.css', import.meta.url), 'utf8');
const docked = readFileSync(new URL('../match/docked.css', import.meta.url), 'utf8');

// The share of the card's height a rule's property may take, from `calc(var(--intro-h) * f)`.
function share(selector: string, property: string): number {
  const start = css.indexOf(`${selector} {`);
  expect(start, selector).toBeGreaterThanOrEqual(0);
  const block = css.slice(start, css.indexOf('}', start));
  const line = block.split('\n').find((l) => l.trim().startsWith(`${property}:`)) ?? '';
  const m = /min\(.*calc\(var\(--intro-h\) \* ([\d.]+)\)\)/.exec(line);
  expect(m, `${selector} ${property}: ${line}`).not.toBeNull();
  return Number(m?.[1]);
}

describe('the season card', () => {
  it('reckons its height from the round view, less the bar', () => {
    expect(css).toMatch(/--intro-h: calc\(100cqh - 44px - var\(--space-1\)\)/);
    // The list game's round view on a docked phone page is a size container again.
    expect(docked).toMatch(
      /\.match-live:has\(> \.round-live\[data-layout='list'\]\) \{[^}]*container-type: size/,
    );
  });

  it('bounds every part by today’s size and its share, the shares under the whole card', () => {
    const lines = (size: number, n: number, height = 1.2) => size * n * height;
    const total =
      share('.round-intro-icon', 'height') +
      lines(share('.round-intro-head h1', 'font-size'), 1, 1) +
      share('.round-intro-head', 'gap') +
      lines(share('.round-intro-special h2', 'font-size'), 1) +
      lines(share('.round-intro-special p', 'font-size'), 2, 1.5) +
      lines(share('.round-intro-facts', 'font-size'), 2, 1.5) +
      lines(share('.round-intro-count strong', 'font-size'), 1) +
      // Four gaps between five parts, and the padding above and below.
      4 * share('.round-intro', 'gap') +
      2 * share('.round-intro', 'padding');
    expect(total).toBeLessThan(1);
  });
});
