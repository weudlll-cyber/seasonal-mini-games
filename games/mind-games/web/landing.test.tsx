// @vitest-environment jsdom
/**
 * @file   games/mind-games/web/landing.test.tsx
 * @module games/mind-games/web
 * @brief  Where Mind Games flights start and land, how crowds group, how the icon changes.
 *
 * Responsibility: DECISIONS T377 (02e §11.1): one step's moves with the same from → to fly as
 *                 one nameless icon "×N"; a lone icon lands on its card's measured middle,
 *                 several symmetric around it, one icon's room apart where the card has it,
 *                 never closer than a fifth's overlap, smaller where even that does not
 *                 fit; two waves near each other keep clear of each other's points; a named
 *                 and a nameless flight on the same path fly the same line, the flight's box
 *                 being its icon's and the name hanging off it, with no fade of its own; after
 *                 FLIGHT_MS nothing of a wave is drawn; the icon flips, never faint, and from
 *                 the middle on only the new season's shows. jsdom lays nothing out: the cards
 *                 are given boxes; it runs no CSS animation: the timeline is read from
 *                 flights.css itself.
 * Depends on:     vitest, @testing-library/react, ./ChoiceButtons, ./fixtures, ./FlightBand,
 *                 ./flights, ./flights.css (raw text, ../vitest.config.ts)
 * Spec:           docs/spec/02e-game-mind-games.md §11.1; docs/spec/09-testing-strategy.md §4.2
 */
import { optionsOf } from '@smg-game/mind-games';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChoiceButtons } from './ChoiceButtons.js';
import { names, spectatorView } from './fixtures.js';
import { FLIGHT_MS } from './FlightBand.js';
import css from './flights.css?raw';
import { ICON_PX, placeWave, spread, type Flight, type Layout } from './flights.js';

type Moves = Parameters<typeof spectatorView>[0];

// A rule's declarations as written, found by its selector at the start of a line.
function rule(selector: string): Record<string, string> {
  const at = css.indexOf(`\n${selector} {`);
  expect(at, selector).toBeGreaterThan(-1);
  const body = css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at));
  return Object.fromEntries(
    body
      .split(';')
      .map((d) => d.split(':').map((s) => s.trim()))
      .filter((d) => d.length >= 2)
      .map(([k, ...v]) => [k ?? '', v.join(':')]),
  );
}

// A keyframes' stops of one property: [share of the timeline, value], in order.
function stopsOf(name: string, prop: string): [number, number][] {
  const at = css.indexOf(`@keyframes ${name} {`);
  expect(at, name).toBeGreaterThan(-1);
  const body = css.slice(css.indexOf('{', at) + 1, css.indexOf('\n}', at));
  const stops: [number, number][] = [];
  for (const [, keys = '', decls = ''] of body.matchAll(/([\w%.,\s]+)\{([^}]*)\}/g)) {
    const value = new RegExp(`(?:^|[;\\s])${prop}:\\s*([\\d.]+)`).exec(decls)?.[1];
    if (value === undefined) continue;
    for (const k of keys.split(',').map((s) => s.trim())) {
      const share = k === 'from' ? 0 : k === 'to' ? 1 : parseFloat(k) / 100;
      stops.push([share, Number(value)]);
    }
  }
  return stops.sort((a, b) => a[0] - b[0]);
}

// A property's value at a share of a keyframes' timeline, linear between its stops.
function valueAt(name: string, prop: string, t: number): number {
  const stops = stopsOf(name, prop);
  const after = stops.findIndex(([s]) => s >= t);
  if (after === -1) return stops.at(-1)?.[1] ?? 1;
  const [s1, v1] = stops[after] ?? [t, 1];
  const [s0, v0] = stops[after - 1] ?? [s1, v1];
  return s1 === s0 ? v1 : v0 + ((v1 - v0) * (t - s0)) / (s1 - s0);
}

const animationOf = (selector: string) => rule(selector)['animation']?.split(' ')[0] ?? '';

// The band's flights as drawn: landing point, name and count.
const drawn = () =>
  [...screen.getByTestId('flight-band').querySelectorAll<HTMLElement>('.mg-flight')].map((f) => ({
    to: f.getAttribute('data-to'),
    end: f.style.getPropertyValue('--mg-to'),
    name: f.querySelector('.mg-flight-name')?.textContent ?? null,
    count: f.querySelector('.mg-flight-count')?.textContent ?? null,
  }));

function feed(moves: Moves) {
  const row = (cut: number) => (
    <ChoiceButtons view={spectatorView(moves, cut)} own={null} choose={null} canAct names={names} />
  );
  const r = render(row(0));
  return (cut: number) => {
    r.rerender(row(cut));
  };
}

const one = (from: Flight['from'], to: Flight['to'], key = `${from ?? 'edge'}>${to}`): Flight => ({
  key,
  from,
  to,
  player: null,
  count: 1,
});

// Four cards 190 px wide, 10 px apart, in a band 790 px wide.
const options = optionsOf(false);
const layout: Layout = {
  width: 790,
  columns: options.map((_, i) => ({ middle: i * 200 + 95, room: 200 })),
  edge: { middle: 850, room: 100 },
  labelPx: () => 60,
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  // jsdom lays nothing out: the cards get the boxes above, the band its width.
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const i = options.indexOf(this.getAttribute('data-choice') as (typeof options)[number]);
    const card = this.classList.contains('mg-frame') && i >= 0;
    const band = this.classList.contains('mg-band');
    return DOMRect.fromRect({ x: card ? i * 200 : 0, width: card ? 190 : band ? 790 : 0 });
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Mind Games crowds (T377)', () => {
  it('flies one step’s first choices into one season as one nameless icon "×N"', () => {
    const step = feed(Array.from({ length: 6 }, (_, i) => [`p${String(i)}`, 'summer'] as const));
    step(5_500);
    expect(drawn()).toEqual([{ to: 'summer', end: '295px', name: null, count: '×6' }]);
  });

  it('lands a lone icon on its card’s measured middle', () => {
    const step = feed([['anna', 'winter']]);
    step(500);
    expect(drawn()).toEqual([{ to: 'winter', end: '695px', name: 'Anna', count: null }]);
  });
});

describe('Mind Games landing points (T377)', () => {
  it('spreads several icons symmetrically around the middle, apart, and starts them apart', () => {
    const wave = {
      flights: [one('spring', 'winter'), one('summer', 'winter'), one(null, 'winter')],
      more: 0,
    };
    const { placed } = placeWave(wave, options, layout, new Map());
    const xs = placed.map((p) => p.end.x).sort((a, b) => a - b);
    expect((xs[0] ?? 0) + (xs[2] ?? 0)).toBe(2 * 695);
    expect(xs[1]).toBe(695);
    expect((xs[1] ?? 0) - (xs[0] ?? 0)).toBe(ICON_PX + 4);
  });

  it('keeps clear of the points a wave just before holds', () => {
    const first = placeWave(
      { flights: [one('spring', 'winter')], more: 0 },
      options,
      layout,
      new Map(),
    );
    const taken = new Map([['to:winter', first.claims.map(([, s]) => s)]]);
    const second = placeWave(
      { flights: [one('summer', 'winter')], more: 0 },
      options,
      layout,
      taken,
    );
    const gap = Math.abs((second.placed[0]?.end.x ?? 0) - (first.placed[0]?.end.x ?? 0));
    expect(gap).toBeGreaterThanOrEqual(Math.ceil(ICON_PX * 0.8));
  });
});

describe('Mind Games crowded cards and lines (T377)', () => {
  it('closes up to a fifth’s overlap in a narrow card, then shrinks the icons to fit', () => {
    const narrow = { middle: 35, room: 70 };
    const three = spread(narrow, 3, ICON_PX);
    expect(three.map((s) => [s.x, s.scale])).toEqual([
      [13, 1],
      [35, 1],
      [57, 1],
    ]);
    // Six into a phone's card: smaller, all inside it, overlapping by at most a fifth.
    const six = spread(narrow, 6, ICON_PX);
    const size = ICON_PX * (six[0]?.scale ?? 1);
    expect(size).toBeLessThan(ICON_PX);
    for (const [i, s] of six.entries()) {
      expect(s.x - size / 2).toBeGreaterThanOrEqual(0);
      expect(s.x + size / 2).toBeLessThanOrEqual(70);
      if (i > 0) expect(s.x - (six[i - 1]?.x ?? 0)).toBeGreaterThanOrEqual(0.8 * size - 1e-9);
    }
  });

  it('shows no more icons in a card than fit unshrunk past 82 %; the rest join "+N"', () => {
    // A phone's All card: 60 px for three groups of All's 36 px square.
    const phone: Layout = { ...layout, columns: [{ middle: 30, room: 60 }] };
    const all = (from: Flight['from'], count: number): Flight => ({ ...one(from, 'all'), count });
    const wave = { flights: [all('spring', 3), all('summer', 2), all(null, 4)], more: 0 };
    const { placed, rest } = placeWave(wave, ['all'], phone, new Map());
    expect(placed.map((p) => p.flight.from)).toEqual(['spring', 'summer']);
    expect(rest).toBe(4);
    for (const p of placed) expect(p.end.scale).toBeGreaterThanOrEqual(0.82);
  });
});

describe('Mind Games names in one card and lines (T377)', () => {
  it('keeps two named icons in one card as far apart as their names need', () => {
    const named = (from: Flight['from'], player: string): Flight => ({
      ...one(from, 'winter'),
      player,
    });
    const wave = { flights: [named('spring', 'anna'), named('summer', 'bo')], more: 0 };
    const xs = placeWave(wave, options, layout, new Map()).placed.map((p) => p.end.x);
    expect(Math.abs((xs[1] ?? 0) - (xs[0] ?? 0))).toBe(64);
    expect(((xs[0] ?? 0) + (xs[1] ?? 0)) / 2).toBe(695);
  });

  it('flies a named and a nameless flight on the same path along the same line', () => {
    const named = placeWave(
      { flights: [{ ...one('summer', 'winter'), player: 'anna' }], more: 0 },
      options,
      layout,
      new Map(),
    );
    const nameless = placeWave(
      { flights: [one('summer', 'winter')], more: 0 },
      options,
      layout,
      new Map(),
    );
    expect(named.placed[0]?.start).toEqual(nameless.placed[0]?.start);
    expect(named.placed[0]?.end).toEqual(nameless.placed[0]?.end);
    // The box is the icon's, placed on its centre; the name hangs off it, moving nothing.
    const box = rule('.mg-flight');
    expect([box['width'], box['height'], box['margin-left']]).toEqual(['26px', '26px', '-13px']);
    expect(rule('.mg-flight-name')['position']).toBe('absolute');
  });
});

describe('Mind Games icon change and landing (T377)', () => {
  it('draws nothing of a wave after FLIGHT_MS; the name fades only with its icon', () => {
    const step = feed([['anna', 'summer']]);
    step(500);
    expect(drawn()).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(FLIGHT_MS);
    });
    expect(drawn()).toEqual([]);
    for (const name of [animationOf('.mg-flight'), 'mg-rise'])
      expect(valueAt(name, 'opacity', 1)).toBe(0);
    // The name is part of the flight: no fade of its own, so it shows exactly as its icon.
    expect(rule('.mg-flight-name')['animation']).toBeUndefined();
  });

  it('flips the icon, never faint, and shows only the new season’s from the middle on', () => {
    const old = animationOf('.mg-flight-from');
    const next = animationOf('.mg-flight-from + .mg-flight-to');
    for (let t = 0; t <= 1; t += 0.01)
      expect(Math.max(valueAt(old, 'opacity', t), valueAt(next, 'opacity', t))).toBeGreaterThan(
        0.95,
      );
    for (const t of [0.5, 0.65, 0.8, 1]) {
      expect(valueAt(old, 'opacity', t), `old icon at ${String(t)}`).toBe(0);
      expect(valueAt(next, 'opacity', t), `new icon at ${String(t)}`).toBe(1);
    }
  });
});
