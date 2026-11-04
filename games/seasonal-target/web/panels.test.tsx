// @vitest-environment jsdom
/**
 * @file   games/seasonal-target/web/panels.test.tsx
 * @module games/seasonal-target/web
 * @brief  What the tiles show, and the player, spectator and result panels.
 *
 * Responsibility: a guessed tile's colour step from the server's tier and its face by answer
 *                 mode (distance and arrow, distance, nothing; the found glyph); the viewer's
 *                 own tiles framed, the first guesser's tag in the corner (O62); a shared
 *                 tile showing the closest answer and naming every guess in its title and
 *                 label; a pending own answer "…" without a fill (fallen tiles, the area and
 *                 Spring's quarters: ./quarters.test); numbers drawn from `NUMBER_MIN_PX` (20 px) up only; a corner
 *                 dot moving the number. The player panel's legend, hint and area line (no
 *                 grid-size line) and the Fallen tiles in autumn; the spectator's grid and size
 *                 line; the result's target tile, every guess and every player in text.
 * Depends on:     vitest, @testing-library/react, ./fixtures, ./PlayerPanel, ./SpectatorPanel,
 *                 ./ResultPanel
 * Spec:           docs/spec/02d-game-seasonal-target.md §6, §8, §9, §10, §11
 */
import type { Quarter } from '@smg-game/seasonal-target';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ne,
  other,
  own,
  plainScreen,
  playerView,
  renderInput,
  roster,
  screenOf,
  faceOf,
} from './fixtures.js';
import { NUMBER_MIN_PX } from './measure.js';
import { PlayerPanel } from './PlayerPanel.js';
import { ResultPanel } from './ResultPanel.js';
import { SpectatorPanel } from './SpectatorPanel.js';

// jsdom draws the 400 tiles of a 20 × 20 grid in every test: up to 2.5 s alone on the
// development laptop (DECISIONS T206).
vi.setConfig({ testTimeout: 20_000 });

afterEach(() => {
  cleanup();
  plainScreen();
});

const tile = (x: number, y: number) =>
  screen
    .getAllByTestId('tile')
    .find((t) => t.dataset['x'] === String(x) && t.dataset['y'] === String(y)) as HTMLElement;

describe('tiles by answer mode', () => {
  it('fills a tile from the tier and shows distance and arrow, distance, or nothing', () => {
    renderInput(
      playerView({
        guesses: [
          own(1, 2, 2, ne),
          own(2, 3, 3, { kind: 'distance', distance: 4, tier: 'warm' }),
          own(3, 4, 4, { kind: 'closeness', tier: 'hot' }),
          own(4, 5, 5, { kind: 'closeness', tier: 'justMissed' }),
          own(5, 6, 6, { kind: 'correct' }),
        ],
      }),
    );
    expect(screen.getAllByTestId('tile')).toHaveLength(400);
    expect([2, 3, 4, 5, 6].map((k) => tile(k, k).dataset['step'])).toEqual([
      '1',
      '3',
      // Closeness mode: a step of its own for every tier (T151).
      'k5',
      'k7',
      'correct',
    ]);
    expect(faceOf(tile(2, 2))).toBe('9↗');
    expect(faceOf(tile(3, 3))).toBe('4');
    expect(faceOf(tile(4, 4))).toBe('');
    expect(faceOf(tile(6, 6))).toBe('◎');
    expect(tile(7, 7).dataset['step']).toBeUndefined();
    expect(tile(4, 4).title).toBe('column 4, row 4: You — Hot');
  });

  it('draws numbers from 20 px tiles up, and leaves them out below', () => {
    expect(NUMBER_MIN_PX).toBe(20);
    // 20 tiles of 20 px and 19 gaps of 2 px: 438 px of content.
    screenOf(438, false);
    renderInput(playerView({ guesses: [own(1, 2, 2, ne)] }));
    expect(faceOf(tile(2, 2))).toBe('9↗');
    cleanup();
    // One pixel less: just under 20 px a tile, colour and marks only.
    screenOf(437, false);
    renderInput(playerView({ guesses: [own(1, 2, 2, ne)] }));
    expect(faceOf(tile(2, 2))).toBe('');
    expect(tile(2, 2).dataset['step']).toBe('1');
    expect(tile(2, 2).title).toBe('column 2, row 2: You — 9 tiles away, to the north-east');
  });
});

describe('own, others and shared tiles', () => {
  it('frames own tiles, marks others in their colour, and shows "…" while an answer is held', () => {
    renderInput(
      playerView({
        guesses: [own(1, 1, 1, ne), own(3, 2, 2, null)],
        log: [
          other('b', own(2, 9, 9, ne)),
          other('c', own(4, 3, 3, null)),
          other('b', own(5, 4, 4, null)),
        ],
      }),
    );
    expect(tile(1, 1).dataset['own']).toBe('true');
    expect(tile(9, 9).dataset['own']).toBe('false');
    expect(tile(2, 2).dataset['pending']).toBe('true');
    expect(tile(2, 2).dataset['step']).toBeUndefined();
    expect(faceOf(tile(2, 2))).toBe('…');
    expect(tile(2, 2).title).toBe('column 2, row 2: You — answer arriving');
    // The first guesser's tag in the corner, "you" on the own tile (O62); the number moves
    // clear of it.
    expect(tile(9, 9).querySelector('.smg-mark-tag')?.textContent).toBe('b');
    expect(tile(9, 9).dataset['marked']).toBe('true');
    expect(tile(1, 1).querySelector('.smg-mark-tag')?.textContent).toBe('you');
    expect(tile(9, 9).getAttribute('aria-label')).toBe(
      'column 9, row 9: Anna — 9 tiles away, to the north-east',
    );
    // A guess under `numbers`: the tile and the player, no answer, no fill.
    expect(tile(4, 4).title).toBe('column 4, row 4: Anna guessed');
    expect(tile(4, 4).dataset['step']).toBeUndefined();
    // A player the list does not know is still named, without a tag of theirs.
    expect(tile(3, 3).title).toBe('column 3, row 3: c guessed');
    expect(tile(3, 3).dataset['marked']).toBe('false');
  });

  it('shows the closest answer on a tile several players guessed, and names them all', () => {
    const warm = { kind: 'direction', distance: 4, direction: 'S', tier: 'warm' } as const;
    renderInput(
      playerView({
        guesses: [own(1, 5, 5, ne)],
        log: [other('b', own(2, 5, 5, warm)), other('a', own(3, 5, 5, ne))],
      }),
    );
    const t = tile(5, 5);
    expect(t.dataset['step']).toBe('3');
    expect(faceOf(t)).toBe('4↓');
    expect(t.dataset['own']).toBe('true');
    expect(t.title).toBe(
      'column 5, row 5: You — 9 tiles away, to the north-east; ' +
        'Anna — 4 tiles away, to the south; Walter — 9 tiles away, to the north-east',
    );
    // The first guesser's tag: the viewer's own guess came first.
    expect(t.querySelector('.smg-mark-tag')?.textContent).toBe('you');
  });
});

describe('panels', () => {
  const quarters: [Quarter, Quarter] = [
    { name: 'north-west', left: 1, right: 10, top: 1, bottom: 10 },
    { name: 'south-east', left: 11, right: 20, top: 11, bottom: 20 },
  ];
  const base = {
    act: vi.fn(),
    canAct: false,
    frostDelayMs: null,
    now: () => 0,
    waitS: null,
    ...roster,
  };

  it('shows the legend, the hint, the area line and the Fallen tiles in autumn', () => {
    const view = playerView({
      hint: quarters,
      area: { left: 6, right: 15, top: 1, bottom: 20 },
      fallen: [{ x: 7, y: 2 }],
    });
    render(<PlayerPanel {...base} view={view} season="autumn" specialOn />);
    const panel = screen.getByTestId('st-player');
    // The legend first, above the hint and the Fallen tiles.
    expect(panel.firstElementChild?.getAttribute('data-testid')).toBe('heat-legend');
    expect(screen.getByTestId('heat-legend').textContent).toBe('ColdHot');
    expect(screen.getByTestId('hint').textContent).toBe(
      'Free hint: the target is in one of the two green quarters, north-west (columns 1–10, rows 1–10) or south-east (columns 11–20, rows 11–20).',
    );
    expect(screen.getByTestId('area-line').textContent).toBe(
      'Target area: columns 6–15, rows 1–20',
    );
    expect(screen.getByTestId('fallen').textContent).toBe('Fallen (1)');
    fireEvent.click(screen.getByTestId('fallen-toggle'));
    expect(screen.getByTestId('fallen-list').textContent).toBe('(7, 2)');
    cleanup();
    render(<PlayerPanel {...base} view={playerView()} season="spring" specialOn />);
    // The whole grid: no size line, the grid shows it.
    expect(screen.queryByTestId('area-line')).toBeNull();
    expect(screen.queryByTestId('fallen-panel')).toBeNull();
  });

  it('gives the spectator the grid with named guesses, and only the size in individual mode', () => {
    const view = {
      map: { width: 20, height: 20 },
      feedbackMode: 'direction',
      area: null,
      areaSize: { width: 10, height: 20 },
      hint: null,
      fallen: [],
      log: [other('b', own(1, 9, 9, null))],
    };
    render(<SpectatorPanel view={view} {...roster} season="autumn" specialOn />);
    expect(screen.getByTestId('area-line').textContent).toBe('Every target area: 10 × 20 tiles');
    expect(tile(9, 9).title).toBe('column 9, row 9: Anna guessed');
    expect(tile(9, 9).dataset['own']).toBe('false');
    expect(tile(9, 9).tabIndex).toBe(0);
    expect(screen.getByTestId('tile-grid').getAttribute('aria-readonly')).toBe('true');
    expect(screen.getByTestId('fallen').textContent).toBe('Fallen (0)');
  });
});
// Walter found the target, the viewer b guessed once.
const guesses = {
  a: [{ value: { x: 12, y: 10 }, feedback: { kind: 'correct' } }],
  b: [{ value: { x: 4, y: 14 }, feedback: ne }],
};

describe('result panel, shared', () => {
  it('marks the shared target and shows every guess', () => {
    const view = { map: { width: 20, height: 20 }, target: { x: 12, y: 10 }, targets: null };
    render(
      <ResultPanel
        view={{ ...view, guesses, fallen: [{ x: 1, y: 1 }], closestMiss: null }}
        {...roster}
        viewerKey="b"
        part="reveal"
      />,
    );
    expect(screen.getByTestId('secret').textContent).toBe('Target: column 12, row 10');
    // The same square board box as the round's, filling the result's height.
    expect(screen.getByTestId('tile-grid').parentElement?.className).toBe('st-board');
    const target = screen.getByTestId('target-tile').closest<HTMLElement>('[data-x]');
    expect([target?.dataset['x'], target?.dataset['y'], target?.dataset['step']]).toEqual([
      '12',
      '10',
      'correct',
    ]);
    expect(target?.title).toBe('column 12, row 10: the target; Walter — Target found!');
    expect(tile(4, 14).dataset['own']).toBe('true');
    expect(tile(12, 10).querySelector('.smg-mark-tag')?.textContent).toBe('a');
    expect(tile(1, 1).dataset['fallen']).toBe('true');
  });
});

describe('result panel, individual', () => {
  it('shows the viewer only their own target and guesses in individual mode, all in text', () => {
    const view = {
      map: { width: 20, height: 20 },
      target: null,
      targets: { a: { x: 12, y: 10 }, b: { x: 5, y: 5 } },
      guesses,
      fallen: [],
      closestMiss: null,
    };
    const props = { view, names: { a: 'Walter' }, colors: roster.colors, viewerKey: 'b' };
    render(<ResultPanel {...props} part="reveal" />);
    expect(screen.getByTestId('secret').textContent).toBe('Target: column 5, row 5');
    expect(screen.getByTestId('target-tile').closest<HTMLElement>('[data-x]')?.dataset['x']).toBe(
      '5',
    );
    expect(tile(4, 14).dataset['step']).toBe('1');
    // Walter's guess was about his own target: not on the viewer's grid.
    expect(tile(12, 10).dataset['step']).toBeUndefined();
    cleanup();
    // The history below the first part (T150).
    render(<ResultPanel {...props} part="history" />);
    const items = within(screen.getByRole('list', { name: 'Every guess' }))
      .getAllByRole('listitem')
      .map((li) => li.textContent);
    expect(items).toEqual([
      'b — target (5, 5): (4, 14) 9 away, NE ↗',
      'Walter — target (12, 10): (12, 10) Target found!',
    ]);
  });
});
