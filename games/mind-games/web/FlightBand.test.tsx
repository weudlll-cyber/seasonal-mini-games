// @vitest-environment jsdom
/**
 * @file   games/mind-games/web/FlightBand.test.tsx
 * @module games/mind-games/web
 * @brief  Mind Games' flight band: the waves it draws from released steps, and their lives.
 *
 * Responsibility: ./FlightBand in the stage's choice row, fed a played round's views step by
 *                 step (02e §11.1): a wave per released step, never cut short by the next, the
 *                 times handed to the CSS, a standing coin fading at once where the next step's
 *                 coin lands beside it, nothing left after LIFE_MS, nothing with reduced motion.
 *                 jsdom lays nothing out: the cards are given boxes. The rules: ./flights.test.
 * Depends on:     vitest, @testing-library/react, ./ChoiceButtons, ./fixtures, ./flights
 * Spec:           docs/spec/02e-game-mind-games.md §11.1; docs/spec/09-testing-strategy.md §4.2
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChoiceButtons } from './ChoiceButtons.js';
import { names, spectatorView } from './fixtures.js';
import { FLIGHT_MS, LIFE_MS } from './flights.js';

type Moves = Parameters<typeof spectatorView>[0];
type Cfg = Parameters<typeof spectatorView>[2];

const VISIBLE: Cfg = { switchVisibility: 'visible' };
const SEASONS = ['spring', 'summer', 'autumn', 'winter', 'all'];

// Every media query false but those `on` names.
function media(on: readonly string[]): void {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: on.some((w) => q.includes(w)) }));
}

const drawn = () =>
  [...screen.getByTestId('flight-band').querySelectorAll<HTMLElement>('.mg-flight')].map((f) => ({
    to: f.getAttribute('data-to'),
    at: f.style.getPropertyValue('--mg-to'),
    name: f.querySelector('.mg-flight-name')?.textContent ?? null,
    gone: f.getAttribute('data-gone'),
  }));

// The stage's choice row, fed the round's views at the cuts given, one by one.
function feed(moves: Moves, cfg?: Cfg) {
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

const later = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  media([]);
  // Five cards 190 px wide (186 inside their frames), 10 px apart, in a band 990 px wide.
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const i = SEASONS.indexOf(this.getAttribute('data-choice') ?? '');
    const card = this.classList.contains('mg-frame') && i >= 0;
    const band = this.classList.contains('mg-band');
    return DOMRect.fromRect({ x: card ? i * 200 : 0, width: card ? 190 : band ? 990 : 0 });
  });
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(function (this: Element) {
    return this.classList.contains('mg-frame') ? 186 : 0;
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Mind Games flights in the band', () => {
  it('flies a wave per released step, never cut short by the next, then leaves nothing', () => {
    const step = feed(
      [
        ['anna', 'summer'],
        ['anna', 'winter'],
      ],
      VISIBLE,
    );
    expect(drawn()).toEqual([]);
    step(500);
    expect(drawn()).toEqual([{ to: 'summer', at: '295px', name: 'Anna', gone: 'false' }]);
    const band = screen.getByTestId('flight-band').style;
    expect(['--mg-fly', '--mg-fade-at', '--mg-fade'].map((v) => band.getPropertyValue(v))).toEqual([
      '1600ms',
      '2100ms',
      '300ms',
    ]);
    later(1_000);
    step(1_500);
    expect(drawn()).toHaveLength(2);
    later(LIFE_MS - 1_000);
    expect(drawn()).toEqual([{ to: 'winter', at: '695px', name: 'Anna', gone: 'false' }]);
    later(1_000);
    expect(drawn()).toEqual([]);
    step(1_500);
    expect(drawn()).toEqual([]);
  });

  it('fades a standing coin at once where the next step’s coin lands beside it', () => {
    const step = feed([
      ['anna', 'summer'],
      ['bo', 'summer'],
    ]);
    step(500);
    later(300);
    step(1_500);
    later(FLIGHT_MS - 1);
    expect(drawn().map((f) => f.gone)).toEqual(['false', 'false']);
    later(1);
    expect(drawn().map((f) => f.gone)).toEqual(['true', 'false']);
  });

  it('flies nothing with reduced motion; the counts change in place', () => {
    media(['reduce']);
    const step = feed([['anna', 'summer']]);
    step(500);
    expect(drawn()).toEqual([]);
    expect(screen.getByTestId('count-summer').textContent).toBe('1 player, 30 s ago');
  });
});
