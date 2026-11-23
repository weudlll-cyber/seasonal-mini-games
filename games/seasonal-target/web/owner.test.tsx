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
 *                 game names finding "hit the target" (O136, O137). Of 2026-11-23 (O140): the
 *                 corner tag follows the number in the name; the result's grid is one focus
 *                 stop whose arrow keys move between the tiles, no tile a stop of its own.
 * Depends on:     vitest, @testing-library/react, ./fixtures, ./ResultPanel, ./TargetInput, ./text
 * Spec:           docs/spec/02d-game-seasonal-target.md §9, §11
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ne, own, playerView, props, renderInput, roster } from './fixtures.js';
import { ResultPanel } from './ResultPanel.js';
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
    expect(tileAt(4, 4)?.getAttribute('aria-label')).toMatch(/^9, you, column 4, row 4: You — /);
    expect(tileAt(5, 5)?.getAttribute('aria-label')).toBe('column 5, row 5');
  });
});

describe('the board of a player who hit their target (O136)', () => {
  it('stays in view, read-only, without the input row', () => {
    const view = playerView({ guesses: [own(1, 4, 4, ne), own(2, 7, 7, { kind: 'correct' })] });
    render(<TargetInput {...props(view, false)} done />);
    expect(screen.getByTestId('tile-grid').getAttribute('aria-readonly')).toBe('true');
    expect(tileAt(7, 7)?.textContent).toContain('◎');
    expect(tileAt(4, 4)?.getAttribute('aria-label')).toMatch(/^9, you, column 4, row 4/);
    expect(screen.queryByTestId('guess-button')).toBeNull();
    expect(screen.queryByTestId('selected')).toBeNull();
    expect(screen.queryByTestId('st-input')).toBeNull();
  });

  it('names finding in the game’s words', () => {
    expect(stText.found).toBe('hit the target');
  });
});

// The shared result of panels.test: Walter (a) found the target, the viewer b guessed once.
function showResult() {
  const guesses = {
    a: [{ value: { x: 12, y: 10 }, feedback: { kind: 'correct' } }],
    b: [{ value: { x: 4, y: 14 }, feedback: ne }],
  };
  const view = { map: { width: 20, height: 20 }, target: { x: 12, y: 10 }, targets: null };
  render(
    <ResultPanel
      view={{ ...view, guesses, fallen: [], closestMiss: null }}
      {...roster}
      viewerKey="b"
      part="reveal"
    />,
  );
  return screen.getByTestId('tile-grid');
}

describe('the decisions of 2026-11-23 on the tiles (O140)', () => {
  it('names the corner tag after the number', () => {
    showResult();
    expect(tileAt(4, 14)?.getAttribute('aria-label')).toMatch(/^9, you, column 4, row 14: /);
    expect(tileAt(12, 10)?.getAttribute('aria-label')).toMatch(/^a, column 12, row 10: /);
  });

  it('makes the result grid one focus stop whose arrow keys move between the tiles', () => {
    const grid = showResult();
    expect(grid.tabIndex).toBe(0);
    expect(document.querySelectorAll('[data-testid="tile"][tabindex]')).toHaveLength(0);
    expect(grid.getAttribute('aria-label')).toMatch(/Arrow keys move between the tiles\.$/);
    fireEvent.focus(grid);
    // The cursor starts on the target, shown as the selection while the grid has the focus.
    expect(grid.getAttribute('aria-activedescendant')).toBe(tileAt(12, 10)?.id);
    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    expect(grid.getAttribute('aria-activedescendant')).toBe(tileAt(13, 11)?.id);
    expect(tileAt(13, 11)?.getAttribute('data-selected')).toBe('true');
    fireEvent.blur(grid);
    expect(grid.getAttribute('aria-activedescendant')).toBeNull();
  });
});
