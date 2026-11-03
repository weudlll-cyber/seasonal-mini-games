// @vitest-environment jsdom
/**
 * @file   apps/web/src/round/gameWords.test.tsx
 * @module web/round
 * @brief  A game that is not about numbers in the platform's round screens (DECISIONS T119).
 *
 * Responsibility: a guess row with the game's own words (`text`) and answer (`answer` with its
 *                 tone and pegs, the words always beside the pegs), a hidden guess still
 *                 "guessed"; the intro and the season pill's note with the game's own
 *                 sentence for its special (`specialRule`), and the platform's sentence when
 *                 the game has none.
 * Depends on:     vitest, @testing-library/react, @smg/contracts, ./fakes, ./RoundIntro,
 *                 ./RoundLog, ./SeasonPill
 * Spec:           docs/spec/04-software-architecture.md §4.6; docs/spec/09-testing-strategy.md §2
 */
import type { RoundStateView } from '@smg/contracts';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ended } from './fakes.js';
import { RoundIntro } from './RoundIntro.js';
import { RoundLog } from './RoundLog.js';
import { ruleOf, SeasonPill } from './SeasonPill.js';

afterEach(() => {
  cleanup();
});

const row = { pending: false, tier: null, comment: null, feedback: null, value: null };
const rows = [
  {
    ...row,
    key: '1',
    at: 2_000,
    playerId: null,
    text: '0427',
    answer: {
      text: '2 right place, 1 right digit, wrong place',
      tone: 'close',
      pegs: ['hit', 'hit', 'near'],
    },
  },
  { ...row, key: '2', at: 1_000, playerId: 'w', text: null },
];
const game = {
  text: {
    code: () => null,
    event: () => null,
    guesses: () => rows,
    specialRule: (season: string) => (season === 'autumn' ? 'A digit falls out.' : null),
  },
} as never;
const live = { ...ended, status: 'open', game: {} } as const;

describe('a game’s own words in the list', () => {
  it('shows the guess and the answer in words, with the pegs beside them', () => {
    render(<RoundLog feed={[]} game={game} state={live} viewerKey="a" now={3_000} />);
    const items = [...screen.getByTestId('guess-list').querySelectorAll('li')];
    expect(items.map((li) => li.textContent)).toEqual([
      'You04272 right place, 1 right digit, wrong place',
      'Walterguessed',
    ]);
    const answer = items[0]?.querySelector('.round-answer');
    expect(answer?.getAttribute('data-feedback')).toBe('close');
    const pegs = [...(answer?.querySelectorAll('.round-peg') ?? [])].map((p) =>
      p.getAttribute('data-peg'),
    );
    expect(pegs).toEqual(['hit', 'hit', 'near']);
    expect(answer?.querySelector('.round-pegs')?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('a game’s own sentence for its special', () => {
  it('replaces the platform’s on the intro and in the info note, and only where given', () => {
    const counting: RoundStateView = {
      ...ended,
      status: 'countdown',
      season: 'autumn',
      opensAt: 9_000,
      game: {},
    };
    render(<RoundIntro state={counting} game={game} now={1_000} />);
    expect(screen.getByTestId('intro-special').textContent).toContain('A digit falls out.');
    cleanup();
    render(<SeasonPill state={counting} rule={ruleOf(game, 'autumn')} />);
    fireEvent.click(screen.getByTestId('special-info'));
    // The mode first: a phone's bar leaves it out (night 6).
    expect(screen.getByRole('note').textContent).toMatch(
      /^(Shared|Individual) round\. Leaf Fall: A digit falls out\.$/,
    );
    expect(ruleOf(game, 'winter')).toBe('Answers arrive a few seconds late.');
    expect(ruleOf(null, 'spring')).toBe('Everyone gets one free hint when the round opens.');
  });
});
