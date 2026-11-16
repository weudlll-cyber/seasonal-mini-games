// @vitest-environment jsdom
/**
 * @file   apps/web/src/round/ownResult.test.tsx
 * @module web/round
 * @brief  The result of a game that draws its own first part (`ownResult`, O97, T352, T353).
 *
 * Responsibility: such a game's reveal is the whole first part: no platform headline, no
 *                 placings table, no team line; "Every line" holds the game's history; under it
 *                 the standings "after round N" (Player · This round · Total, "—" for a player not
 *                 in the round) with the rows that fit (six where nothing is laid out) and the
 *                 viewer's row when lower; the page's next-round box beside them. A game
 *                 without the flag keeps its placings.
 * Depends on:     vitest, @testing-library/react, @smg/contracts, @smg-game/registry/web,
 *                 ./fakes, ./ResultScreen
 * Spec:           docs/spec/02e-game-mind-games.md §9; docs/spec/09-testing-strategy.md §2
 */
import type { GameWeb } from '@smg-game/registry/web';
import type { MatchStandingView, RoundStateView } from '@smg/contracts';
import { cleanup, render, screen } from '@testing-library/react';
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
  [...screen.getByTestId('match-standings').querySelectorAll('li')].map((li) =>
    [...li.children].map((x) => x.textContent),
  );

describe('a game that draws its own result', () => {
  it('shows its reveal, every player in the standings and the next round, no placings', () => {
    render(
      <ResultScreen
        state={state}
        game={game}
        viewerKey="v"
        standings={standings}
        next={<p>The next round's box</p>}
        roundNo={2}
      />,
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Winter wins!');
    expect(screen.queryByTestId('placings')).toBeNull();
    expect(screen.getByText("The next round's box")).toBeTruthy();
    expect(screen.getByTestId('result-history').textContent).toContain('Every line');
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Standings after round 2');
    expect(screen.getByTestId('round-standings').textContent).toContain('7 players');
    // Every player in the server's order: "+2" this round, "0", "—" for a player not in it.
    expect(rows()).toEqual([
      ['1', 'player a', '+2', '10'],
      ['2', 'player b', '0', '9'],
      ['3', 'player c', '—', '8'],
      ['4', 'player d', '—', '7'],
      ['5', 'player e', '—', '6'],
      ['6', 'player f', '—', '5'],
      ['7', 'You', '0', '4'],
    ]);
  });
});

// 160 players, the viewer far down: a desktop's panel scrolls to their row; a phone's starts
// with their own line and does not scroll.
describe('the standings of 160 players (MG-N8)', () => {
  const many: MatchStandingView[] = Array.from({ length: 160 }, (_, i) => ({
    playerKey: `p${String(i + 1)}`,
    name: `A player with a rather long name ${String(i + 1)}`,
    rank: i < 36 ? 1 : 37,
    points: i < 36 ? 1 : 0,
    wins: i < 36 ? 1 : 0,
  }));
  const at = (height: number, client: number) => {
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      value: height,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      value: client,
    });
    Object.defineProperty(HTMLElement.prototype, 'offsetTop', {
      configurable: true,
      get(this: HTMLElement) {
        return this.dataset['own'] === 'true' ? 2400 : 0;
      },
    });
  };
  afterEach(() => {
    const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
    delete proto['scrollHeight'];
    delete proto['clientHeight'];
    delete proto['offsetTop'];
  });
  const show = () =>
    render(
      <ResultScreen state={state} game={game} viewerKey="p100" standings={many} roundNo={1} />,
    );

  it('lists all 160 and scrolls a desktop panel to the viewer, in the middle', () => {
    at(6000, 300);
    show();
    const panel = screen.getByTestId('round-standings');
    expect(panel.querySelectorAll('.round-standing')).toHaveLength(160);
    expect(panel.querySelector('.round-standing[data-own="true"]')?.textContent).toContain('You');
    expect(panel.scrollTop).toBe(2400 - 150);
  });

  it("starts a phone's panel with the viewer's own line and leaves a panel that fits alone", () => {
    at(300, 300);
    show();
    const panel = screen.getByTestId('round-standings');
    // The head, then the own line, then every row.
    expect(panel.children[1]?.textContent).toBe('37You · place 37—0');
    expect(panel.scrollTop).toBe(0);
  });
});
