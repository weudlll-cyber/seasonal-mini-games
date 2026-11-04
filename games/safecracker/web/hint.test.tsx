// @vitest-environment jsdom
/**
 * @file   games/safecracker/web/hint.test.tsx
 * @module games/safecracker/web
 * @brief  Spring Herald's digit locked in its box of the code input (O59).
 *
 * Responsibility: the hint's box holds its digit from the start, read-only, named "hint: 3 in
 *                 place 2" for a screen reader; typing, Backspace, a paste and an accepted
 *                 send never change it; focus steps over it both ways; the code sent holds it.
 * Depends on:     vitest, @testing-library/react, ./CodeInput
 * Spec:           docs/spec/02b-game-safecracker.md §7.1, §10
 */
import type { ActReply } from '@smg/game-sdk';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CodeInput } from './CodeInput.js';

afterEach(() => {
  cleanup();
});

// A 4-digit code whose 2nd digit (position 1) is 3.
const view = {
  length: 4,
  digits: 10,
  fallen: [],
  hint: { position: 1, digit: 3 },
  guesses: [],
  log: [],
};

function setup() {
  const send = vi.fn((): Promise<ActReply> => Promise.resolve({ ok: true }));
  render(
    <CodeInput
      view={view}
      act={send}
      canAct
      frostDelayMs={null}
      now={() => 0}
      season="spring"
      specialOn
      waitS={null}
      names={{ p1: 'Anna' }}
      colors={{ p1: 'var(--color-spring)' }}
    />,
  );
  const boxes = [0, 1, 2, 3].map((i) =>
    screen.getByTestId<HTMLInputElement>(`code-box-${String(i)}`),
  );
  const typeIn = (i: number, value: string) => {
    fireEvent.change(boxes[i] as HTMLElement, { target: { value } });
  };
  return { send, boxes, typeIn };
}

describe('the locked hint box (O59)', () => {
  it('holds the digit from the start, read-only and named for a screen reader', () => {
    const { boxes } = setup();
    const box = boxes[1];
    expect(box?.value).toBe('3');
    expect(box?.readOnly).toBe(true);
    expect(box?.className).toContain('sc-box--hint');
    expect(box?.getAttribute('aria-label')).toBe('Digit 2 of 4, hint: 3 in place 2');
  });

  it('ignores typing in it, and focus steps over it both ways', () => {
    const { boxes, typeIn } = setup();
    typeIn(1, '9');
    expect(boxes[1]?.value).toBe('3');
    typeIn(0, '5');
    expect(document.activeElement).toBe(boxes[2]);
    fireEvent.keyDown(boxes[2] as HTMLElement, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(boxes[0]);
  });

  it('keeps it on Backspace, which clears the box before it instead', () => {
    const { boxes, typeIn } = setup();
    typeIn(0, '5');
    fireEvent.keyDown(boxes[2] as HTMLElement, { key: 'Backspace' });
    expect(boxes.map((b) => b.value)).toEqual(['', '3', '', '']);
    expect(document.activeElement).toBe(boxes[0]);
  });

  it('refuses a paste that changes it and sends the code with it', async () => {
    const { send, boxes, typeIn } = setup();
    fireEvent.paste(boxes[0] as HTMLElement, { clipboardData: { getData: () => '1234' } });
    expect(screen.getByRole('status').textContent).toBe('Place 2 keeps the hint, 3.');
    typeIn(0, '5');
    typeIn(2, '6');
    typeIn(3, '7');
    await act(async () => {
      fireEvent.submit(boxes[0]?.closest('form') as HTMLElement);
      await Promise.resolve();
    });
    expect(send).toHaveBeenCalledWith({ value: '5367' });
    // The accepted code empties the boxes, the hint's stays.
    expect(boxes.map((b) => b.value)).toEqual(['', '3', '', '']);
  });
});
