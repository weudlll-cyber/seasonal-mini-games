// @vitest-environment jsdom
/**
 * @file   apps/web/src/round/dock.test.tsx
 * @module web/round
 * @brief  Who gets the input row: a guess round's roster players; every match player of a
 *         phased round, before the delayed roster lists them.
 *
 * Responsibility: a guess round is unchanged: a viewer without a roster row gets no input, one
 *                 with a row gets it with the cooldown ring. A phased round (04 §4.8): a match
 *                 player (role `player`) gets the game's input while the roster, one delay late,
 *                 does not list them yet, without a ring; they may act until the plan's play end
 *                 and not after; a spectator gets none (DECISIONS T326).
 * Depends on:     vitest, @testing-library/react, @smg-game/registry/web, @smg/contracts, ./fakes,
 *                 ./InputRow
 * Spec:           docs/spec/04-software-architecture.md §4.8 rules 2, 5; docs/spec/02e-game-mind-games.md §5
 */
import { GAME_SCREENS } from '@smg-game/registry/web';
import type { RosterRowView, RoundStateView } from '@smg/contracts';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ended } from './fakes.js';
import { InputRow } from './InputRow.js';

afterEach(() => {
  cleanup();
});

function dock(state: RoundStateView, gameId: string, now: number) {
  const game = GAME_SCREENS[gameId];
  if (game === undefined) throw new Error(gameId);
  return (
    <InputRow
      state={state}
      game={game}
      viewerKey="a"
      now={now}
      reload={() => Promise.resolve()}
      stage={null}
    />
  );
}

const row = { ...(ended.roster[1] as RosterRowView), playerKey: 'a', cooldownEndsAt: 0 };

describe('the input row of a guess round', () => {
  const view = {
    range: { low: 1, high: 100 },
    removed: [],
    newest: [],
    guesses: [],
    log: [],
    hint: null,
  };
  const open = (roster: RosterRowView[]): RoundStateView => ({
    ...ended,
    status: 'open',
    role: 'player',
    game: view,
    roster,
    ownInactivity: null,
  });

  it('is there with its ring for a roster player, and not without a row', () => {
    const { container, rerender } = render(dock(open([]), 'guess-the-number', 1_000));
    expect(container.innerHTML).toBe('');
    rerender(dock(open([row]), 'guess-the-number', 1_000));
    expect(screen.getByTestId('cooldown')).toBeTruthy();
  });
});

describe('the input row of a phased round (04 §4.8)', () => {
  const plan = { entryEndMs: 60_000, actionsEndMs: 90_000, endMs: 120_000, viewDelayMs: 30_000 };
  const view = {
    rules: { allOption: false, switchVisibility: 'perPlayer', winnerPlace: 1, plan },
    counts: { spring: 0, summer: 0, autumn: 0, winter: 0, all: 0 },
    entrants: 0,
    lines: [],
    own: { choice: null, hide: false },
  };
  const open = (role: RoundStateView['role']): RoundStateView => ({
    ...ended,
    status: 'open',
    role,
    game: view,
    roster: [],
    opensAt: 0,
    plan,
    ownInactivity: null,
  });
  const radios = () => screen.getAllByRole<HTMLButtonElement>('radio');

  it('gives a match player the input before the delayed roster lists them, without a ring', () => {
    render(dock(open('player'), 'mind-games', 10_000));
    expect(radios()).toHaveLength(4);
    expect(radios().every((r) => !r.disabled)).toBe(true);
    expect(screen.queryByTestId('cooldown')).toBeNull();
  });

  it('lets nobody act after the end of play, and gives a spectator no input', () => {
    const { container, rerender } = render(dock(open('player'), 'mind-games', 90_000));
    expect(radios().every((r) => r.disabled)).toBe(true);
    rerender(dock(open('spectator'), 'mind-games', 10_000));
    expect(container.innerHTML).toBe('');
  });
});
