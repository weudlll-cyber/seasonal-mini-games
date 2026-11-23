// @vitest-environment jsdom
/**
 * @file   games/mind-games/web/stripMoments.test.tsx
 * @module games/mind-games/web
 * @brief  The phase strip against the round bar at the moments MG-STRIP-CHECK measured.
 *
 * Responsibility: for a round of total 60 s and of total 40 s, both with the default hold of
 *                 5 s (join half the total, delay a quarter, choices close at total − delay, the
 *                 plan ends at the total, the result at total + hold, 02e §4): at the opening,
 *                 the join's end, mid-play, the play's end, mid-reveal, the plan's end and in
 *                 the hold, the bar's text (the platform's rule, apps/web roundText `barTime`:
 *                 the time to the plan's end through `clockText`, in the hold "Result in 0:04"),
 *                 the strip's three segments with their ends, the segment that is "now", its
 *                 fill (by value, to three decimals of a percent), how many parts are done and
 *                 the line under the strip. The bar's "left"
 *                 ends where the strip does; in the hold no part is "now" and all three are done
 *                 (owner, 2026-11-18, DECISIONS T386).
 * Depends on:     vitest, @testing-library/react, @smg/game-sdk, ./fixtures, ./PhaseStrip
 * Spec:           docs/spec/02e-game-mind-games.md §4, §11
 */
import { clockText, type PhasedTiming } from '@smg/game-sdk';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { spectatorView } from './fixtures.js';
import { PhaseStrip } from './PhaseStrip.js';

afterEach(cleanup);

interface Moment {
  readonly at: number;
  readonly bar: string;
  readonly now: string;
  readonly fill: string;
  readonly done: number;
  readonly line: string;
}

const HOLD_MS = 5_000;

// The round bar's text at `at` (the platform's `barTime`, which the game cannot import): the
// time to the plan's end, then in the hold the time to the result.
const barAt = (planEnd: number, at: number): string =>
  at < planEnd ? clockText(planEnd - at) : `Result in ${clockText(planEnd + HOLD_MS - at)}`;

// The strip at `at` ms after the opening of a round of `totalS` with a hold of 5 s.
function strip(totalS: number, at: number) {
  const view = spectatorView([], 0, { totalS });
  const timing: PhasedTiming = {
    opensAt: 0,
    plan: view.rules.plan,
    endsAt: totalS * 1_000 + HOLD_MS,
    now: () => at,
  };
  render(<PhaseStrip view={view} timing={timing} />);
  const parts = [...document.querySelectorAll('.mg-phase')];
  const now = parts.find((p) => p.getAttribute('aria-current') === 'step');
  return {
    bar: barAt(view.rules.plan.endMs, at),
    segments: parts.map((p) => p.textContent.replace(' · now', '')),
    now: now?.querySelector('.mg-phase-name')?.textContent.replace(' · now', '') ?? '',
    fill: now?.querySelector<HTMLElement>('.mg-phase-fill')?.style.width ?? '',
    done: parts.filter((p) => p.getAttribute('data-done') === 'true').length,
    line: screen.getByTestId('next-change').textContent,
  };
}

// A fill's width as a number, null for none: the DOM may print the percentage rounded (jsdom 31
// gives "1.66667%" for 1.6666666666666667%), so it is compared by value, not as text.
const percent = (width: string): number | null => (width === '' ? null : Number.parseFloat(width));

// Each moment of a round of `totalS`: the strip's parts, and what the screen shows then.
function agrees(totalS: number, segments: readonly string[], moments: readonly Moment[]): void {
  for (const { at, fill, ...shown } of moments) {
    const { segments: seen, fill: width, ...rest } = strip(totalS, at);
    expect(seen).toEqual(segments);
    expect(rest, String(at)).toEqual(shown);
    const want = percent(fill);
    if (want === null) expect(percent(width), String(at)).toBeNull();
    else expect(percent(width), String(at)).toBeCloseTo(want, 3);
    cleanup();
  }
}

// In the hold: no part is "now", all three are done, the bar and the line count to the result.
const held = (at: number, s: number): Moment => ({
  at,
  bar: `Result in 0:0${String(s)}`,
  now: '',
  fill: '',
  done: 3,
  line: `Choices closed · result in 0:0${String(s)}`,
});

// Total 60, hold 5: join 30, choices close 45, the plan ends at 60, the result at 65.
const SIXTY = ['Join until 0:30', 'Play until 0:45', 'Reveal until 1:00'];
const SIXTY_AT: readonly Moment[] = [
  {
    at: 500,
    bar: '0:59',
    now: 'Join',
    fill: '1.6666666666666667%',
    done: 0,
    line: 'Joining closes in 0:29 · Choices close in 0:44',
  },
  {
    at: 29_700,
    bar: '0:30',
    now: 'Join',
    fill: '99%',
    done: 0,
    line: 'Joining closes in 0:00 · Choices close in 0:15',
  },
  { at: 37_500, bar: '0:22', now: 'Play', fill: '50%', done: 1, line: 'Choices close in 0:07' },
  { at: 45_300, bar: '0:14', now: 'Reveal', fill: '2%', done: 2, line: 'Reveal · result in 0:19' },
  { at: 52_500, bar: '0:07', now: 'Reveal', fill: '50%', done: 2, line: 'Reveal · result in 0:12' },
  { at: 59_700, bar: '0:00', now: 'Reveal', fill: '98%', done: 2, line: 'Reveal · result in 0:05' },
  held(60_300, 4),
  held(62_500, 2),
];

// Total 40, hold 5: join 20, choices close 30, the plan ends at 40, the result at 45.
const FORTY = ['Join until 0:20', 'Play until 0:30', 'Reveal until 0:40'];
const FORTY_AT: readonly Moment[] = [
  {
    at: 500,
    bar: '0:39',
    now: 'Join',
    fill: '2.5%',
    done: 0,
    line: 'Joining closes in 0:19 · Choices close in 0:29',
  },
  // The owner's screenshot at 19.7 s: the bar now says "0:20 left", the strip ends at 0:40.
  {
    at: 19_700,
    bar: '0:20',
    now: 'Join',
    fill: '98.5%',
    done: 0,
    line: 'Joining closes in 0:00 · Choices close in 0:10',
  },
  { at: 25_000, bar: '0:15', now: 'Play', fill: '50%', done: 1, line: 'Choices close in 0:05' },
  { at: 30_300, bar: '0:09', now: 'Reveal', fill: '3%', done: 2, line: 'Reveal · result in 0:14' },
  { at: 35_000, bar: '0:05', now: 'Reveal', fill: '50%', done: 2, line: 'Reveal · result in 0:10' },
  held(40_300, 4),
  held(42_500, 2),
];

describe('the phase strip and the round bar at the measured moments (T386)', () => {
  it('agree in a round of 60 s with a hold of 5 s', () => {
    agrees(60, SIXTY, SIXTY_AT);
  });

  it('agree in a round of 40 s with a hold of 5 s, the owner’s screen at 19.7 s', () => {
    agrees(40, FORTY, FORTY_AT);
  });
});
