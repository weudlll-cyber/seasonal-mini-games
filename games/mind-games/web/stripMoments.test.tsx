// @vitest-environment jsdom
/**
 * @file   games/mind-games/web/stripMoments.test.tsx
 * @module games/mind-games/web
 * @brief  The phase strip against the round bar at the moments MG-STRIP-CHECK measured.
 *
 * Responsibility: for a round of total 60 s and of total 40 s, both with the default hold of
 *                 5 s (join half the total, delay a quarter, choices close at total − delay, the
 *                 plan ends at the total, the result at total + hold, 02e §4): at the opening,
 *                 the join's end, mid-play, the play's end, mid-reveal and mid-hold, the bar's
 *                 "… left" (the platform's `clockText` of the time to `endsAt`), the strip's
 *                 four segments with their ends, the segment that is "now", its fill and the
 *                 line under the strip; the strip ends at the bar's end (T385).
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
  readonly line: string;
}

// The strip at `at` ms after the opening of a round of `totalS` with a hold of 5 s.
function strip(totalS: number, at: number) {
  const endsAt = (totalS + 5) * 1_000;
  const timing: PhasedTiming = {
    opensAt: 0,
    plan: spectatorView([], 0, { totalS }).rules.plan,
    endsAt,
    now: () => at,
  };
  render(<PhaseStrip view={spectatorView([], 0, { totalS })} timing={timing} />);
  const parts = [...document.querySelectorAll('.mg-phase')];
  const now = parts.find((p) => p.getAttribute('aria-current') === 'step');
  return {
    bar: clockText(Math.max(0, endsAt - at)),
    segments: parts.map((p) => p.textContent.replace(' · now', '')),
    now: now?.querySelector('.mg-phase-name')?.textContent.replace(' · now', '') ?? '',
    fill: now?.querySelector<HTMLElement>('.mg-phase-fill')?.style.width ?? '',
    line: screen.getByTestId('next-change').textContent,
  };
}

// `at` is dropped from the comparison: it is the input, not what the screen shows.
const shown = (m: Moment) => ({ bar: m.bar, now: m.now, fill: m.fill, line: m.line });

// Each moment of a round of `totalS`: the strip's parts, and what the screen shows then.
function agrees(totalS: number, segments: readonly string[], moments: readonly Moment[]): void {
  for (const m of moments) {
    const seen = strip(totalS, m.at);
    expect(seen.segments).toEqual(segments);
    expect(
      { bar: seen.bar, now: seen.now, fill: seen.fill, line: seen.line },
      String(m.at),
    ).toEqual(shown(m));
    cleanup();
  }
}

// Total 60, hold 5: join 30, choices close 45, the plan ends at 60, the result at 65.
const SIXTY = ['Join until 0:30', 'Play until 0:45', 'Reveal until 1:00', 'Hold until 1:05'];
const SIXTY_AT: readonly Moment[] = [
  {
    at: 500,
    bar: '1:04',
    now: 'Join',
    fill: '1.6666666666666667%',
    line: 'Joining closes in 0:29 · Choices close in 0:44',
  },
  {
    at: 29_700,
    bar: '0:35',
    now: 'Join',
    fill: '99%',
    line: 'Joining closes in 0:00 · Choices close in 0:15',
  },
  { at: 37_500, bar: '0:27', now: 'Play', fill: '50%', line: 'Choices close in 0:07' },
  { at: 45_300, bar: '0:19', now: 'Reveal', fill: '2%', line: 'Reveal · result in 0:19' },
  { at: 52_500, bar: '0:12', now: 'Reveal', fill: '50%', line: 'Reveal · result in 0:12' },
  {
    at: 62_500,
    bar: '0:02',
    now: 'Hold',
    fill: '50%',
    line: 'Choices closed · result in 0:02',
  },
];

// Total 40, hold 5: join 20, choices close 30, the plan ends at 40, the result at 45.
const FORTY = ['Join until 0:20', 'Play until 0:30', 'Reveal until 0:40', 'Hold until 0:45'];
const FORTY_AT: readonly Moment[] = [
  {
    at: 500,
    bar: '0:44',
    now: 'Join',
    fill: '2.5%',
    line: 'Joining closes in 0:19 · Choices close in 0:29',
  },
  // The owner's screenshot: "0:25 left", Join nearly full; the strip now ends at 0:45.
  {
    at: 19_700,
    bar: '0:25',
    now: 'Join',
    fill: '98.5%',
    line: 'Joining closes in 0:00 · Choices close in 0:10',
  },
  { at: 25_000, bar: '0:20', now: 'Play', fill: '50%', line: 'Choices close in 0:05' },
  { at: 30_300, bar: '0:14', now: 'Reveal', fill: '3%', line: 'Reveal · result in 0:14' },
  { at: 35_000, bar: '0:10', now: 'Reveal', fill: '50%', line: 'Reveal · result in 0:10' },
  {
    at: 42_500,
    bar: '0:02',
    now: 'Hold',
    fill: '50%',
    line: 'Choices closed · result in 0:02',
  },
];

describe('the phase strip and the round bar at the measured moments (T385)', () => {
  it('agree in a round of 60 s with a hold of 5 s', () => {
    agrees(60, SIXTY, SIXTY_AT);
  });

  it('agree in a round of 40 s with a hold of 5 s, the owner’s screen at 19.7 s', () => {
    agrees(40, FORTY, FORTY_AT);
  });
});
