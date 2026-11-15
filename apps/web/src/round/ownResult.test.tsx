// @vitest-environment jsdom
/**
 * @file   apps/web/src/round/ownResult.test.tsx
 * @module web/round
 * @brief  The result of a game that draws its own first part (`ownResult`, O97, T352, T353).
 *
 * Responsibility: such a game's reveal is the whole first part: no platform headline, no
 *                 placings table, no team line; "Every line" holds the game's history; under it
 *                 the standings (Player · This round · Total, "—" for a player not in the round)
 *                 with the top five and the viewer's row when lower, "All N players…" showing
 *                 every row; the page's next-round box beside them. A game without the flag
 *                 keeps its placings.
 * Depends on:     vitest, @testing-library/react, @smg/contracts, @smg-game/registry/web,
 *                 ./fakes, ./ResultScreen
 * Spec:           docs/spec/02e-game-mind-games.md §9; docs/spec/09-testing-strategy.md §2
 */
import type { GameWeb } from '@smg-game/registry/web';
import type { MatchStandingView, RoundStateView } from '@smg/contracts';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ended } from './fakes.js';
import { ResultScreen } from './ResultScreen.js';

afterEach(() => {
  cleanup();
});

// A game whose result draws everything itself.
const game = {
  Result: (p: { part: string }) =>
    p.part === 'reveal' ? <h1>Winter wins!</h1> : <ol aria-label="lines" />,
  text: { runnerUp: () => null },
  ownResult: true,
} as unknown as GameWeb;

const KEYS = ['a', 'b', 'c', 'd', 'e', 'f', 'v'];
const standings: MatchStandingView[] = KEYS.map((k, i) => ({
  playerKey: k,
  name: `player ${k}`,
  rank: i + 1,
  points: 10 - i,
  wins: 1,
}));

const state: RoundStateView = {
  ...ended,
  results: ['a', 'b', 'v'].map((k) => ({
    playerId: k,
    place: null,
    solved: false,
    solveAt: null,
    guesses: 0,
    team: null,
    points: k === 'a' ? 2 : 0,
    timedOut: false,
  })),
};

const rows = () =>
  [...screen.getByTestId('match-standings').querySelectorAll('tbody tr')].map((tr) =>
    [...tr.querySelectorAll('td')].map((td) => td.textContent),
  );

describe('a game that draws its own result', () => {
  it('shows its reveal, the standings and the next round, no placings', () => {
    render(
      <ResultScreen
        state={state}
        game={game}
        viewerKey="v"
        standings={standings}
        next={<p>The next round's box</p>}
      />,
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Winter wins!');
    expect(screen.queryByTestId('placings')).toBeNull();
    expect(screen.getByText("The next round's box")).toBeTruthy();
    expect(screen.getByTestId('result-history').textContent).toContain('Every line');
    // The top five and the viewer's own row, "—" for a player not in the round.
    expect(rows()).toEqual([
      ['player a', '2', '10'],
      ['player b', '0', '9'],
      ['player c', '—', '8'],
      ['player d', '—', '7'],
      ['player e', '—', '6'],
      ['player v (you)', '0', '4'],
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'All 7 players…' }));
    expect(rows()).toHaveLength(7);
    fireEvent.click(screen.getByRole('button', { name: 'Top 5' }));
    expect(rows()).toHaveLength(6);
  });
});
