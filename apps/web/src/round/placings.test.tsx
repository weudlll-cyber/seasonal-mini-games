// @vitest-environment jsdom
/**
 * @file   apps/web/src/round/placings.test.tsx
 * @module web/round
 * @brief  The result's first part (T145): the top three, "All placings", the team line, names.
 *
 * Responsibility: the first part holds the headline, the game's result and the top three
 *                 placings, "All placings (N)" showing every one; the viewer is listed by place
 *                 like everyone else, not first; "(you)" stands apart from the name, so only the
 *                 name is cut; one team line ("Team Autumn wins the round (+1 team point)"), or
 *                 "No team wins this round."; standings stay below the first part (O54); on a
 *                 time-up result the game's closest guess is labelled "Closest guess".
 * Depends on:     vitest, @testing-library/react, @smg/contracts, @smg-game/registry/web,
 *                 ./fakes, ./ResultScreen
 * Spec:           docs/spec/02-game-guess-the-number.md §9; docs/spec/09-testing-strategy.md §2
 */
import { GAME_SCREENS } from '@smg-game/registry/web';
import type { RoundStateView } from '@smg/contracts';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ended } from './fakes.js';
import { ResultScreen } from './ResultScreen.js';

afterEach(() => {
  cleanup();
});

const result = (playerId: string, place: number | null, guesses: number) => ({
  playerId,
  place,
  solved: place !== null,
  solveAt: place === null ? null : 1_000 * place,
  guesses,
  team: null,
  points: place === null ? 0 : 10 - place,
});

// Five players; the server lists the viewer (v, unplaced, no guesses) first.
const five: RoundStateView = {
  ...ended,
  secretMode: 'individual',
  results: [
    result('v', null, 0),
    result('b', 2, 6),
    result('c', 1, 4),
    result('d', 3, 9),
    result('e', 4, 2),
  ],
  names: { v: 'Vera', b: 'Ben', c: 'Cleo', d: 'Dan', e: 'Eve' },
};

const rows = () =>
  [...screen.getByTestId('placings').querySelectorAll('tbody tr')].map((tr) => tr.textContent);

describe('the first part', () => {
  it('shows the top three by place, and every placing on "All placings"', () => {
    render(<ResultScreen state={five} game={null} viewerKey="v" standings={[]} />);
    const first = screen.getByTestId('result-first');
    expect(first.contains(screen.getByTestId('placings'))).toBe(true);
    expect(rows()).toEqual(['1 Cleo49', '2 Ben68', '3 Dan97']);
    const all = screen.getByTestId('all-placings');
    expect(all.textContent).toBe('All placings (5)');
    fireEvent.click(all);
    // The viewer by place like everyone: unplaced, after the placed ones.
    expect(rows()).toEqual([
      '1 Cleo49',
      '2 Ben68',
      '3 Dan97',
      '4 Eve26',
      'not solved Vera (you)00',
    ]);
    expect(all.getAttribute('aria-expanded')).toBe('true');
  });

  it('keeps "(you)" apart from the name, so only the name is cut', () => {
    render(<ResultScreen state={ended} game={null} viewerKey="a" standings={[]} />);
    const mark = screen.getByText('(you)', { exact: false, selector: '.round-you-mark' });
    expect(mark.closest('.player-name')).toBeNull();
    expect(screen.queryByTestId('all-placings')).toBeNull();
  });

  it('says in one line which team wins the round, and the standings follow below', () => {
    const standings = [{ rank: 1, playerKey: 'w', name: 'Walter', points: 20, wins: 2 }];
    render(<ResultScreen state={ended} game={null} viewerKey="a" standings={standings} />);
    expect(screen.getByTestId('team-line').textContent).toBe(
      'Team Autumn wins the round (+1 team point)',
    );
    const first = screen.getByTestId('result-first');
    expect(first.contains(screen.getByTestId('match-standings'))).toBe(false);
    expect(first.contains(screen.getByTestId('team-result'))).toBe(false);
    cleanup();
    const nobody = (ended.teams ?? []).map((t) => ({ ...t, won: false, points: 0 }));
    render(
      <ResultScreen state={{ ...ended, teams: nobody }} game={null} viewerKey="a" standings={[]} />,
    );
    expect(screen.getByTestId('team-line').textContent).toBe('No team wins this round.');
  });
});

describe('a time-up result', () => {
  it('labels the closest guess of the round "Closest guess"', () => {
    const game = GAME_SCREENS['guess-the-number'] ?? null;
    const view = {
      range: { low: 1, high: 100 },
      secret: 92,
      secrets: null,
      guesses: { w: [{ value: 80, feedback: 'higher' }], a: [{ value: 95, feedback: 'lower' }] },
      closestMiss: { playerId: 'a', value: 95, distance: 3 },
    };
    const timeUp = {
      ...ended,
      winner: null,
      margin: null,
      endReason: 'timeUp',
      game: view,
    } as const;
    render(<ResultScreen state={timeUp} game={game} viewerKey="a" standings={[]} />);
    expect(screen.getByTestId('closest-miss').textContent).toBe(
      'Closest guess: Anna, 3 away (95).',
    );
  });
});
