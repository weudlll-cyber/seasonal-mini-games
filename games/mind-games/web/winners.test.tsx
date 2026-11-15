// @vitest-environment jsdom
/**
 * @file   games/mind-games/web/winners.test.tsx
 * @module games/mind-games/web
 * @brief  The result with 160 players, 36 winners and long names (MG-N8): the winners' chips.
 *
 * Responsibility: the winners panel keeps its chips to four rows on a desktop and three on a
 *                 phone (two in a short desktop window), the viewer's "You" first, and "+N more"
 *                 opens all 36 winners; no card holds a player name. jsdom lays nothing out, so
 *                 a small flow layout stands in for the browser's: each chip as wide as its text
 *                 (at most 220 px, 150 on a phone), rows 32 px apart in a box 900 px (300 on a
 *                 phone) wide.
 * Depends on:     vitest, @testing-library/react, ./fixtures, ./ResultPanel, ./WinnersPanel
 * Spec:           docs/spec/02e-game-mind-games.md §9; docs/spec/09-testing-strategy.md §2
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resultView } from './fixtures.js';
import { ResultPanel } from './ResultPanel.js';
import { chipRows } from './WinnersPanel.js';

const LONG = 'Captain Autumn Leaves the Twenty-Sixth';
const keys = Array.from({ length: 160 }, (_, i) => `p${String(i + 1)}`);
// The first 36 on Winter (the least chosen), the viewer among them, the rest spread wider.
const SEASONS = ['spring', 'summer', 'autumn'] as const;
const moves = keys.map((k, i) => [k, i < 36 ? 'winter' : SEASONS[i % 3]] as const);
const names = Object.fromEntries(keys.map((k, i) => [k, `${LONG} ${String(i + 1)}`]));
const view = resultView(moves as unknown as Parameters<typeof resultView>[0]);

// The fake flow layout: an item's place among its siblings in the chips' box.
let box = 900;
let chipMax = 220;
function place(el: HTMLElement): { top: number; height: number } {
  const parent = el.parentElement;
  if (parent === null || !parent.classList.contains('mg-chips')) return { top: 0, height: 0 };
  let x = 0;
  let row = 0;
  for (const item of Array.from(parent.children) as HTMLElement[]) {
    const chip = item.dataset['chip'] !== undefined;
    const w = chip ? Math.min(chipMax, 8 * item.textContent.length + 24) : 96;
    if (x > 0 && x + w > box) {
      row += 1;
      x = 0;
    }
    if (item === el) return { top: row * 32, height: 26 };
    x += w + 6;
  }
  return { top: 0, height: 0 };
}

function screenSize(width: number, height: number): void {
  Object.assign(window, { innerWidth: width, innerHeight: height });
  box = width < 900 ? 300 : 900;
  chipMax = width < 900 ? 150 : 220;
}

const rowsShown = (): number => {
  const tops = [...document.querySelectorAll<HTMLElement>('.mg-chips > *')].map((c) => c.offsetTop);
  return new Set(tops).size;
};

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetTop', {
    configurable: true,
    get(this: HTMLElement) {
      return place(this).top;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return place(this).height;
    },
  });
});

afterEach(() => {
  cleanup();
  delete (HTMLElement.prototype as { offsetTop?: number }).offsetTop;
  delete (HTMLElement.prototype as { offsetHeight?: number }).offsetHeight;
});

function show(width: number, height: number): void {
  screenSize(width, height);
  act(() => {
    render(<ResultPanel view={view} names={names} colors={{}} viewerKey="p5" part="reveal" />);
  });
}

describe('the winners of a round with 160 players (MG-N8)', () => {
  it('allows four chip rows on a desktop, three on a phone, two in a short window', () => {
    expect(chipRows(1440, 900)).toBe(4);
    expect(chipRows(1280, 720)).toBe(2);
    expect(chipRows(390, 844)).toBe(3);
    expect(chipRows(1024, 1366)).toBe(3);
  });

  it('keeps a desktop to four rows, "You" first, and "+N more" opens all 36', () => {
    show(1440, 900);
    expect(rowsShown()).toBeLessThanOrEqual(4);
    const chips = [...document.querySelectorAll('.mg-chip')];
    expect(chips[0]?.textContent).toBe('You');
    // Every chip names its player whole in its tooltip.
    expect(chips[1]?.getAttribute('title')).toBe(`${LONG} 1`);
    const more = screen.getByRole('button', { name: /^\+\d+ more$/ });
    expect(Number(/\d+/.exec(more.textContent)?.[0])).toBe(36 - chips.length);
    const all = document.querySelector<HTMLOListElement>('ol.mg-winners-all') as HTMLOListElement;
    expect(all.getAttribute('aria-label')).toBe('Every winner');
    expect(all.hidden).toBe(true);
    fireEvent.click(more);
    expect(all.hidden).toBe(false);
    expect(all.querySelectorAll('li')).toHaveLength(36);
  });

  it('keeps a phone to three rows', () => {
    show(390, 844);
    expect(rowsShown()).toBeLessThanOrEqual(3);
    expect(screen.getByRole('button', { name: /^\+\d+ more$/ })).toBeTruthy();
  });

  it('puts no player name in any card', () => {
    show(1440, 900);
    const cards = screen.getByRole('list', { name: 'The options' }).textContent;
    expect(cards).not.toContain(LONG);
    expect(cards).not.toContain('You');
  });
});
