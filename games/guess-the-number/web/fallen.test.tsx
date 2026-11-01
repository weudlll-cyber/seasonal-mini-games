// @vitest-environment jsdom
/**
 * @file   games/guess-the-number/web/fallen.test.tsx
 * @module games/guess-the-number/web
 * @brief  The Fallen numbers panel of a Leaf Fall round and Leaf Fall's marked list row (T115).
 *
 * Responsibility: the panel lists every fallen number ascending with thousands separators and
 *                 names the count, only in an autumn round with its special on; its phone
 *                 button opens it as a sheet that Escape closes; "None yet." before the first
 *                 fall; the Leaf Fall row is marked as the special's (`special: true`).
 * Depends on:     vitest, @testing-library/react, ./PlayerPanel, ./SpectatorPanel, ./text
 * Spec:           docs/spec/02-game-guess-the-number.md §12; docs/spec/03-seasonal-specials.md §2.3
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PlayerPanel } from './PlayerPanel.js';
import { SpectatorPanel } from './SpectatorPanel.js';
import { gtnText } from './text.js';

afterEach(() => {
  cleanup();
});

const view = {
  range: { low: 1, high: 1_000 },
  removed: [5, 6],
  guesses: [],
  log: [],
  hint: null,
};

describe('the Fallen numbers panel (T115)', () => {
  const base = { act: vi.fn(), canAct: false, frostDelayMs: null, now: () => 0 };
  const fallen = { ...view, removed: [7, 1_500, 250_000] };

  it('lists every fallen number ascending, grouped, in a Leaf Fall round only', () => {
    render(<PlayerPanel {...base} view={fallen} season="autumn" specialOn />);
    expect(screen.getByTestId('fallen').textContent).toBe('Fallen numbers (3)');
    const chips = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(chips).toEqual(['7', '1,500', '250,000']);
    expect(screen.getByTestId('fallen-toggle').textContent).toBe('Fallen (3)');
    cleanup();
    render(<PlayerPanel {...base} view={fallen} season="autumn" specialOn={false} />);
    expect(screen.queryByTestId('fallen-panel')).toBeNull();
    cleanup();
    render(<SpectatorPanel view={{ ...fallen, log: [] }} names={{}} season="spring" specialOn />);
    expect(screen.queryByTestId('fallen-panel')).toBeNull();
  });

  it('opens as a sheet from its button and closes with Escape', () => {
    render(<SpectatorPanel view={{ ...view, log: [] }} names={{}} season="autumn" specialOn />);
    const panel = screen.getByTestId('fallen-panel');
    fireEvent.click(screen.getByTestId('fallen-toggle'));
    expect(panel.dataset['open']).toBe('true');
    fireEvent.keyDown(panel, { key: 'Escape' });
    expect(panel.dataset['open']).toBe('false');
  });

  it('says so while nothing has fallen', () => {
    render(<PlayerPanel {...base} view={{ ...view, removed: [] }} season="autumn" specialOn />);
    expect(screen.getByTestId('fallen-panel').textContent).toContain('None yet.');
  });

  it('names the fallen numbers in a list row marked as the special’s', () => {
    expect(gtnText.event({ type: 'NumbersRemoved', index: 1, numbers: [3, 1_200] }, {})).toEqual({
      text: 'Leaf Fall: 3 and 1,200 fell.',
      playerId: null,
      special: true,
    });
  });
});
