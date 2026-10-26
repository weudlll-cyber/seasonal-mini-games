// @vitest-environment jsdom
/**
 * @file   apps/web/src/round/round.test.tsx
 * @module web/round
 * @brief  The platform's round components and words: ring, roster, result, refusals.
 *
 * Responsibility: the cooldown ring counts down and says Ready; the roster says who is
 *                 cooling down, ready or solved; the result screen gives the headline, the
 *                 winning margin, placings with "took part", the team result and the fairness
 *                 proof; every platform refusal and event has its plain sentence (02 §12).
 * Depends on:     vitest, @testing-library/react, @smg/contracts, ./CooldownRing, ./RoundSide,
 *                 ./ResultScreen, ./roundText
 * Spec:           docs/spec/02-game-guess-the-number.md §7, §9, §11, §12; docs/spec/09-testing-strategy.md §2
 */
import type { RoundStateView } from '@smg/contracts';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { CooldownRing } from './CooldownRing.js';
import { ResultScreen } from './ResultScreen.js';
import { Roster } from './RoundSide.js';
import { codeText, endHeadline, marginText, platformLine } from './roundText.js';

afterEach(() => {
  cleanup();
});

const ended: RoundStateView = {
  roundId: 'r1',
  status: 'ended',
  season: 'autumn',
  secretMode: 'shared',
  specialOn: true,
  halving: false,
  frostDelayMs: null,
  commitment: 'ab'.repeat(32),
  opensAt: 0,
  endsAt: 600_000,
  endedAt: 9_000,
  cooldownMs: 3_000,
  endReason: 'solved',
  abortReason: null,
  winner: 'w',
  margin: { playerId: 'a', ms: 400 },
  roster: [
    { playerKey: 'w', team: 'autumn', guesses: 9, cooldownEndsAt: 0, place: 1, solved: true },
    {
      playerKey: 'a',
      team: 'winter',
      guesses: 4,
      cooldownEndsAt: 20_000,
      place: null,
      solved: false,
    },
  ],
  seq: 30,
  role: 'result',
  game: null,
  results: [
    {
      playerId: 'w',
      place: 1,
      solved: true,
      solveAt: 9_000,
      guesses: 9,
      team: 'autumn',
      points: 10,
    },
    {
      playerId: 'a',
      place: null,
      solved: false,
      solveAt: null,
      guesses: 4,
      team: 'winter',
      points: 0,
    },
  ],
  teams: [
    { team: 'autumn', members: 1, points: 1, won: true },
    { team: 'winter', members: 1, points: 0, won: false },
  ],
  seed: 'cd'.repeat(32),
  names: { w: 'Walter', a: 'Anna' },
};

describe('the cooldown ring', () => {
  it('counts the seconds left and then says Ready', () => {
    render(<CooldownRing endsAt={10_000} cooldownMs={5_000} now={7_100} />);
    expect(screen.getByTestId('cooldown').textContent).toBe('3 s');
    cleanup();
    render(<CooldownRing endsAt={10_000} cooldownMs={5_000} now={10_000} />);
    expect(screen.getByTestId('cooldown').getAttribute('aria-label')).toBe('Ready to guess');
  });
});

describe('the roster', () => {
  it('says who is solved, cooling down or ready', () => {
    render(<Roster state={ended} now={10_000} />);
    const rows = [...screen.getByTestId('roster').querySelectorAll('li')].map(
      (li) => li.textContent,
    );
    expect(rows[0]).toContain('Walter 9 guesses · solved, place 1');
    expect(rows[1]).toContain('Anna 4 guesses · cooling down');
  });
});

describe('the result screen', () => {
  it('gives the headline, the margin, placings, the team result and the proof', () => {
    render(<ResultScreen state={ended} game={null} viewerKey="a" />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Walter found it first — after 9 guesses.',
    );
    expect(screen.getByTestId('margin').textContent).toBe('Found it 0.4 s before Anna.');
    const rows = [...screen.getByTestId('placings').querySelectorAll('tbody tr')].map(
      (tr) => tr.textContent,
    );
    expect(rows).toEqual(['1 Walter910', 'took part Anna (you)40']);
    expect(screen.getByTestId('team-result').textContent).toContain(
      'Autumn: 1 point — the winner’s team',
    );
    expect(screen.getByTestId('proof').textContent).toContain('cd'.repeat(32));
  });
});

describe('the words', () => {
  it('give refusals, end reasons, margins and events plain sentences', () => {
    expect(codeText('COOLDOWN_ACTIVE', 5_000, 2_100)).toBe('Your cooldown is running — 3 s left.');
    expect(codeText('NOT_IN_ROUND')).toMatch(/watching this round/);
    expect(codeText('SOMETHING_NEW')).toBe('That did not work. Please try again.');
    expect(endHeadline({ ...ended, endReason: 'timeUp' })).toBe('Time is up.');
    expect(marginText({ ...ended, margin: null })).toBe('Nobody else was close.');
    expect(marginText({ ...ended, secretMode: 'individual' })).toBeNull();
    expect(platformLine({ type: 'CooldownChanged', cooldownMs: 7_000 }, {})).toBe(
      'Heatwave: cooldown now 7.0 s.',
    );
    expect(platformLine({ type: 'PlayerSolved', playerId: 'a', place: 2 }, ended.names)).toBe(
      'Anna found their number — place 2.',
    );
    expect(platformLine({ type: 'GuessAccepted' }, {})).toBeNull();
  });
});
