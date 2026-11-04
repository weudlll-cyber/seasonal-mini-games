// @vitest-environment jsdom
/**
 * @file   games/bomb-defusal/web/slots.test.tsx
 * @module games/bomb-defusal/web
 * @brief  The slots: tapping a filled one empties it; Spring Herald's colour locked in slot 1.
 *
 * Responsibility: the help line names how the slots fill; a tapped slot empties just that
 *                 slot and the next wire fills the first empty one; the hint's colour stands in slot 1 from the start, named "hint: red in
 *                 place 1", and no tap, Undo, Clear or Backspace empties it (O60); Cut sends
 *                 the whole sequence with it.
 * Depends on:     vitest, @testing-library/react, ./WireInput
 * Spec:           docs/spec/02c-game-bomb-defusal.md §8.1, §11
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WireInput } from './WireInput.js';

afterEach(() => {
  cleanup();
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

function setup(hint: string | null) {
  const send = vi.fn(() => Promise.resolve({ ok: true }));
  render(
    <WireInput
      view={{ ...view, hint }}
      act={send}
      canAct
      frostDelayMs={null}
      now={() => 0}
      season="spring"
      specialOn
      waitS={null}
      names={{}}
      colors={{}}
    />,
  );
  return send;
}

const tap = (wire: string) => {
  fireEvent.click(screen.getByTestId(`wire-${wire}`));
};
const slots = () => screen.getByTestId('slots').textContent;
const button = (name: string) => screen.getByRole<HTMLButtonElement>('button', { name });

describe('the help line above the picker', () => {
  it('says how the slots fill, from slot 2 when the hint holds slot 1', () => {
    setup(null);
    expect(screen.getByTestId('bd-help').textContent).toBe(
      'Tap colours in cutting order: they fill 1 → 4. Tap a filled box to empty it; Clear starts over.',
    );
    cleanup();
    setup('red');
    expect(screen.getByTestId('bd-help').textContent).toContain('they fill 2 → 4.');
  });
});

describe('tapping a filled slot', () => {
  it('empties just that slot, and the next wire fills the first empty one', () => {
    setup(null);
    tap('blue');
    tap('red');
    tap('green');
    fireEvent.click(button('red in place 2, take it out'));
    expect(slots()).toBe('1blue23green4');
    tap('white');
    expect(slots()).toBe('1blue2white3green4');
    expect(screen.getByTestId<HTMLButtonElement>('wire-red').disabled).toBe(false);
  });
});

describe("Spring Herald's colour in slot 1 (O60)", () => {
  it('stands there from the start, named for a screen reader, its wire disabled', () => {
    setup('red');
    expect(slots()).toBe('1red234');
    expect(screen.getByLabelText('hint: red in place 1')).toBeTruthy();
    expect(screen.queryByTestId('slot-0')).toBeNull();
    expect(screen.getByTestId<HTMLButtonElement>('wire-red').disabled).toBe(true);
    // Nothing to take out yet: Undo and Clear wait for a wire of the player's own.
    expect(button('Undo').disabled).toBe(true);
    expect(button('Clear').disabled).toBe(true);
  });

  it('stays through Undo, Clear and Backspace, and the next wire goes to slot 2', () => {
    setup('red');
    tap('blue');
    tap('green');
    fireEvent.click(button('Undo'));
    expect(slots()).toBe('1red2blue34');
    fireEvent.keyDown(screen.getByTestId('bd-input'), { key: 'Backspace' });
    fireEvent.keyDown(screen.getByTestId('bd-input'), { key: 'Backspace' });
    expect(slots()).toBe('1red234');
    tap('white');
    fireEvent.click(button('Clear'));
    expect(slots()).toBe('1red234');
  });

  it('is sent with the rest of the sequence', async () => {
    const send = setup('red');
    for (const w of ['blue', 'green', 'white']) tap(w);
    await act(async () => {
      fireEvent.click(screen.getByTestId('cut-button'));
      await Promise.resolve();
    });
    expect(send).toHaveBeenCalledWith({ value: ['red', 'blue', 'green', 'white'] });
    expect(slots()).toBe('1red234');
  });
});
