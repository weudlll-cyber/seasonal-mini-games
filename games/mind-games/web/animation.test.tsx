// @vitest-environment jsdom
/**
 * @file   games/mind-games/web/animation.test.tsx
 * @module games/mind-games/web
 * @brief  The result's winners light up for about 2 s, not with reduced motion.
 *
 * Responsibility: 09 §4.2's animation check of the result (owner decision 90); the flights'
 *                 checks are ./flights.test's.
 * Depends on:     vitest, @testing-library/react, ./fixtures, ./ResultPanel
 * Spec:           docs/spec/02e-game-mind-games.md §11.1; docs/spec/09-testing-strategy.md §4.2
 */
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { names, resultView } from './fixtures.js';
import { LIGHT_MS, ResultPanel } from './ResultPanel.js';

function reducedMotion(on: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: on && query.includes('reduce') }));
}

beforeEach(() => {
  vi.useFakeTimers();
  reducedMotion(false);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Mind Games winners light up (02e §11.1)', () => {
  const r = resultView([
    ['anna', 'summer'],
    ['bo', 'winter'],
    ['cy', 'winter'],
  ]);
  const lit = () =>
    [...document.querySelectorAll('.sk-anim-win')].map((e) => e.getAttribute('data-choice'));

  it('lights the winning options for about 2 s once the result shows', () => {
    render(<ResultPanel view={r} names={names} colors={{}} viewerKey={null} part="reveal" />);
    expect(lit()).toEqual(['summer']);
    act(() => {
      vi.advanceTimersByTime(LIGHT_MS);
    });
    expect(lit()).toEqual([]);
    expect(document.querySelector('.mg-wins')?.textContent).toBe('✓ WINNER');
  });

  it('lights nothing with reduced motion', () => {
    reducedMotion(true);
    render(<ResultPanel view={r} names={names} colors={{}} viewerKey={null} part="reveal" />);
    expect(lit()).toEqual([]);
  });
});
