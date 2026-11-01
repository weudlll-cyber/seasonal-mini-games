// @vitest-environment jsdom
/**
 * @file   games/bomb-defusal/web/input.test.tsx
 * @module games/bomb-defusal/web
 * @brief  The input row: building a sequence by taps and keys, Cut, refusals and the explosion.
 *
 * Responsibility: tapping wires fills the slots in order, a used wire is disabled with its
 *                 slot number, a harmless one with "harmless"; Undo and Clear; Cut is enabled
 *                 only with every slot filled and the cooldown over, sends the whole sequence
 *                 once, and the slots empty only if they still hold it (T76); the game's
 *                 refusal in words; a wire marked harmless while in the slots says "take it
 *                 out" and is refused without sending; keys 1–8, Backspace, Escape and Enter;
 *                 the hint in slot 1; the explosion shows for about 1 s when a wrong first
 *                 cut's answer arrives, and not for answers already there.
 * Depends on:     vitest, @testing-library/react, ./WireInput
 * Spec:           docs/spec/02c-game-bomb-defusal.md §5.2, §11
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WireInput } from './WireInput.js';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const view = {
  wires: ['red', 'blue', 'yellow', 'green', 'white', 'black'],
  cuts: 4,
  penaltyS: 5,
  harmless: [] as string[],
  hint: null as string | null,
  guesses: [] as unknown[],
  log: [],
};

const props = (over: object = {}) => ({
  view,
  act: vi.fn(() => Promise.resolve({ ok: true })),
  canAct: true,
  frostDelayMs: null,
  now: () => 0,
  season: 'spring' as const,
  specialOn: false,
  ...over,
});

const tap = (wire: string) => {
  fireEvent.click(screen.getByTestId(`wire-${wire}`));
};
const cutButton = () => screen.getByTestId<HTMLButtonElement>('cut-button');
const slots = () => screen.getByTestId('slots').textContent;

describe('building a sequence', () => {
  it('fills the slots by taps, disables used wires, and Undo and Clear work', () => {
    render(<WireInput {...props()} ring={<span data-testid="ring" />} />);
    expect(screen.getByTestId('ring')).toBeTruthy();
    tap('blue');
    tap('red');
    expect(slots()).toBe('1blue2red34');
    expect(screen.getByTestId<HTMLButtonElement>('wire-blue').disabled).toBe(true);
    expect(screen.getByTestId('wire-blue').textContent).toBe('blue1');
    fireEvent.click(screen.getByText('Undo'));
    expect(slots()).toBe('1blue234');
    fireEvent.click(screen.getByText('Clear'));
    expect(slots()).toBe('1234');
  });

  it('enables Cut only when full and the cooldown is over, and sends the sequence once', async () => {
    const p = props();
    const { rerender } = render(<WireInput {...p} canAct={false} />);
    for (const w of ['red', 'blue', 'yellow']) tap(w);
    expect(cutButton().disabled).toBe(true);
    tap('green');
    expect(screen.getByTestId<HTMLButtonElement>('wire-white').disabled).toBe(true);
    expect(cutButton().disabled).toBe(true);
    rerender(<WireInput {...p} />);
    expect(cutButton().disabled).toBe(false);
    await act(async () => {
      fireEvent.click(cutButton());
      await Promise.resolve();
    });
    expect(p.act).toHaveBeenCalledWith({ value: ['red', 'blue', 'yellow', 'green'] });
    expect(slots()).toBe('1234');
  });
});

describe('sending a sequence', () => {
  it('keeps the slots and words the refusal when the server refuses', async () => {
    const p = props({ act: vi.fn(() => Promise.resolve({ ok: false, code: 'ALREADY_GUESSED' })) });
    render(<WireInput {...p} />);
    for (const w of ['red', 'blue', 'yellow', 'green']) tap(w);
    await act(async () => {
      fireEvent.click(cutButton());
      await Promise.resolve();
    });
    expect(screen.getByRole('status').textContent).toBe('You already tried that order.');
    expect(slots()).toBe('1red2blue3yellow4green');
  });

  it('uses the keys 1–8, Backspace, Escape and Enter', async () => {
    const p = props();
    render(<WireInput {...p} />);
    const row = screen.getByTestId('bd-input');
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(screen.getByRole('status').textContent).toBe('Choose 4 different wires of this bomb.');
    for (const key of ['2', '1', '9', '3']) fireEvent.keyDown(row, { key });
    expect(slots()).toBe('1blue2red3yellow4');
    fireEvent.keyDown(row, { key: 'Backspace' });
    expect(slots()).toBe('1blue2red34');
    fireEvent.keyDown(row, { key: 'Escape' });
    expect(slots()).toBe('1234');
    for (const key of ['4', '5', '6', '1']) fireEvent.keyDown(row, { key });
    fireEvent.keyDown(row, { key: 'a' });
    await act(async () => {
      fireEvent.keyDown(row, { key: 'Enter' });
      await Promise.resolve();
    });
    expect(p.act).toHaveBeenCalledWith({ value: ['green', 'white', 'black', 'red'] });
  });
});

describe('the specials in the input row', () => {
  it('shows the hint in slot 1 and harmless wires struck and disabled', () => {
    render(<WireInput {...props({ view: { ...view, hint: 'red', harmless: ['black'] } })} />);
    expect(slots()).toBe('1hint: red234');
    const black = screen.getByTestId<HTMLButtonElement>('wire-black');
    expect(black.disabled).toBe(true);
    expect(black.textContent).toBe('blackharmless');
  });

  it('says to take out a wire marked harmless while in the slots, and does not send', () => {
    const p = props();
    const { rerender } = render(<WireInput {...p} />);
    for (const w of ['red', 'blue', 'yellow', 'green']) tap(w);
    rerender(<WireInput {...p} view={{ ...view, harmless: ['green'] }} />);
    expect(screen.getByText('The green wire is harmless now — take it out.')).toBeTruthy();
    fireEvent.click(cutButton());
    expect(p.act).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toBe(
      'That wire is harmless — it is not part of the sequence.',
    );
  });
});

describe('the explosion (02c §5.2)', () => {
  const answered = (receiveSeq: number, correct: number) => ({
    receiveSeq,
    receivedAt: receiveSeq * 1_000,
    value: ['blue', 'red', 'yellow', 'white'],
    feedback: { correct, defused: false },
    tier: 'wayOff',
    comment: 'Boom.',
  });

  it('flashes for about a second when a wrong first cut is answered, not for old answers', () => {
    vi.useFakeTimers();
    const p = props({ view: { ...view, guesses: [answered(1, 0)] } });
    const { rerender } = render(<WireInput {...p} />);
    expect(screen.queryByTestId('explosion')).toBeNull();
    rerender(<WireInput {...p} view={{ ...view, guesses: [answered(1, 0), answered(2, 2)] }} />);
    expect(screen.queryByTestId('explosion')).toBeNull();
    rerender(
      <WireInput
        {...p}
        view={{ ...view, guesses: [answered(1, 0), answered(2, 2), answered(3, 0)] }}
      />,
    );
    expect(screen.getByTestId('explosion').textContent).toContain('Boom!');
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(screen.queryByTestId('explosion')).toBeNull();
  });
});
