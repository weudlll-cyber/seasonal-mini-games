// @vitest-environment jsdom
/**
 * @file   apps/web/src/round/layout.test.tsx
 * @module web/round
 * @brief  The round's two layouts (T141) and what a round view leaves out (O54).
 *
 * Responsibility: the layout follows the viewport (a landscape screen of 900 px or more is a
 *                 desktop, anything else a phone) and changes with it; a desktop has the stage
 *                 with the round's guesses and the dock, and the info column with the special
 *                 line, the game's panel and "Your guesses" (shared mode only); a phone has the
 *                 game's info line, whose tap opens the game's panel as a sheet, the list and
 *                 the dock; no round view shows team points, team tiles, match standings or an
 *                 earlier round, which stay in the Players panel and the result (O54).
 * Depends on:     vitest, @testing-library/react, @smg/contracts, @smg-game/registry/web, ./fakes,
 *                 ./RoundScreen, ./useRoundView
 * Spec:           docs/spec/02-game-guess-the-number.md §12; docs/spec/09-testing-strategy.md §2
 */
import { GAME_SCREENS } from '@smg-game/registry/web';
import type { RoundStateView } from '@smg/contracts';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ended, viewport } from './fakes.js';
import { RoundScreen } from './RoundScreen.js';
import { viewOf } from './useRoundView.js';

afterEach(() => {
  cleanup();
  viewport(1024, 768);
});

// An open Guess The Number round for Anna, with one guess of hers.
const open: RoundStateView = {
  ...ended,
  status: 'open',
  role: 'player',
  game: {
    range: { low: 1, high: 100 },
    removed: [],
    hint: null,
    guesses: [
      {
        receiveSeq: 1,
        receivedAt: 1_000,
        value: 40,
        feedback: 'lower',
        tier: 'warm',
        comment: 'Close.',
      },
    ],
    log: [],
  },
};

function show(state: RoundStateView = open): void {
  render(
    <RoundScreen
      live={{ state, feed: [], reload: () => Promise.resolve() }}
      gameId="guess-the-number"
      viewerKey="a"
      host={null}
      teamPoints={[{ team: 'autumn', points: 3 }]}
      standings={[{ playerId: 'w', name: 'Walter', points: 30, wins: 3, place: 1 }] as never}
      chat={null}
    />,
  );
}

const view = () => screen.getByTestId('round-view').dataset['view'];

describe('the layout choice', () => {
  it('is a desktop for a landscape viewport of 900 px and more, else a phone', () => {
    expect(viewOf(1280, 720)).toBe('desktop');
    expect(viewOf(1920, 1080)).toBe('desktop');
    expect(viewOf(900, 700)).toBe('desktop');
    expect(viewOf(899, 600)).toBe('phone');
    expect(viewOf(390, 844)).toBe('phone');
    // A tablet held upright is a phone.
    expect(viewOf(1024, 1366)).toBe('phone');
  });

  it('follows the window as it is resized', () => {
    show();
    expect(view()).toBe('desktop');
    act(() => {
      viewport(390, 844);
    });
    expect(view()).toBe('phone');
  });
});

describe('the desktop', () => {
  it('has the guesses and the dock on the stage, the panel and "Your guesses" beside it', () => {
    show();
    expect(screen.getByTestId('guess-list')).toBeTruthy();
    expect(screen.getByTestId('own-list').textContent).toContain('40');
    expect(screen.getByTestId('special-line')).toBeTruthy();
    expect(screen.getByTestId('range')).toBeTruthy();
    expect(screen.getByTestId('guess-input')).toBeTruthy();
    expect(screen.queryByTestId('info-line')).toBeNull();
  });

  it('leaves "Your guesses" out in individual mode: the stage holds the same rows', () => {
    show({ ...open, secretMode: 'individual' });
    expect(screen.queryByTestId('own-list')).toBeNull();
  });
});

describe('the phone', () => {
  it('has the game’s info line, whose tap opens the game’s panel as a sheet', () => {
    viewport(390, 844);
    show();
    const line = screen.getByTestId('info-line');
    expect(line.textContent).toContain('1–100');
    expect(screen.queryByTestId('range')).toBeNull();
    fireEvent.click(line);
    expect(screen.getByTestId('game-sheet').textContent).toContain('between 1 and 100');
    expect(screen.getByTestId('guess-input')).toBeTruthy();
    expect(screen.queryByTestId('own-list')).toBeNull();
  });
});

describe('what the round view leaves out (O54)', () => {
  it('shows no team points, team tiles, standings or earlier rounds outside Players', () => {
    for (const [width, height] of [
      [1280, 720],
      [390, 844],
    ]) {
      viewport(width ?? 0, height ?? 0);
      show();
      const round = screen.getByTestId('round-view');
      expect(round.querySelector('[data-testid="team-tiles"]')).toBeNull();
      expect(round.textContent).not.toMatch(/Team Autumn|standings|points|Round \d/i);
      // The Players panel keeps the teams and their points.
      fireEvent.click(screen.getByTestId('focus-players'));
      expect(screen.getByTestId('team-tiles').textContent).toContain('Team Autumn3');
      cleanup();
    }
  });
});

describe('the registry', () => {
  it('gives every game a phone info line', () => {
    for (const game of Object.values(GAME_SCREENS)) expect(typeof game.Line).toBe('function');
  });
});
