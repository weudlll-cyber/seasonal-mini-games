// @vitest-environment jsdom
/**
 * @file   games/guess-the-number/web/input.test.tsx
 * @module games/guess-the-number/web
 * @brief  The game's input row: whole numbers, the sign, refusals, and what the player typed.
 *
 * Responsibility: the input row takes negative whole numbers (± flips the sign), words the
 *                 game's own refusal, refuses a fallen number at once without sending it
 *                 ("Already fallen.", O37), and keeps what was typed across the round opening
 *                 and while an answer is on its way, emptying the field once the guess sent is
 *                 answered (T76). Split out of ./panels.test (night 7).
 * Depends on:     vitest, @testing-library/react, ./fixtures, ./PlayerPanel
 * Spec:           docs/spec/02-game-guess-the-number.md §7, §12; docs/spec/09-testing-strategy.md §2
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { view, who } from './fixtures.js';
import { GuessInput } from './PlayerPanel.js';

afterEach(() => {
  cleanup();
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
