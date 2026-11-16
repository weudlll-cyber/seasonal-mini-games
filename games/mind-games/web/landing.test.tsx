// @vitest-environment jsdom
/**
 * @file   games/mind-games/web/landing.test.tsx
 * @module games/mind-games/web
 * @brief  Where Mind Games flights start and land, and how they change their icon and land.
 *
 * Responsibility: DECISIONS T376 (02e §11.1): flights into one column land at distinct points,
 *                 also across two waves in the air at once, and start at distinct points; the
 *                 slots are one icon's room apart where the column has it, rows a few px apart
 *                 where it has not; a named and a nameless flight on the same path fly the same
 *                 line, the flight's box being its icon's and the name hanging off it; after
 *                 FLIGHT_MS nothing of a wave is drawn, its icon and name having faded out;
 *                 from the middle of a flight on only the new season's icon shows. jsdom runs
 *                 no CSS animation: the timeline is read from flights.css itself.
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
import { placeWave, SLOT_PX, spotOf, type Flight } from './flights.js';

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
  for (const [, keys = '', decls = ''] of body.matchAll(/([\w%,\s]+)\{([^}]*)\}/g)) {
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

// Each flight's start and landing point as drawn: its CSS variables.
const points = () =>
  [...screen.getByTestId('flight-band').querySelectorAll<HTMLElement>('.mg-flight')].map((f) => ({
    start: `${f.style.getPropertyValue('--mg-from')} ${f.style.getPropertyValue('--mg-y0')}`,
    end: `${f.style.getPropertyValue('--mg-to')} ${f.style.getPropertyValue('--mg-y1')}`,
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

// Players p0, p1, … choosing one season, a second apart.
const choosing = (from: number, count: number, season: string): Moves =>
  Array.from({ length: count }, (_, i) => [`p${String(from + i)}`, season] as const);

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  // jsdom lays nothing out: the band is 800 px wide, room for six slots a column of four.
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(800);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Mind Games flight slots (T376)', () => {
  it('lands the flights of one wave into one column at distinct points, starting apart too', () => {
    const step = feed(choosing(0, 6, 'summer'));
    step(5_500);
    const drawn = points();
    expect(drawn).toHaveLength(6);
    expect(new Set(drawn.map((d) => d.end)).size).toBe(6);
    expect(new Set(drawn.map((d) => d.start)).size).toBe(6);
  });

  it('keeps the slots distinct across two waves in the air at once', () => {
    const step = feed(choosing(0, 12, 'summer'));
    step(5_500);
    act(() => {
      vi.advanceTimersByTime(FLIGHT_MS / 2);
    });
    step(11_500);
    const drawn = points();
    expect(drawn).toHaveLength(12);
    expect(new Set(drawn.map((d) => d.end)).size).toBe(12);
    expect(new Set(drawn.map((d) => d.start)).size).toBe(12);
  });
});

describe('Mind Games slot geometry (T376)', () => {
  it('spaces slots one icon apart where the column has room, rows where it has not', () => {
    // 1 440 wide, four seasons: one row of slots at least an icon apart.
    const wide = [0, 1, 2, 3, 4, 5].map((j) => spotOf(1, 4, 826, j).x * 826).sort((a, b) => a - b);
    for (let i = 1; i < wide.length; i += 1)
      expect((wide[i] ?? 0) - (wide[i - 1] ?? 0)).toBeGreaterThanOrEqual(26);
    // More flights than slots: six rows on six times the slots' points, with two slots a
    // column (a phone, five options) and with five (1 440 wide, five options).
    const point = (s: { x: number; y: number }) => `${String(s.x)} ${String(s.y)}`;
    for (const [band, per] of [
      [362, 2],
      [826, 5],
    ] as const) {
      const spots = Array.from({ length: 6 * per }, (_, j) => spotOf(3, 5, band, j));
      expect(new Set(spots.map(point)).size).toBe(6 * per);
      for (const s of spots) expect(s.x).toBeGreaterThan(3 / 5);
      for (const s of spots) expect(s.x).toBeLessThan(4 / 5);
    }
    expect(SLOT_PX).toBeGreaterThanOrEqual(26);
  });

  it('flies a named and a nameless flight on the same path along the same line', () => {
    const options = optionsOf(false);
    const one = (player: string | null): Flight => ({
      key: 'k',
      from: 'summer',
      to: 'winter',
      player,
    });
    const named = placeWave({ flights: [one('anna')], more: 0 }, options, 800, new Map());
    const nameless = placeWave({ flights: [one(null)], more: 0 }, options, 800, new Map());
    expect(named.placed[0]?.start).toEqual(nameless.placed[0]?.start);
    expect(named.placed[0]?.end).toEqual(nameless.placed[0]?.end);
    // The box is the icon's, placed on its centre; the name hangs off it, moving nothing.
    const box = rule('.mg-flight');
    expect([box['width'], box['height'], box['margin-left']]).toEqual(['26px', '26px', '-13px']);
    expect(box['transform']).toBeUndefined();
    expect(rule('.mg-flight-name')['position']).toBe('absolute');
  });
});

describe('Mind Games icon change and landing (T376)', () => {
  it('draws nothing of a wave after FLIGHT_MS: its icon and its name have faded out', () => {
    const step = feed(choosing(0, 1, 'summer'));
    step(500);
    expect(points()).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(FLIGHT_MS);
    });
    expect(points()).toEqual([]);
    for (const name of [animationOf('.mg-flight'), 'mg-rise'])
      expect(valueAt(name, 'opacity', 1)).toBe(0);
    // The name is gone before the landing (80 %).
    expect(valueAt(animationOf('.mg-flight-name'), 'opacity', 0.8)).toBe(0);
  });

  it('shows only the new season’s icon from the middle of a flight on', () => {
    const old = animationOf('.mg-flight-from');
    const next = animationOf('.mg-flight-from + .mg-flight-to');
    for (const t of [0.5, 0.65, 0.8, 1]) {
      expect(valueAt(old, 'opacity', t), `old icon at ${String(t)}`).toBe(0);
      expect(valueAt(next, 'opacity', t), `new icon at ${String(t)}`).toBe(1);
    }
  });
});
