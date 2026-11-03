// @vitest-environment jsdom
/**
 * @file   games/guess-the-number/web/line.test.tsx
 * @module games/guess-the-number/web
 * @brief  The phone's info line of Guess The Number (T141).
 *
 * Responsibility: the line names the range ("1–1,000", "Any whole number" while hidden), in a
 *                 Leaf Fall round the "Fallen N" chip and only there, and the free hint.
 * Depends on:     vitest, @testing-library/react, ./InfoLine
 * Spec:           docs/spec/02-game-guess-the-number.md §12; docs/spec/09-testing-strategy.md §2
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { InfoLine } from './InfoLine.js';

afterEach(() => {
  cleanup();
});

const at = { names: {}, colors: {} };

describe("the phone's info line", () => {
  it('names the range and, in a Leaf Fall round, the fallen count', () => {
    const view = { range: { low: 1, high: 1_000 }, removed: [3, 9], hint: null, log: [] };
    render(<InfoLine view={view} {...at} season="autumn" specialOn />);
    expect(screen.getByTestId('gtn-line').textContent).toBe('1–1,000Fallen 2');
    cleanup();
    render(<InfoLine view={view} {...at} season="summer" specialOn />);
    expect(screen.getByTestId('gtn-line').textContent).toBe('1–1,000');
  });

  it('says "Any whole number" while the range is hidden, and gives the hint', () => {
    const view = { range: null, removed: [], hint: { kind: 'parity', odd: true }, log: [] };
    render(<InfoLine view={view} {...at} season="spring" specialOn />);
    expect(screen.getByTestId('gtn-line').textContent).toMatch(/^Any whole numberFree hint: /);
  });
});
