/**
 * @file   games/mind-games/web/flights.test.ts
 * @module games/mind-games/web
 * @brief  Mind Games' flights' rules: what flies, with which name, where it lands, how long.
 *
 * Responsibility: ./flights on real views of a played round (02e §11.1): one flight per
 *                 from → to in a step, "×N" without a name from two on; a name on a single
 *                 first choice or visible switch, never on a hidden switch or the phone layout,
 *                 and only where its label fits inside the card; a lone flight on its card's
 *                 middle, several evenly around it inside the card, shrinking down to 82 % at
 *                 most with a fifth's overlap, the rest as the card's "+N" in its last slot; the
 *                 times, and a standing coin fading at once where a newer one lands. The band
 *                 that draws them: ./FlightBand.test; the motion: journey 44.
 * Depends on:     vitest, ./fixtures, ./flights
 * Spec:           docs/spec/02e-game-mind-games.md §11.1; docs/spec/09-testing-strategy.md §4.2
 */
import { describe, expect, it } from 'vitest';

import { spectatorView } from './fixtures.js';
import {
  FLIGHT_MS,
  ICON_PX,
  landed,
  LIFE_MS,
  placeWave,
  spread,
  STAND_MS,
  waveOf,
  type Flight,
  type Layout,
  type Timed,
} from './flights.js';

type Moves = Parameters<typeof spectatorView>[0];
type Cfg = Parameters<typeof spectatorView>[2];

const VISIBLE: Cfg = { switchVisibility: 'visible' };

// The wave between two cuts of one round, without the coins' places.
const wave = (moves: Moves, cuts: [number, number], cfg?: Cfg, phone = false) =>
  waveOf(spectatorView(moves, cuts[0], cfg), spectatorView(moves, cuts[1], cfg), phone).map(
    ({ from, to, player, count }) => ({ from, to, player, count }),
  );

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

const flight = (from: Flight['from'], to: Flight['to'], count = 1, player?: string): Flight => ({
  key: `${from ?? 'edge'}>${to}`,
  from,
  to,
  player: player ?? null,
  count,
});
// Names 60 px wide, "×N" 30 px.
const layout = (room: number, card = 'all' as const): Layout => ({
  width: 990,
  cards: {
    spring: { middle: 95, room: 184 },
    summer: { middle: 295, room: 184 },
    [card]: { middle: 895, room },
  },
  labelPx: (f) => (f.count > 1 ? 30 : f.player === null ? 0 : 60),
});

// Every coin's and "+N"'s edges against its card's inner edges.
function inside(placed: ReturnType<typeof placeWave>, l: Layout, size: number): void {
  const xs = [
    ...placed.placed.map((p) => [p.to, p.scale]),
    ...placed.more.map((m) => [m.at, m.scale]),
  ];
  for (const [x = 0, scale = 1] of xs) {
    const card = l.cards.all ?? { middle: 0, room: 0 };
    expect(Math.abs(x - card.middle) + (size * scale) / 2).toBeLessThanOrEqual(
      card.room / 2 + 1e-9,
    );
  }
}

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

  it('never shrinks below 82 %: flights that would not fit join the "+N" in the last slot', () => {
    const flights = [
      flight('spring', 'all', 3),
      flight('summer', 'all', 2),
      flight(null, 'all', 4),
    ];
    const l = layout(60);
    const placed = placeWave(flights, l);
    expect(placed.placed.map((p) => p.flight.from)).toEqual(['spring']);
    for (const p of placed.placed) expect(p.scale).toBeGreaterThanOrEqual(0.82);
    expect(placed.more.map(({ to, n }) => [to, n])).toEqual([['all', 6]]);
    expect(placed.more[0]?.at).toBeGreaterThan(placed.placed[0]?.to ?? Infinity);
    inside(placed, l, 36);
  });

  it('lands coins and "+N" wholly inside the card, also where a "×N" is wider than a coin', () => {
    const l = { ...layout(90), labelPx: (f: Flight) => (f.count > 1 ? 44 : 0) };
    const flights = [flight('spring', 'all', 12), flight('summer', 'all', 2), flight(null, 'all')];
    const placed = placeWave(flights, l);
    expect([placed.placed.length, placed.more[0]?.n]).toEqual([1, 3]);
    // The slots are as wide as the widest "×N", which lies inside like its coin.
    inside(placed, l, 44);
  });
});

describe('Mind Games flights: names at the landing', () => {
  it('keeps a name only where its whole label lies inside the card, clear of its neighbours', () => {
    const one = (room: number) =>
      placeWave([flight('spring', 'all', 1, 'anna')], layout(room)).placed[0]?.flight.player;
    expect(one(184)).toBe('anna');
    expect(one(50)).toBeNull();
    const two = [flight('spring', 'all', 1, 'anna'), flight('summer', 'all', 1, 'bo')];
    expect(placeWave(two, layout(184)).placed.map((p) => p.flight.player)).toEqual(['anna', 'bo']);
    expect(placeWave(two, layout(100)).placed.map((p) => p.flight.player)).toEqual([null, null]);
    const three = [...two, flight('winter', 'all', 1, 'cy')];
    expect(placeWave(three, layout(184)).placed.map((p) => p.flight.player)).toEqual([
      null,
      'bo',
      null,
    ]);
  });
});

describe('Mind Games flights: their times', () => {
  const at = (id: number, start: number, cards: Timed['cards']): Timed => ({
    id,
    start,
    cards,
    gone: [],
  });

  it('flies 1.6 s, stands 0.5 s, fades 0.3 s', () => {
    expect([FLIGHT_MS, STAND_MS, LIFE_MS]).toEqual([1_600, 500, 2_400]);
  });

  it('fades a coin still standing where a newer one lands, in that card only', () => {
    const waves = [at(1, 0, ['summer', 'winter']), at(2, 300, ['summer'])];
    expect(landed(waves, 2).map((w) => w.gone)).toEqual([['summer'], []]);
  });

  it('leaves a coin that is already fading, and one landing after it, as they are', () => {
    const fading = [at(1, 0, ['summer']), at(2, STAND_MS, ['summer'])];
    expect(landed(fading, 2).map((w) => w.gone)).toEqual([[], []]);
    const newer = [at(1, 0, ['summer']), at(2, 300, ['summer'])];
    expect(landed(newer, 1).map((w) => w.gone)).toEqual([[], []]);
  });
});
