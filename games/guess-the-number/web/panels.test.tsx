// @vitest-environment jsdom
/**
 * @file   games/guess-the-number/web/panels.test.tsx
 * @module games/guess-the-number/web
 * @brief  The game's panels and words: range bar, guess field, guess rows, event lines.
 *
 * Responsibility: the range block names the range and the fallen numbers, or "Any whole
 *                 number" while the range is hidden, and nothing narrowed (O17); the player
 *                 panel shows the range and the hint; the input row keeps Guess disabled while
 *                 the player cannot act, takes negative whole numbers (± flips the sign), and
 *                 words the game's own refusal; the spectator and result panels show what their
 *                 views hold, the result with the range; the views become the list's guess
 *                 rows, own ones pending while Frost holds them (O20, O21); every room event
 *                 has its plain line, and guesses none (they are rows).
 * Depends on:     vitest, @testing-library/react, ./PlayerPanel, ./RangeBar, ./SpectatorPanel,
 *                 ./ResultPanel, ./text
 * Spec:           docs/spec/02-game-guess-the-number.md §6, §11, §12; docs/spec/09-testing-strategy.md §2
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GuessInput, PlayerPanel } from './PlayerPanel.js';
import { RangeBar } from './RangeBar.js';
import { ResultPanel } from './ResultPanel.js';
import { SpectatorPanel } from './SpectatorPanel.js';
import { gtnText } from './text.js';

afterEach(() => {
  cleanup();
});

const answered = { feedback: 'higher' as const, tier: 'cool' as const, comment: 'Mild.' };
const held = { feedback: null, tier: null, comment: null };
const view = {
  range: { low: 1, high: 1_000 },
  removed: [5, 6],
  guesses: [
    { receiveSeq: 1, receivedAt: 1_000, value: 300, ...answered },
    { receiveSeq: 3, receivedAt: 5_000, value: 700, ...held },
  ],
  log: [{ receiveSeq: 2, receivedAt: 2_000, playerId: 'p2', value: 40, ...held }],
  hint: { kind: 'parity' as const, odd: true },
};

describe('the range block', () => {
  it('names the range and the fallen numbers, or that the range is hidden', () => {
    render(<RangeBar range={{ low: -500, high: 500 }} removed={view.removed} />);
    expect(screen.getByTestId('range').textContent).toContain(
      'The number is somewhere between -500 and 500',
    );
    expect(screen.getByTestId('fallen').textContent).toBe('2 numbers have fallen.');
    cleanup();
    render(<RangeBar range={null} removed={[]} />);
    expect(screen.getByTestId('range').textContent).toBe(
      'Any whole numberThe range is hidden. Negative numbers are possible.',
    );
  });
});

describe('the player panel', () => {
  it('shows the range and the hint, and the input row waits for the cooldown', () => {
    const props = { view, act: vi.fn(), canAct: false, frostDelayMs: 3_000, now: () => 6_000 };
    render(<PlayerPanel {...props} season="winter" />);
    expect(screen.getByTestId('hint').textContent).toContain('The number is odd.');
    expect(screen.getByTestId('range')).toBeTruthy();
    cleanup();
    render(<GuessInput {...props} season="winter" ring={<span data-testid="ring" />} />);
    expect(screen.getByTestId<HTMLButtonElement>('guess-button').disabled).toBe(true);
    expect(screen.getByTestId('ring')).toBeTruthy();
  });

  it('sends a whole number, negative ones too, and words the game refusal', async () => {
    const act = vi.fn(() => Promise.resolve({ ok: false, code: 'NUMBER_REMOVED' }));
    const hidden = { ...view, range: null };
    render(
      <GuessInput
        view={hidden}
        act={act}
        canAct
        frostDelayMs={null}
        now={() => 0}
        season="autumn"
      />,
    );
    fireEvent.change(screen.getByTestId('guess-input'), { target: { value: '2.5' } });
    fireEvent.click(screen.getByTestId('guess-button'));
    expect(screen.getByRole('status').textContent).toMatch(/^Please type a whole number/);
    expect(act).not.toHaveBeenCalled();
    fireEvent.change(screen.getByTestId('guess-input'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Change the sign' }));
    await actAsync(() => {
      fireEvent.click(screen.getByTestId('guess-button'));
    });
    expect(act).toHaveBeenCalledWith({ value: -5 });
    expect(screen.getByRole('status').textContent).toContain('fell in Leaf Fall');
  });
});

async function actAsync(f: () => void): Promise<void> {
  await act(async () => {
    f();
    await Promise.resolve();
  });
}

describe('the spectator and result panels', () => {
  it('show what their views hold', () => {
    const spectator = { range: { low: 1, high: 100 }, removed: [], hint: null, log: [] };
    render(<SpectatorPanel view={spectator} names={{ p1: 'Anna' }} season="spring" />);
    expect(screen.getByTestId('range').textContent).toContain('between 1 and 100');
    cleanup();
    const result = {
      range: { low: -500, high: 500 },
      secret: 42,
      secrets: null,
      guesses: { p1: [{ value: 42, feedback: 'correct' }] },
    };
    render(<ResultPanel view={result} names={{ p1: 'Anna' }} viewerKey="p1" />);
    expect(screen.getByTestId('secret').textContent).toBe('42');
    expect(screen.getByTestId('result-range').textContent).toBe('The range was -500 to 500.');
  });
});

describe('the guess rows', () => {
  it('turn the views into rows: own ones first, pending while Frost holds them', () => {
    expect(gtnText.guesses(view)).toEqual([
      { key: '1', at: 1_000, playerId: null, value: 300, ...answered, pending: false },
      { key: '3', at: 5_000, playerId: null, value: 700, ...held, pending: true },
      { key: '2', at: 2_000, playerId: 'p2', value: 40, ...held, pending: false },
    ]);
    const spectator = { range: null, removed: [], hint: null, log: view.log };
    expect(gtnText.guesses(spectator)).toEqual([
      { key: '2', at: 2_000, playerId: 'p2', value: 40, ...held, pending: false },
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
      { type: 'HintGiven', playerId: 'p1', hint: { kind: 'parity', odd: false } },
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
      ['Spring Herald: The number is between 1 and 500.', null],
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
