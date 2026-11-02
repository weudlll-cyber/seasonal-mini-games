// @vitest-environment jsdom
/**
 * @file   games/guess-the-number/web/panels.test.tsx
 * @module games/guess-the-number/web
 * @brief  The game's panels and words: range bar, guess field, guess rows, event lines.
 *
 * Responsibility: the range block names the range and the fallen numbers, or "Any whole
 *                 number" while the range is hidden, and nothing narrowed (O17); the player
 *                 panel shows the range and the hint; the input row keeps Guess disabled while
 *                 the player cannot act and reads "Wait 6 s" during the cooldown (T125), takes
 *                 negative whole numbers (± flips the sign), words the game's own refusal,
 *                 refuses a fallen number at once without sending it ("Already fallen.",
 *                 O37), and keeps what was typed across the round opening and while an answer
 *                 is on its way (T76); the range heading keeps its two numbers together and
 *                 dense fallen numbers merge into hatched gaps; the spectator and result
 *                 panels show what their views hold, the result with the range; the views become the list's guess
 *                 rows, own ones pending while Frost holds them (O20, O21); every room event
 *                 has its plain line, and guesses none (they are rows); the intro line names
 *                 the mode and the range, or that it is hidden (O36); the banners of Leaf Fall
 *                 and halving, and the hint as "Free hint: …" (O35).
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

// The platform's per-player props: no cooldown running, and the names and colours of the list.
const who = { waitS: null, names: { p1: 'Anna' }, colors: { p1: 'var(--color-spring)' } };
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
    cleanup();
    render(<RangeBar range={null} removed={[]} />);
    expect(screen.getByTestId('range').textContent).toBe(
      'Any whole numberThe range is hidden. Negative numbers are possible.',
    );
  });
});

describe('the range block on a phone', () => {
  it('keeps the two numbers of the heading on one line together', () => {
    render(<RangeBar range={{ low: 1, high: 1_000 }} removed={[]} />);
    const together = screen.getByText('1 and 1,000');
    expect(together.className).toBe('gtn-nowrap');
  });

  it('merges close fallen numbers into one hatched gap, a run of fallen ones into a solid one', () => {
    // Every third number up to 300 (15 numbers are 1.5 % of the bar), 500–510, and 900 alone.
    const thirds = Array.from({ length: 100 }, (_, i) => 1 + 3 * i);
    const run = Array.from({ length: 11 }, (_, i) => 500 + i);
    render(<RangeBar range={{ low: 1, high: 1_000 }} removed={[900, ...run, ...thirds]} />);
    const gaps = screen.getAllByTestId('range-gap');
    expect(gaps.map((g) => g.className)).toEqual([
      'gtn-range-gap gtn-range-gap--merged',
      'gtn-range-gap',
      'gtn-range-gap',
    ]);
    // From 1 to 298: 298 numbers of 1 000, centred on the middle of their share.
    expect(gaps[0]?.style.left).toBe('14.9%');
    expect(gaps[0]?.style.getPropertyValue('--gtn-span')).toBe('29.8%');
    expect(gaps[2]?.style.getPropertyValue('--gtn-span')).toBe('0.1%');
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
    expect(screen.getByTestId('hint').textContent).toBe('Free hint: the number is odd.');
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

describe('the input row', () => {
  it('sends a whole number, negative ones too, and words the game refusal', async () => {
    const act = vi.fn(() => Promise.resolve({ ok: false, code: 'NUMBER_REMOVED' }));
    const hidden = { ...view, range: null };
    render(
      <GuessInput
        {...who}
        view={hidden}
        act={act}
        canAct
        frostDelayMs={null}
        now={() => 0}
        season="autumn"
        specialOn
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
    expect(screen.getByRole('status').textContent).toBe('Already fallen.');
  });

  it('refuses a fallen number at once without sending it (O37)', () => {
    const act = vi.fn();
    render(
      <GuessInput
        {...who}
        view={view}
        act={act}
        canAct
        frostDelayMs={null}
        now={() => 0}
        season="autumn"
        specialOn
      />,
    );
    fireEvent.change(screen.getByTestId('guess-input'), { target: { value: '6' } });
    fireEvent.click(screen.getByTestId('guess-button'));
    expect(screen.getByRole('status').textContent).toBe('Already fallen.');
    expect(act).not.toHaveBeenCalled();
    expect(screen.getByTestId<HTMLInputElement>('guess-input').value).toBe('6');
  });
});

describe('the input row keeps what the player typed (T76)', () => {
  const props = {
    ...who,
    view,
    frostDelayMs: null,
    now: () => 0,
    season: 'spring' as const,
    specialOn: true,
  };

  it('across the round opening', () => {
    const { rerender } = render(<GuessInput {...props} act={vi.fn()} canAct={false} />);
    fireEvent.change(screen.getByTestId('guess-input'), { target: { value: '50' } });
    rerender(<GuessInput {...props} act={vi.fn()} canAct ring={<span />} />);
    expect(screen.getByTestId<HTMLInputElement>('guess-input').value).toBe('50');
    expect(screen.getByTestId<HTMLButtonElement>('guess-button').disabled).toBe(false);
  });

  it('while the answer to the last guess is on its way', async () => {
    let answer: (r: { ok: boolean }) => void = () => undefined;
    const act = vi.fn(
      () =>
        new Promise<{ ok: boolean }>((resolve) => {
          answer = resolve;
        }),
    );
    render(<GuessInput {...props} act={act} canAct />);
    const field = screen.getByTestId<HTMLInputElement>('guess-input');
    const button = screen.getByTestId<HTMLButtonElement>('guess-button');
    fireEvent.change(field, { target: { value: '50' } });
    fireEvent.click(button);
    // Guess waits for the answer; the next number is typed meanwhile.
    expect(button.disabled).toBe(true);
    fireEvent.change(field, { target: { value: '75' } });
    await actAsync(() => {
      answer({ ok: true });
    });
    expect(field.value).toBe('75');
    expect(button.disabled).toBe(false);
    expect(act).toHaveBeenCalledTimes(1);
  });

  it('and empties the field once the guess sent is answered', async () => {
    render(<GuessInput {...props} act={() => Promise.resolve({ ok: true })} canAct />);
    fireEvent.change(screen.getByTestId('guess-input'), { target: { value: '50' } });
    await actAsync(() => {
      fireEvent.click(screen.getByTestId('guess-button'));
    });
    expect(screen.getByTestId<HTMLInputElement>('guess-input').value).toBe('');
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
    render(<SpectatorPanel view={spectator} {...who} season="spring" specialOn />);
    expect(screen.getByTestId('range').textContent).toContain('between 1 and 100');
    cleanup();
    const result = {
      range: { low: -500, high: 500 },
      secret: 42,
      secrets: null,
      guesses: { p1: [{ value: 42, feedback: 'correct' }] },
    };
    render(<ResultPanel view={result} {...who} viewerKey="p1" />);
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
    expect(banner({ type: 'HintGiven', playerId: null, hint: { kind: 'parity', odd: true } })).toBe(
      null,
    );
  });
});
