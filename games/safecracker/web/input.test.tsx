// @vitest-environment jsdom
/**
 * @file   games/safecracker/web/input.test.tsx
 * @module games/safecracker/web
 * @brief  The digit boxes: typing moves on, Backspace and arrows, paste, refusals, sending.
 *
 * Responsibility: one numeric box per digit; a typed digit fills its box and focuses the next;
 *                 Backspace in an empty box clears the one before and goes there; arrows move;
 *                 a full paste fills every box, a short one is refused; a digit outside the
 *                 digits in use or a fallen one is refused with its sentence and not sent; Try
 *                 code waits for a full code, the cooldown and an answer on its way; Enter
 *                 sends; the boxes empty after an accepted code unless typed on meanwhile, and
 *                 a refusal is worded.
 * Depends on:     vitest, @testing-library/react, ./CodeInput
 * Spec:           docs/spec/02b-game-safecracker.md §4, §10
 */
import type { ActReply } from '@smg/game-sdk';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CodeInput } from './CodeInput.js';

afterEach(() => {
  cleanup();
});

const view = { length: 4, digits: 8, fallen: [7], hint: null, guesses: [], log: [] };

function setup(reply: () => Promise<ActReply> = () => Promise.resolve({ ok: true })) {
  const send = vi.fn(reply);
  render(
    <CodeInput
      view={view}
      act={send}
      canAct
      frostDelayMs={null}
      now={() => 0}
      season="autumn"
      specialOn
      ring={<span data-testid="ring" />}
    />,
  );
  const boxes = [0, 1, 2, 3].map((i) => screen.getByTestId(`code-box-${String(i)}`));
  const typeIn = (i: number, value: string) => {
    fireEvent.change(boxes[i] as HTMLElement, { target: { value } });
  };
  return { send, boxes, typeIn, button: screen.getByTestId('guess-button') };
}

describe('the digit boxes', () => {
  it('has one numeric box per digit after the ring, and moves on as digits are typed', () => {
    const { boxes, typeIn, button } = setup();
    expect(screen.getByTestId('ring')).toBeTruthy();
    expect(boxes[0]?.getAttribute('inputmode')).toBe('numeric');
    expect(button.hasAttribute('disabled')).toBe(true);
    typeIn(0, '0');
    expect(document.activeElement).toBe(boxes[1]);
    typeIn(1, '4');
    typeIn(2, '2');
    typeIn(3, '6');
    expect(boxes.map((b) => (b as HTMLInputElement).value).join('')).toBe('0426');
    expect(button.hasAttribute('disabled')).toBe(false);
  });

  it('goes back with Backspace in an empty box and moves with the arrows', () => {
    const { boxes, typeIn } = setup();
    typeIn(0, '1');
    typeIn(1, '2');
    fireEvent.keyDown(boxes[2] as HTMLElement, { key: 'Backspace' });
    expect(document.activeElement).toBe(boxes[1]);
    expect((boxes[1] as HTMLInputElement).value).toBe('');
    fireEvent.keyDown(boxes[1] as HTMLElement, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(boxes[0]);
    fireEvent.keyDown(boxes[0] as HTMLElement, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(boxes[1]);
    fireEvent.keyDown(boxes[1] as HTMLElement, { key: 'a' });
    expect(document.activeElement).toBe(boxes[1]);
    typeIn(0, '');
    expect((boxes[0] as HTMLInputElement).value).toBe('');
  });

  it('refuses a digit out of use or fallen in its box, with the sentence', () => {
    const { boxes, typeIn } = setup();
    typeIn(0, '9');
    expect(screen.getByRole('status').textContent).toBe('Enter 4 digits, each from 0 to 7.');
    typeIn(0, '7');
    expect(screen.getByRole('status').textContent).toBe('That digit has fallen.');
    typeIn(0, 'x');
    expect((boxes[0] as HTMLInputElement).value).toBe('');
    typeIn(0, '3');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('fills every box from a full paste and refuses a short or fallen one', () => {
    const { boxes } = setup();
    const paste = (text: string) => {
      fireEvent.paste(boxes[0] as HTMLElement, { clipboardData: { getData: () => text } });
    };
    paste('12');
    expect(screen.getByRole('status').textContent).toBe('Enter 4 digits, each from 0 to 7.');
    paste('1 7 2 3');
    expect(screen.getByRole('status').textContent).toBe('That digit has fallen.');
    paste('0 4 2 6');
    expect(boxes.map((b) => (b as HTMLInputElement).value).join('')).toBe('0426');
    expect(document.activeElement).toBe(boxes[3]);
  });
});

describe('sending', () => {
  it('sends the code once, then empties the boxes', async () => {
    let answer: (r: ActReply) => void = () => undefined;
    const { send, boxes, typeIn, button } = setup(() => new Promise((r) => (answer = r)));
    for (const [i, d] of ['0', '4', '2', '6'].entries()) typeIn(i, d);
    fireEvent.submit(button.closest('form') as HTMLFormElement);
    expect(send).toHaveBeenCalledWith({ value: '0426' });
    expect(button.hasAttribute('disabled')).toBe(true);
    fireEvent.submit(button.closest('form') as HTMLFormElement);
    expect(send).toHaveBeenCalledTimes(1);
    await act(async () => {
      answer({ ok: true });
      await Promise.resolve();
    });
    expect(boxes.map((b) => (b as HTMLInputElement).value).join('')).toBe('');
  });

  it('keeps digits typed while the answer was on its way, and words a refusal', async () => {
    let answer: (r: ActReply) => void = () => undefined;
    const { boxes, typeIn, button } = setup(() => new Promise((r) => (answer = r)));
    for (const [i, d] of ['0', '4', '2', '6'].entries()) typeIn(i, d);
    fireEvent.submit(button.closest('form') as HTMLFormElement);
    typeIn(3, '5');
    await act(async () => {
      answer({ ok: true });
      await Promise.resolve();
    });
    expect(boxes.map((b) => (b as HTMLInputElement).value).join('')).toBe('0425');
    fireEvent.submit(button.closest('form') as HTMLFormElement);
    await act(async () => {
      answer({ ok: false, code: 'ALREADY_GUESSED' });
      await Promise.resolve();
    });
    expect(screen.getByRole('status').textContent).toBe('You already tried that code.');
    fireEvent.submit(button.closest('form') as HTMLFormElement);
    await act(async () => {
      answer({ ok: false, code: 'CODE_INVALID' });
      await Promise.resolve();
    });
    expect(screen.getByRole('status').textContent).toBe('Enter 4 digits, each from 0 to 7.');
  });

  it('does not send an incomplete code', () => {
    const { send, typeIn, button } = setup();
    typeIn(0, '1');
    fireEvent.submit(button.closest('form') as HTMLFormElement);
    expect(send).not.toHaveBeenCalled();
  });
});
