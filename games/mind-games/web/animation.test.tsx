// @vitest-environment jsdom
/**
 * @file   games/mind-games/web/animation.test.tsx
 * @module games/mind-games/web
 * @brief  The flights come only from released feed steps; the winners light up after the end.
 *
 * Responsibility: 09 §4.2's animation checks (owner decision 90): the band is fed views one by
 *                 one; no flight before its step arrives and none without one; a first choice
 *                 flies in with its name, a named switch from its old season to its new one, a
 *                 hidden switch without a name; a step with 20 switches flies 12 icons with a
 *                 "+8" tag and shows the step's exact counts at once; a wave is gone after its
 *                 flight; with reduced motion nothing flies and the counts change in place; the
 *                 result's winners light up for about 2 s, not with reduced motion. That the
 *                 band overlaps no button, line or chat panel at 1280 × 720 and 390 × 844 needs
 *                 a real layout: journey 38 checks it in the browser.
 * Depends on:     vitest, @testing-library/react, ./ChoiceButtons, ./fixtures, ./FlightBand,
 *                 ./ResultPanel
 * Spec:           docs/spec/02e-game-mind-games.md §11.1; docs/spec/09-testing-strategy.md §4.2
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChoiceButtons } from './ChoiceButtons.js';
import { names, resultView, spectatorView } from './fixtures.js';
import { FLIGHT_MS } from './FlightBand.js';
import { LIGHT_MS, ResultPanel } from './ResultPanel.js';

type Moves = Parameters<typeof spectatorView>[0];

function reducedMotion(on: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: on && query.includes('reduce') }));
}

const flights = () =>
  [...screen.getByTestId('flight-band').querySelectorAll('.mg-flight')].map((f) => ({
    from: f.getAttribute('data-from'),
    to: f.getAttribute('data-to'),
    name: f.querySelector('.mg-flight-name')?.textContent ?? null,
  }));

// The stage's choice row, fed the round's views at the cuts given, one by one.
function feed(moves: Moves, cfg?: Parameters<typeof spectatorView>[2]) {
  const row = (cut: number) => (
    <ChoiceButtons
      view={spectatorView(moves, cut, cfg)}
      own={null}
      choose={null}
      canAct
      names={names}
    />
  );
  const r = render(row(0));
  return (cut: number) => {
    r.rerender(row(cut));
  };
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

describe('Mind Games flights (02e §11.1)', () => {
  it('flies only when a step arrives: a first choice in with its name, a switch from → to', () => {
    const step = feed(
      [
        ['anna', 'summer'],
        ['anna', 'winter'],
      ],
      { switchVisibility: 'visible' },
    );
    expect(flights()).toEqual([]);
    step(500);
    expect(flights()).toEqual([{ from: '', to: 'summer', name: 'Anna' }]);
    step(1_500);
    expect(flights()).toEqual([{ from: 'summer', to: 'winter', name: null }]);
    act(() => {
      vi.advanceTimersByTime(FLIGHT_MS + 100);
    });
    expect(flights()).toEqual([]);
    // The same step again flies nothing.
    step(1_500);
    expect(flights()).toEqual([]);
  });

  it('flies a hidden switch without any name, as the counts show it', () => {
    const step = feed([
      ['anna', 'summer'],
      ['anna', 'autumn', true],
    ]);
    step(500);
    step(1_500);
    expect(flights()).toEqual([{ from: 'summer', to: 'autumn', name: null }]);
    expect(screen.getByTestId('count-autumn').textContent).toBe('30 s ago: 1');
  });
});

describe('Mind Games waves and reduced motion (02e §11.1)', () => {
  it('caps a wave at 12 icons with "+8", and shows the step’s exact counts at once', () => {
    const players = Array.from({ length: 20 }, (_, i) => `p${String(i)}`);
    const step = feed(
      [
        ...players.map((p) => [p, 'spring'] as const),
        ...players.map((p) => [p, 'summer'] as const),
      ],
      { switchVisibility: 'visible' },
    );
    step(20_000);
    act(() => {
      vi.advanceTimersByTime(FLIGHT_MS + 100);
    });
    step(40_000);
    expect(flights()).toHaveLength(12);
    expect(screen.getByText('+8')).toBeTruthy();
    expect(screen.getByTestId('count-summer').textContent).toBe('30 s ago: 20');
    expect(screen.getByTestId('count-spring').textContent).toBe('30 s ago: 0');
  });

  it('flies nothing with reduced motion; the counts change in place', () => {
    reducedMotion(true);
    const step = feed([['anna', 'summer']]);
    step(500);
    expect(flights()).toEqual([]);
    expect(screen.getByTestId('count-summer').textContent).toBe('30 s ago: 1');
  });
});

describe('Mind Games winners light up (02e §11.1)', () => {
  const r = resultView([
    ['anna', 'summer'],
    ['bo', 'winter'],
    ['cy', 'winter'],
  ]);
  const lit = () =>
    [...document.querySelectorAll('.smg-anim-win')].map((e) => e.getAttribute('data-choice'));

  it('lights the winning options for about 2 s once the result shows', () => {
    render(<ResultPanel view={r} names={names} colors={{}} viewerKey={null} part="reveal" />);
    expect(lit()).toEqual(['summer']);
    act(() => {
      vi.advanceTimersByTime(LIGHT_MS);
    });
    expect(lit()).toEqual([]);
    expect(screen.getByText('✓ wins')).toBeTruthy();
  });

  it('lights nothing with reduced motion', () => {
    reducedMotion(true);
    render(<ResultPanel view={r} names={names} colors={{}} viewerKey={null} part="reveal" />);
    expect(lit()).toEqual([]);
  });
});
