// @vitest-environment jsdom
/**
 * @file   apps/web/src/components/fields.test.tsx
 * @module web/components
 * @brief  The number field takes a typed or pasted minus sign and clamps only on blur.
 *
 * Responsibility: "-" and an empty field stay as typed and reach the form as nothing; "-5"
 *                 and "-500", typed or pasted, reach it as numbers; a value outside the bounds
 *                 names them in the help line and is clamped on blur; an empty field goes back
 *                 to the form's value on blur; the ± button shows only where negatives are
 *                 allowed and flips the sign.
 * Depends on:     @testing-library/react, ./fields
 * Spec:           docs/spec/02-game-guess-the-number.md §12; DECISIONS T57
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState, type ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NumberField } from './fields.js';

afterEach(cleanup);

// The form around the field: it holds the value and records what the field handed it.
function Form(p: { readonly min: number; readonly seen: (v: number) => void }): ReactElement {
  const [value, setValue] = useState(1);
  return (
    <NumberField
      label="Lowest number"
      help="The secret is at least this."
      value={value}
      min={p.min}
      max={1_000_000}
      testId="low"
      onChange={(v) => {
        p.seen(v);
        setValue(v);
      }}
    />
  );
}

function field(min = -1_000_000) {
  const seen = vi.fn<(v: number) => void>();
  render(<Form min={min} seen={seen} />);
  return { input: screen.getByTestId<HTMLInputElement>('low'), seen };
}

describe('NumberField typing', () => {
  it('keeps a lone "-" as typed instead of turning it into 0', () => {
    const { input, seen } = field();
    // A number input reports an unfinished "-" as "" (the browser keeps showing the "-").
    fireEvent.change(input, { target: { value: '-' } });
    expect(input.value).toBe('');
    expect(seen).not.toHaveBeenCalled();
  });

  it('hands "-5" and "-500" to the form as they are typed', () => {
    const { input, seen } = field();
    fireEvent.change(input, { target: { value: '-5' } });
    expect(seen).toHaveBeenLastCalledWith(-5);
    fireEvent.change(input, { target: { value: '-50' } });
    fireEvent.change(input, { target: { value: '-500' } });
    expect(seen).toHaveBeenLastCalledWith(-500);
    expect(input.value).toBe('-500');
  });

  it('takes a pasted "-500"', () => {
    const { input, seen } = field();
    fireEvent.paste(input, { clipboardData: { getData: () => '-500' } });
    // The browser inserts the pasted text and fires the input event.
    fireEvent.change(input, { target: { value: '-500' } });
    expect(input.value).toBe('-500');
    expect(seen).toHaveBeenLastCalledWith(-500);
  });

  it('lets the field be cleared while editing and restores the value on blur', () => {
    const { input, seen } = field();
    fireEvent.change(input, { target: { value: '' } });
    expect(input.value).toBe('');
    expect(seen).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(input.value).toBe('1');
    expect(seen).not.toHaveBeenCalled();
  });
});

describe('NumberField bounds and sign', () => {
  it('names the bounds while the value is outside them and clamps on blur', () => {
    const { input, seen } = field();
    fireEvent.change(input, { target: { value: '-2000000' } });
    expect(seen).not.toHaveBeenCalled();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const help = screen.getByText(/Allowed: -1000000 to 1000000\./);
    expect(help.className).toContain('smg-field-help--error');
    expect(input.getAttribute('aria-describedby')).toBe(help.id);
    fireEvent.blur(input);
    expect(input.value).toBe('-1000000');
    expect(seen).toHaveBeenLastCalledWith(-1_000_000);
    expect(screen.getByText('The secret is at least this.').className).not.toContain('error');
  });

  it('offers the ± button only where negatives are allowed, and it flips the sign', () => {
    const { input, seen } = field();
    fireEvent.change(input, { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Change the sign: Lowest number' }));
    expect(input.value).toBe('-500');
    expect(seen).toHaveBeenLastCalledWith(-500);
    // The field keeps its label as its accessible name; the button sits outside the label.
    expect(screen.getByLabelText('Lowest number')).toBe(input);
    cleanup();
    field(1);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
