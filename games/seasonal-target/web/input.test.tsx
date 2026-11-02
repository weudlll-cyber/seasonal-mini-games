// @vitest-environment jsdom
/**
 * @file   games/seasonal-target/web/input.test.tsx
 * @module games/seasonal-target/web
 * @brief  The input's behaviour: selecting on the tile grid, the loupe, Guess and its refusals.
 *
 * Responsibility: the selection starts in the middle of the target area, moves with the
 *                 keyboard arrows on the focused grid, the arrow buttons and the Column and Row
 *                 fields, follows a click on a tile, and stays inside the area; "Selected:
 *                 column …, row …" says where; Guess (and Enter) sends `{ value: { x, y } }`
 *                 and nothing else; a fallen or tried tile is refused at once without sending;
 *                 a server `OUT_OF_MAP` on the grid says "outside the target area"; Guess reads
 *                 "Wait 6 s" during the cooldown. On a phone with small tiles the first tap
 *                 opens the loupe around it (clamped at the edges), a tap in it selects, Close
 *                 and Guess close it, and the fields live only there; with large tiles a tap
 *                 selects directly.
 * Depends on:     vitest, @testing-library/react, ./fixtures, ./TargetInput
 * Spec:           docs/spec/02d-game-seasonal-target.md §4, §11
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ne, own, plainScreen, playerView, renderInput, roster, screenOf } from './fixtures.js';
import { TargetInput } from './TargetInput.js';

afterEach(() => {
  cleanup();
  plainScreen();
});

const selected = () => screen.getByTestId('selected').textContent;
const tile = (x: number, y: number, id = 'tile') =>
  screen
    .getAllByTestId(id)
    .find((t) => t.dataset['x'] === String(x) && t.dataset['y'] === String(y));

describe('selecting', () => {
  it('moves the selection with the keyboard, the arrow buttons and the fields, inside the area', () => {
    renderInput(playerView({ area: { left: 6, right: 15, top: 1, bottom: 20 } }));
    expect(selected()).toBe('Selected: column 10, row 10');
    const grid = screen.getByTestId('tile-grid');
    fireEvent.keyDown(grid, { key: 'ArrowUp' });
    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    fireEvent.keyDown(grid, { key: 'a' });
    expect(selected()).toBe('Selected: column 11, row 9');
    expect(tile(11, 9)?.dataset['selected']).toBe('true');
    expect(grid.getAttribute('aria-activedescendant')).toBe(tile(11, 9)?.id);
    fireEvent.click(screen.getByRole('button', { name: 'Move south' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move west' }));
    expect(selected()).toBe('Selected: column 10, row 10');
    fireEvent.change(screen.getByLabelText('Column'), { target: { value: '2' } });
    // Clamped to the area's west edge.
    expect(selected()).toBe('Selected: column 6, row 10');
    fireEvent.change(screen.getByLabelText('Row'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Row'), { target: { value: '3' } });
    expect(selected()).toBe('Selected: column 6, row 3');
    expect(screen.getByTestId('ring')).toBeTruthy();
  });

  it('selects the clicked tile, and the nearest one inside the area', () => {
    renderInput(playerView({ area: { left: 6, right: 15, top: 1, bottom: 20 } }));
    fireEvent.click(tile(12, 7) as HTMLElement);
    expect(selected()).toBe('Selected: column 12, row 7');
    fireEvent.click(tile(2, 7) as HTMLElement);
    expect(selected()).toBe('Selected: column 6, row 7');
    expect(screen.queryByTestId('loupe')).toBeNull();
  });
});

describe('guessing', () => {
  it('sends only the selected tile on Guess, and Enter guesses too', async () => {
    const send = renderInput(playerView());
    fireEvent.click(screen.getByTestId('guess-button'));
    await act(() => Promise.resolve());
    expect(send).toHaveBeenCalledWith({ value: { x: 10, y: 10 } });
    fireEvent.keyDown(screen.getByTestId('tile-grid'), { key: 'Enter' });
    await act(() => Promise.resolve());
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('refuses a fallen or tried tile at once without sending', () => {
    const send = renderInput(
      playerView({ fallen: [{ x: 10, y: 10 }], guesses: [own(1, 10, 9, ne)] }),
    );
    fireEvent.click(screen.getByTestId('guess-button'));
    expect(screen.getByRole('status').textContent).toBe('That cell has fallen.');
    fireEvent.click(screen.getByRole('button', { name: 'Move north' }));
    fireEvent.click(screen.getByTestId('guess-button'));
    expect(screen.getByRole('status').textContent).toBe('You already tried that cell.');
    expect(send).not.toHaveBeenCalled();
    expect(screen.getByTestId('last-answer').textContent).toBe(
      'Last guess: 9 cells away, to the north-east',
    );
  });

  it('says "outside the target area" for a server OUT_OF_MAP on the grid', async () => {
    const send = vi.fn(() => Promise.resolve({ ok: false, code: 'OUT_OF_MAP' }));
    render(
      <TargetInput
        view={playerView()}
        act={send}
        canAct
        frostDelayMs={null}
        now={() => 0}
        season="winter"
        specialOn
        waitS={null}
        {...roster}
      />,
    );
    fireEvent.click(screen.getByTestId('guess-button'));
    await act(() => Promise.resolve());
    expect(screen.getByRole('status').textContent).toBe('That cell is outside the target area.');
  });

  it('keeps Guess disabled and counting during the cooldown, and Enter does nothing', () => {
    const send = renderInput(playerView(), false, 6);
    const button = screen.getByTestId<HTMLButtonElement>('guess-button');
    expect(button.disabled).toBe(true);
    expect(button.textContent).toBe('Wait 6 s');
    fireEvent.keyDown(screen.getByTestId('tile-grid'), { key: 'Enter' });
    expect(send).not.toHaveBeenCalled();
  });
});

describe('the loupe on a phone', () => {
  it('opens on the first tap with 5 × 5 tiles around it, and a tap in it selects', async () => {
    // 20 tiles across 240 px: 12 px a tile, too small for a finger.
    screenOf(240, true);
    const send = renderInput(playerView({ guesses: [own(1, 9, 9, ne)] }));
    // On a phone the fields and arrows live in the loupe only.
    expect(screen.queryByLabelText('Column')).toBeNull();
    fireEvent.click(tile(8, 8) as HTMLElement);
    const loupe = screen.getByTestId('loupe');
    const tiles = within(loupe).getAllByTestId('loupe-tile');
    expect(tiles).toHaveLength(25);
    expect([tiles[0]?.dataset['x'], tiles[0]?.dataset['y']]).toEqual(['6', '6']);
    // The same fill and number as on the grid, though the grid's tiles are too small for it.
    expect(tile(9, 9, 'loupe-tile')?.dataset['step']).toBe('1');
    expect(tile(9, 9, 'loupe-tile')?.textContent).toBe('9↗');
    expect(tile(9, 9)?.textContent).toBe('');
    fireEvent.click(tile(10, 7, 'loupe-tile') as HTMLElement);
    expect(selected()).toBe('Selected: column 10, row 7');
    // The window stays put while the selection is inside it.
    expect(within(loupe).getAllByTestId('loupe-tile')[0]?.dataset['x']).toBe('6');
    fireEvent.click(within(loupe).getByRole('button', { name: 'Move east' }));
    fireEvent.click(within(loupe).getByRole('button', { name: 'Move east' }));
    // The first step east left the window: it moved to centre on column 11.
    expect(selected()).toBe('Selected: column 12, row 7');
    expect(within(loupe).getAllByTestId('loupe-tile')[0]?.dataset['x']).toBe('9');
    fireEvent.click(screen.getByTestId('guess-button'));
    await act(() => Promise.resolve());
    expect(send).toHaveBeenCalledWith({ value: { x: 12, y: 7 } });
    expect(screen.queryByTestId('loupe')).toBeNull();
  });

  it('clamps the window at the edges and closes with Close', () => {
    screenOf(240, true);
    renderInput(playerView());
    fireEvent.click(tile(1, 20) as HTMLElement);
    const tiles = within(screen.getByTestId('loupe')).getAllByTestId('loupe-tile');
    expect(tiles.map((t) => `${t.dataset['x'] ?? ''},${t.dataset['y'] ?? ''}`).slice(0, 2)).toEqual(
      ['1,16', '2,16'],
    );
    expect(tiles.at(-1)?.dataset['x']).toBe('5');
    expect(tiles.at(-1)?.dataset['y']).toBe('20');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByTestId('loupe')).toBeNull();
    expect(selected()).toBe('Selected: column 1, row 20');
  });

  it('selects directly when the tiles are large enough for a finger', () => {
    // 20 tiles across 1 000 px: 50 px a tile.
    screenOf(1_000, true);
    renderInput(playerView());
    fireEvent.click(tile(3, 4) as HTMLElement);
    expect(selected()).toBe('Selected: column 3, row 4');
    expect(screen.queryByTestId('loupe')).toBeNull();
  });
});
