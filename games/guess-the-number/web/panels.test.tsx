// @vitest-environment jsdom
/**
 * @file   games/guess-the-number/web/panels.test.tsx
 * @module games/guess-the-number/web
 * @brief  The game's panels and words: range bar, guess field, own guesses, feed lines.
 *
 * Responsibility: the range bar names the band and the fallen numbers; the player panel shows
 *                 the hint, keeps Guess disabled while the player cannot act, sends a whole
 *                 number and words the game's own refusal, lists guesses newest first and
 *                 shows "answer arriving" while Frost holds one; the spectator and result
 *                 panels show what their views hold; every room event has its plain line.
 * Depends on:     vitest, @testing-library/react, ./PlayerPanel, ./RangeBar, ./SpectatorPanel,
 *                 ./ResultPanel, ./text
 * Spec:           docs/spec/02-game-guess-the-number.md §6, §11, §12; docs/spec/09-testing-strategy.md §2
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PlayerPanel } from './PlayerPanel.js';
import { RangeBar } from './RangeBar.js';
import { ResultPanel } from './ResultPanel.js';
import { SpectatorPanel } from './SpectatorPanel.js';
import { answerText, gtnText } from './text.js';

afterEach(() => {
  cleanup();
});

const view = {
  range: { low: 1, high: 1_000 },
  removed: [5, 6],
  band: { low: 301, high: 1_000 },
  guesses: [
    { receiveSeq: 1, receivedAt: 1_000, value: 300, feedback: 'higher' as const },
    { receiveSeq: 2, receivedAt: 5_000, value: 700, feedback: null },
  ],
  hint: { kind: 'parity' as const, odd: true },
};

describe('the range bar', () => {
  it('names the band and the fallen numbers', () => {
    render(
      <RangeBar range={view.range} band={view.band} removed={view.removed} label="Your range" />,
    );
    expect(screen.getByTestId('band').textContent).toBe('Between 301 and 1000 · 2 fallen');
  });
});

describe('the player panel', () => {
  it('shows the hint and guesses, and holds Guess while the player cannot act', () => {
    const act = vi.fn(() => Promise.resolve({ ok: true }));
    render(
      <PlayerPanel
        view={view}
        act={act}
        canAct={false}
        frostDelayMs={3_000}
        now={() => 6_000}
        season="winter"
      />,
    );
    expect(screen.getByTestId('hint').textContent).toContain('The number is odd.');
    expect(screen.getByTestId<HTMLButtonElement>('guess-button').disabled).toBe(true);
    const items = [...screen.getByTestId('own-guesses').querySelectorAll('li')].map(
      (li) => li.textContent,
    );
    expect(items).toEqual(['700: Answer arriving in 2 s', 'The number is higher than 300.']);
  });

  it('sends a whole number and words the game refusal', async () => {
    const act = vi.fn(() => Promise.resolve({ ok: false, code: 'NUMBER_REMOVED' }));
    render(
      <PlayerPanel
        view={view}
        act={act}
        canAct
        frostDelayMs={null}
        now={() => 0}
        season="autumn"
      />,
    );
    fireEvent.change(screen.getByTestId('guess-input'), { target: { value: '2.5' } });
    fireEvent.click(screen.getByTestId('guess-button'));
    expect(screen.getByRole('status').textContent).toBe('Please type a whole number.');
    expect(act).not.toHaveBeenCalled();
    fireEvent.change(screen.getByTestId('guess-input'), { target: { value: '5' } });
    await actAsync(() => {
      fireEvent.click(screen.getByTestId('guess-button'));
    });
    expect(act).toHaveBeenCalledWith({ value: 5 });
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
    const spectator = {
      range: { low: 1, high: 100 },
      removed: [],
      sharedBand: { low: 40, high: 100 },
      hint: null,
      players: [
        { playerId: 'p1', guesses: 1, values: [39], answers: [{ value: 39, feedback: 'higher' }] },
      ],
    };
    render(<SpectatorPanel view={spectator} names={{ p1: 'Anna' }} season="spring" />);
    expect(screen.getByText(/Anna/).parentElement?.textContent).toBe('Anna: 1 guess — 39 higher');
    cleanup();
    const result = {
      secret: 42,
      secrets: null,
      guesses: { p1: [{ value: 42, feedback: 'correct' }] },
    };
    render(<ResultPanel view={result} names={{ p1: 'Anna' }} viewerKey="p1" />);
    expect(screen.getByTestId('secret').textContent).toBe('42');
  });
});

describe('the words', () => {
  it('give every answer, refusal and room event a plain line', () => {
    expect(answerText(412, 'lower')).toBe('The number is lower than 412.');
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
    ].map((e) => gtnText.event(e, names));
    expect(lines).toEqual([
      'Leaf Fall: 3 numbers fell.',
      'Spring Herald: The number is between 1 and 500.',
      null,
      'Halving: the range is now 1–500.',
      'Halving: every range is now 250 numbers.',
      'Anna guessed.',
      'Anna guessed 40.',
      'Anna guessed 50 — lower.',
      null,
    ]);
  });
});
