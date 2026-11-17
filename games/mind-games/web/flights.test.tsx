// @vitest-environment jsdom
/**
 * @file   games/mind-games/web/flights.test.tsx
 * @module games/mind-games/web
 * @brief  Mind Games' flights: what flies, with which name, where it lands, and for how long.
 *
 * Responsibility: 02e §11.1's rules on real views of a played round: one flight per from → to
 *                 in a step, "×N" without a name from two on; a name on a single first choice
 *                 or visible switch, never on a hidden switch or the phone layout; a lone
 *                 flight on its card's middle, several evenly around it, shrinking down to
 *                 82 % at most with a fifth's overlap, the rest as the card's "+N"; and the
 *                 band: a wave per released step, never cut short by the next, nothing left
 *                 after FLIGHT_MS, nothing with reduced motion. jsdom lays nothing out: the
 *                 cards are given boxes. The motion itself is measured in the browser (journey
 *                 44).
 * Depends on:     vitest, @testing-library/react, ./ChoiceButtons, ./fixtures, ./FlightBand,
 *                 ./flights
 * Spec:           docs/spec/02e-game-mind-games.md §11.1; docs/spec/09-testing-strategy.md §4.2
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChoiceButtons } from './ChoiceButtons.js';
import { names, spectatorView } from './fixtures.js';
import { FLIGHT_MS } from './FlightBand.js';
import { ICON_PX, placeWave, spread, waveOf, type Flight, type Layout } from './flights.js';

type Moves = Parameters<typeof spectatorView>[0];
type Cfg = Parameters<typeof spectatorView>[2];

const VISIBLE: Cfg = { switchVisibility: 'visible' };
const SEASONS = ['spring', 'summer', 'autumn', 'winter', 'all'];

// The wave between two cuts of one round, without the coins' places.
const wave = (moves: Moves, cuts: [number, number], cfg?: Cfg, phone = false) =>
  waveOf(spectatorView(moves, cuts[0], cfg), spectatorView(moves, cuts[1], cfg), phone).map(
    ({ from, to, player, count }) => ({ from, to, player, count }),
  );

// Every media query false but those `on` names.
function media(on: readonly string[]): void {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: on.some((w) => q.includes(w)) }));
}

const drawn = () =>
  [...screen.getByTestId('flight-band').querySelectorAll<HTMLElement>('.mg-flight')].map((f) => ({
    to: f.getAttribute('data-to'),
    at: f.style.getPropertyValue('--mg-to'),
    name: f.querySelector('.mg-flight-name')?.textContent ?? null,
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
  // Five cards 190 px wide, 10 px apart, in a band 990 px wide.
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const i = SEASONS.indexOf(this.getAttribute('data-choice') ?? '');
    const card = this.classList.contains('mg-frame') && i >= 0;
    const band = this.classList.contains('mg-band');
    return DOMRect.fromRect({ x: card ? i * 200 : 0, width: card ? 190 : band ? 990 : 0 });
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Mind Games flights: groups and names', () => {
  it('flies one step’s moves on one path as one nameless flight "×N"', () => {
    const six = Array.from({ length: 6 }, (_, i) => [`p${String(i)}`, 'summer'] as const);
    expect(wave(six, [0, 5_500])).toEqual([{ from: null, to: 'summer', player: null, count: 6 }]);
  });

  it('names a single first choice and a visible switch', () => {
    const moves: Moves = [
      ['anna', 'summer'],
      ['anna', 'winter'],
    ];
    expect(wave(moves, [0, 500], VISIBLE)).toEqual([
      { from: null, to: 'summer', player: 'anna', count: 1 },
    ]);
    expect(wave(moves, [500, 1_500], VISIBLE)).toEqual([
      { from: 'summer', to: 'winter', player: 'anna', count: 1 },
    ]);
  });

  it('never names a hidden switch, whether the round or the player hides it', () => {
    const moves: Moves = [
      ['anna', 'summer'],
      ['anna', 'winter'],
    ];
    const nameless = [{ from: 'summer', to: 'winter', player: null, count: 1 }];
    expect(wave(moves, [500, 1_500], { switchVisibility: 'hidden' })).toEqual(nameless);
    const hides: Moves = [
      ['anna', 'summer'],
      ['anna', 'winter', true],
    ];
    expect(wave(hides, [500, 1_500], { switchVisibility: 'perPlayer' })).toEqual(nameless);
  });

  it('names no flight on the phone layout', () => {
    expect(wave([['anna', 'summer']], [0, 500], VISIBLE, true)).toEqual([
      { from: null, to: 'summer', player: null, count: 1 },
    ]);
  });
});

const flight = (from: Flight['from'], to: Flight['to'], count = 1): Flight => ({
  key: `${from ?? 'edge'}>${to}`,
  from,
  to,
  player: null,
  count,
});
const layout = (room: number): Layout => ({
  width: 990,
  cards: {
    spring: { middle: 95, room: 184 },
    summer: { middle: 295, room: 184 },
    all: { middle: 895, room },
  },
  labelPx: () => 60,
});

describe('Mind Games flights: landing', () => {
  it('lands a lone flight on its card’s middle, from its old card’s middle', () => {
    const { placed } = placeWave([flight('spring', 'summer')], layout(184));
    expect(placed.map((p) => [p.from, p.to, p.scale])).toEqual([[95, 295, 1]]);
  });

  it('spreads several evenly and symmetrically around the middle, full size where they fit', () => {
    const { xs, scale } = spread({ middle: 295, room: 184 }, 3, ICON_PX);
    expect(xs).toEqual([265, 295, 325]);
    expect(scale).toBe(1);
  });

  it('shrinks them only as far as needed, overlapping by at most a fifth', () => {
    const card = { middle: 35, room: 70 };
    const { xs, scale } = spread(card, 3, ICON_PX);
    expect(scale).toBe(1);
    expect(xs).toEqual([13, 35, 57]);
    const four = spread(card, 4, ICON_PX);
    const size = ICON_PX * four.scale;
    expect(four.scale).toBeLessThan(1);
    for (const [i, x] of four.xs.entries()) {
      expect(x - size / 2).toBeGreaterThanOrEqual(-1e-9);
      expect(x + size / 2).toBeLessThanOrEqual(70 + 1e-9);
      if (i > 0) expect(x - (four.xs[i - 1] ?? 0)).toBeGreaterThanOrEqual(0.8 * size - 1e-9);
    }
  });

  it('never shrinks below 82 %: flights that would not fit join the card’s "+N"', () => {
    const flights = [
      flight('spring', 'all', 3),
      flight('summer', 'all', 2),
      flight(null, 'all', 4),
    ];
    const { placed, more } = placeWave(flights, layout(60));
    expect(placed.map((p) => p.flight.from)).toEqual(['spring', 'summer']);
    for (const p of placed) expect(p.scale).toBeGreaterThanOrEqual(0.82);
    expect(more).toEqual([{ card: { middle: 895, room: 60 }, n: 4 }]);
  });
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
    expect(drawn()).toEqual([{ to: 'summer', at: '295px', name: 'Anna' }]);
    expect(screen.getByTestId('flight-band').style.getPropertyValue('--mg-flight')).toBe('1200ms');
    later(FLIGHT_MS / 2);
    step(1_500);
    expect(drawn()).toHaveLength(2);
    later(FLIGHT_MS / 2);
    expect(drawn()).toEqual([{ to: 'winter', at: '695px', name: 'Anna' }]);
    later(FLIGHT_MS / 2);
    expect(drawn()).toEqual([]);
    step(1_500);
    expect(drawn()).toEqual([]);
  });

  it('flies nothing with reduced motion; the counts change in place', () => {
    media(['reduce']);
    const step = feed([['anna', 'summer']]);
    step(500);
    expect(drawn()).toEqual([]);
    expect(screen.getByTestId('count-summer').textContent).toBe('1 player, 30 s ago');
  });
});
