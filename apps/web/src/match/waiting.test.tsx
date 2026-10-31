// @vitest-environment jsdom
/**
 * @file   apps/web/src/match/waiting.test.tsx
 * @module web/match
 * @brief  The waiting area (O23): what teams are for, the picker, the players, the next step.
 *
 * Responsibility: the area names what teams are for; a match player sees the four team
 *                 buttons with their own team pressed and checked, a watcher none; every
 *                 player is listed with "here" or "away"; the line on top says whether the next
 *                 round is set up and who acts, for the host and for the players.
 * Depends on:     vitest, @testing-library/react, @smg/contracts, ./WaitingArea
 * Spec:           docs/spec/02-game-guess-the-number.md §2; docs/spec/03-seasonal-specials.md §5
 */
import type { MatchDetailsView } from '@smg/contracts';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { WaitingArea } from './WaitingArea.js';

afterEach(() => {
  cleanup();
});

const match: MatchDetailsView = {
  code: 'ABC123',
  gameId: 'guess-the-number',
  title: 'Quick Test',
  status: 'open',
  visibility: 'unlisted',
  maxPlayers: 4,
  countsForLeaderboard: false,
  createdAt: 0,
  youHost: false,
  youPlayer: true,
  host: 'h',
  players: [
    { playerKey: 'h', name: 'Hanna', team: null },
    { playerKey: 'a', name: 'Anna', team: 'summer' },
    { playerKey: 'bot-01', name: 'bot-01', team: 'winter' },
  ],
  connected: ['h', 'bot-01'],
  round: null,
  teamStandings: [],
  nextRoundDefaults: null,
};

const show = (m: MatchDetailsView, viewerKey: string | null, after = false) =>
  render(<WaitingArea match={m} viewerKey={viewerKey} after={after} reload={() => undefined} />);

describe('the waiting area', () => {
  it('says what teams are for and marks the viewer’s team', () => {
    show(match, 'a');
    const area = screen.getByTestId('waiting-area');
    expect(area.textContent).toContain('in shared rounds the winner’s team gets a point');
    expect(area.textContent).toContain('join the smallest one when the round starts');
    const pressed = screen.getAllByRole('button').filter((b) => b.ariaPressed === 'true');
    expect(pressed.map((b) => b.textContent)).toEqual([' Summer✓']);
    expect(screen.getAllByRole('button')).toHaveLength(4);
  });

  it('lists every player with "here" or "away", and offers a watcher no team buttons', () => {
    show({ ...match, youPlayer: false }, null);
    const rows = [...screen.getByTestId('match-players').querySelectorAll('li')];
    expect(rows.map((li) => li.textContent.trim())).toEqual([
      'Hanna here',
      'Anna away',
      'bot-01 here',
    ]);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('says whether the next round is set up and who starts it', () => {
    show(match, 'a');
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Before the round');
    expect(screen.getByTestId('waiting-state').textContent).toBe(
      'Waiting for the host to start the next round.',
    );
    cleanup();
    const ready = { ...match, youHost: true, round: { id: 'r', status: 'created' } };
    show(ready, 'h', true);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Next round');
    expect(screen.getByTestId('waiting-state').textContent).toBe(
      'The next round is set up. Start it from the Host menu.',
    );
  });
});
