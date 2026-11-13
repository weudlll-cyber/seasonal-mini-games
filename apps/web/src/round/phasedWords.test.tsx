// @vitest-environment jsdom
/**
 * @file   apps/web/src/round/phasedWords.test.tsx
 * @module web/round
 * @brief  The platform's words in a phased round, and the guess rounds' unchanged.
 *
 * Responsibility: a round's actions are guesses in a guess round and choices in a phased one;
 *                 the result's headline of a phased round that ran its time is "The round is
 *                 over.", with nobody in it "Nobody chose this round." (02e §9), a guess round's
 *                 the same as before; the intro has no cooldown line in a phased round; the
 *                 placings head the actions' column by their word and show a phased round's
 *                 winners as "won" (DECISIONS T332).
 * Depends on:     vitest, @testing-library/react, @smg/contracts, ./fakes, ./ResultParts,
 *                 ./RoundIntro, ./roundText
 * Spec:           docs/spec/02e-game-mind-games.md §9; docs/spec/04-software-architecture.md §4.8
 */
import type { RoundStateView } from '@smg/contracts';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ended } from './fakes.js';
import { Placings } from './ResultParts.js';
import { RoundIntro } from './RoundIntro.js';
import { actionCount, endHeadline } from './roundText.js';

afterEach(() => {
  cleanup();
});

const plan = { entryEndMs: 60_000, actionsEndMs: 90_000, endMs: 120_000, viewDelayMs: 30_000 };
const phased: RoundStateView = { ...ended, plan };

describe('the platform words of a phased round (T332)', () => {
  it('counts choices, and guesses in a guess round', () => {
    expect(actionCount(ended, 1)).toBe('1 guess');
    expect(actionCount(phased, 3)).toBe('3 choices');
  });

  it('heads the result of a phased round in its own words, a guess round as before', () => {
    expect(endHeadline({ ...ended, endReason: 'timeUp' })).toBe('Time is up.');
    expect(endHeadline({ ...phased, endReason: 'timeUp' })).toBe('The round is over.');
    expect(endHeadline({ ...phased, endReason: 'noPlayers' })).toBe('Nobody chose this round.');
    expect(endHeadline({ ...phased, endReason: 'host' })).toBe('The host ended the round.');
  });

  it('leaves the cooldown out of a phased round’s intro', () => {
    const counting = { ...ended, status: 'countdown' as const, opensAt: 5_000, game: null };
    render(<RoundIntro state={counting} game={null} now={0} />);
    expect(screen.getByText(/between guesses/)).toBeTruthy();
    cleanup();
    render(<RoundIntro state={{ ...counting, plan }} game={null} now={0} />);
    expect(screen.queryByText(/between guesses/)).toBeNull();
  });

  it('heads the placings by the round’s word and shows a phased round’s winners', () => {
    const row = (ended.results ?? [])[0];
    if (row === undefined) throw new Error('a result');
    const results = [
      { ...row, playerId: 'a', place: null, won: true },
      { ...row, playerId: 'b', place: null, won: false },
    ];
    render(<Placings state={{ ...phased, results }} viewerKey={null} />);
    expect(screen.getByRole('columnheader', { name: 'Choices' })).toBeTruthy();
    expect(screen.getAllByRole('cell').map((c) => c.textContent)).toContain('won');
  });
});
