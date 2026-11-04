// @vitest-environment jsdom
/**
 * @file   games/guess-the-number/web/panels.test.tsx
 * @module games/guess-the-number/web
 * @brief  The game's panels and words: range bar, guess field, guess rows, event lines.
 *
 * Responsibility: the range block names the range, or "Any whole number" while the range
 *                 is hidden, and nothing narrowed (O17); the player
 *                 panel shows the range and the hint, and its input row waits for the cooldown
 *                 ("Wait 6 s", T125; the input row's own tests are ./input.test); the range
 *                 heading keeps its two numbers together (the fallen numbers: ./fallen.test);
 *                 the spectator and result
 *                 panels show what their views hold, the result with the range; the views become the list's guess
 *                 rows, pending while Frost holds them, own and others' alike (O20, O21, T150); every room event
 *                 has its plain line, and guesses none (they are rows); the intro line names
 *                 the mode and the range, or that it is hidden (O36); the banners of Leaf Fall
 *                 and halving, and the hint as "Free hint: …" (O35).
 * Depends on:     vitest, @testing-library/react, ./fixtures, ./PlayerPanel, ./RangeBar,
 *                 ./SpectatorPanel, ./ResultPanel, ./text
 * Spec:           docs/spec/02-game-guess-the-number.md §6, §11, §12; docs/spec/09-testing-strategy.md §2
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { answered, held, view, who } from './fixtures.js';
import { GuessInput, PlayerPanel } from './PlayerPanel.js';
import { RangeBar } from './RangeBar.js';
import { ResultPanel } from './ResultPanel.js';
import { SpectatorPanel } from './SpectatorPanel.js';
import { gtnText } from './text.js';

afterEach(() => {
  cleanup();
});

describe('the range block', () => {
  it('names the range, or that the range is hidden', () => {
    render(<RangeBar range={{ low: -500, high: 500 }} />);
    expect(screen.getByTestId('range').textContent).toContain(
      'The number is somewhere between -500 and 500',
    );
    cleanup();
    render(<RangeBar range={null} />);
    expect(screen.getByTestId('range').textContent).toBe(
      'Any whole numberThe range is hidden. Negative numbers are possible.',
    );
  });
});

describe('the range block on a phone', () => {
  it('keeps the two numbers of the heading on one line together', () => {
    render(<RangeBar range={{ low: 1, high: 1_000 }} />);
    const together = screen.getByText('1 and 1,000');
    expect(together.className).toBe('gtn-nowrap');
  });
});

describe('the player panel', () => {
  it('shows the range and the hint, and the input row waits for the cooldown', () => {
    const props = {
      ...who,
      view,
      act: vi.fn(),
      canAct: false,
      frostDelayMs: 3_000,
      now: () => 6_000,
    };
    render(<PlayerPanel {...props} season="winter" specialOn />);
    expect(screen.getByTestId('hint').textContent).toBe('Free hint: the number ends in 7.');
    expect(screen.getByTestId('range')).toBeTruthy();
    cleanup();
    render(<GuessInput {...props} season="winter" specialOn ring={<span data-testid="ring" />} />);
    expect(screen.getByTestId<HTMLButtonElement>('guess-button').disabled).toBe(true);
    expect(screen.getByTestId('ring')).toBeTruthy();
    expect(screen.getByTestId('guess-button').textContent).toBe('Guess');
    cleanup();
    render(<GuessInput {...props} waitS={6} season="winter" specialOn />);
    expect(screen.getByTestId('guess-button').textContent).toBe('Wait 6 s');
  });
});

describe('the spectator and result panels', () => {
  it('show what their views hold', () => {
    const spectator = { range: { low: 1, high: 100 }, removed: [], hint: null, log: [] };
    render(<SpectatorPanel view={spectator} {...who} season="spring" specialOn />);
    expect(screen.getByTestId('range').textContent).toContain('between 1 and 100');
    cleanup();
    const result = {
      range: { low: -500, high: 500 },
      secret: 42,
      secrets: null,
      guesses: { p1: [{ value: 42, feedback: 'correct' }] },
    };
    render(<ResultPanel view={result} {...who} viewerKey="p1" part="reveal" />);
    expect(screen.getByTestId('secret').textContent).toBe('42');
    expect(screen.getByTestId('result-range').textContent).toBe('The range was -500 to 500.');
    cleanup();
    // The history below the first part (T150): every guess in full, "did not guess" without one.
    const quiet = { ...result, guesses: { ...result.guesses, p2: [] } };
    render(<ResultPanel view={quiet} {...who} viewerKey="p1" part="history" />);
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Anna: 42 correct',
      'p2: did not guess',
    ]);
  });
});

describe('the guess rows', () => {
  it('turn the views into rows: own ones first, any held answer pending (T150)', () => {
    expect(gtnText.guesses(view)).toEqual([
      { key: '1', at: 1_000, playerId: null, value: 300, ...answered, pending: false },
      { key: '3', at: 5_000, playerId: null, value: 700, ...held, pending: true },
      { key: '2', at: 2_000, playerId: 'p2', value: 40, ...held, pending: true },
    ]);
    const spectator = { range: null, removed: [], hint: null, log: view.log };
    expect(gtnText.guesses(spectator)).toEqual([
      { key: '2', at: 2_000, playerId: 'p2', value: 40, ...held, pending: true },
    ]);
  });
});

describe('the words', () => {
  it('give every refusal and room event a plain line, and guesses none', () => {
    expect(gtnText.code('ALREADY_GUESSED')).toMatch(/guessed that number already/);
    expect(gtnText.code('COOLDOWN_ACTIVE')).toBeNull();
    const names = { p1: 'Anna' };
    const lines = [
      { type: 'NumbersRemoved', index: 1, numbers: [1, 2, 3] },
      { type: 'HintGiven', playerId: null, hint: { kind: 'half', low: 1, high: 500 } },
      { type: 'HintGiven', playerId: 'p1', hint: { kind: 'lastDigit', digit: 4 } },
      { type: 'RangeHalved', index: 1, playerId: null, range: { low: 1, high: 500 }, size: 500 },
      { type: 'RangeHalved', index: 1, playerId: null, range: null, size: 250 },
      { type: 'GuessFed', playerId: 'p1', guesses: 1 },
      { type: 'GuessFed', playerId: 'p1', guesses: 2, value: 40 },
      { type: 'GuessFed', playerId: 'p1', guesses: 3, value: 50, feedback: 'lower' },
      { type: 'FeedbackGiven', playerId: 'p1' },
    ].map((e) => {
      const line = gtnText.event(e, names);
      return line === null ? null : [line.text, line.playerId];
    });
    expect(lines).toEqual([
      ['Leaf Fall: 1, 2 and 3 fell.', null],
      // The hint shows once, in the range block (O47).
      null,
      null,
      ['Halving: the range is now 1–500.', null],
      ['Halving: every range is now 250 numbers.', null],
      null,
      null,
      null,
      null,
    ]);
  });
});

describe('the intro line (O36)', () => {
  it('names the mode and the range, or that the range is hidden', () => {
    const range = { low: 1, high: 100 };
    expect(gtnText.intro?.({ range }, 'shared')).toBe('Shared number between 1 and 100');
    expect(gtnText.intro?.({ range }, 'individual')).toBe(
      'Everyone has their own number between 1 and 100',
    );
    expect(gtnText.intro?.({ range: null }, 'shared')).toBe('Hidden range');
    expect(gtnText.intro?.(null, 'shared')).toBeNull();
  });
});

describe('the banners (O35)', () => {
  it('say in short what Leaf Fall and halving did, and nothing for other events', () => {
    const banner = (e: object) => gtnText.banner?.(e) ?? null;
    expect(banner({ type: 'NumbersRemoved', index: 1, numbers: [3, 9] })).toBe(
      'Leaf Fall: 2 numbers fell.',
    );
    expect(banner({ type: 'NumbersRemoved', index: 1, numbers: [3] })).toBe(
      'Leaf Fall: 1 number fell.',
    );
    const halved = { type: 'RangeHalved', index: 1, size: 51 };
    expect(banner({ ...halved, playerId: null, range: { low: 25, high: 75 } })).toBe(
      'Range halved: the number is between 25 and 75.',
    );
    expect(banner({ ...halved, playerId: 'p1', range: { low: 25, high: 75 } })).toBe(
      'Range halved: your number is between 25 and 75.',
    );
    expect(banner({ ...halved, playerId: null, range: null })).toBe(
      'Range halved: every range is now 51 numbers.',
    );
    expect(
      banner({ type: 'HintGiven', playerId: null, hint: { kind: 'lastDigit', digit: 7 } }),
    ).toBe(null);
  });
});
