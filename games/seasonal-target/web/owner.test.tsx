// @vitest-environment jsdom
/**
 * @file   games/seasonal-target/web/owner.test.tsx
 * @module games/seasonal-target/web
 * @brief  The owner's decisions of 2026-11-22 in Seasonal Target: a tile's name, the board of a
 *         player who hit their target, the game's words for finding.
 *
 * Responsibility: a tile's accessible name starts with the number it shows, then its position
 *                 (WCAG 2.5.3, O135), and a tile without a number starts with its position; once
 *                 the player hit their target (`done`) the input draws the grid alone, read-only,
 *                 with their guesses, and no selection, Guess or coordinates (T78, O136); the
 *                 game names finding "hit the target" (O136, O137).
 * Depends on:     vitest, @testing-library/react, ./fixtures, ./TargetInput, ./text
 * Spec:           docs/spec/02d-game-seasonal-target.md §9, §11
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ne, own, playerView, props, renderInput } from './fixtures.js';
import { TargetInput } from './TargetInput.js';
import { stText } from './text.js';

// A 20 × 20 grid renders 400 tiles: past 5 s in a full run's parallel files (as ./input.test).
vi.setConfig({ testTimeout: 20_000 });

afterEach(() => {
  cleanup();
});

const tileAt = (x: number, y: number) =>
  document.querySelector(`[data-testid="tile"][data-x="${String(x)}"][data-y="${String(y)}"]`);

describe('a tile’s name (O135)', () => {
  it('starts with the number the tile shows, then its position', () => {
    renderInput(playerView({ guesses: [own(1, 4, 4, ne)] }));
    expect(tileAt(4, 4)?.getAttribute('aria-label')).toMatch(/^9, column 4, row 4: You — /);
    expect(tileAt(5, 5)?.getAttribute('aria-label')).toBe('column 5, row 5');
  });
});

describe('the board of a player who hit their target (O136)', () => {
  it('stays in view, read-only, without the input row', () => {
    const view = playerView({ guesses: [own(1, 4, 4, ne), own(2, 7, 7, { kind: 'correct' })] });
    render(<TargetInput {...props(view, false)} done />);
    expect(screen.getByTestId('tile-grid').getAttribute('aria-readonly')).toBe('true');
    expect(tileAt(7, 7)?.textContent).toContain('◎');
    expect(tileAt(4, 4)?.getAttribute('aria-label')).toMatch(/^9, column 4, row 4/);
    expect(screen.queryByTestId('guess-button')).toBeNull();
    expect(screen.queryByTestId('selected')).toBeNull();
    expect(screen.queryByTestId('st-input')).toBeNull();
  });

  it('names finding in the game’s words', () => {
    expect(stText.found).toBe('hit the target');
  });
});
