// @vitest-environment jsdom
/**
 * @file   games/seasonal-target/web/panels.test.tsx
 * @module games/seasonal-target/web
 * @brief  What the tiles show, and the player, spectator and result panels.
 *
 * Responsibility: a guessed tile's colour step from the server's tier and its face by answer
 *                 mode (distance and arrow, distance, nothing; the found glyph); the viewer's
 *                 own tiles framed, others' with a corner mark in their list colour; a shared
 *                 tile showing the closest answer and naming every guess in its title and
 *                 label; a pending own answer "…" without a fill; fallen tiles hatched, tiles
 *                 outside the target area dimmed, Spring's quarter tinted; numbers left out on
 *                 tiles too small to read; the heat legend. The player panel's hint, area and
 *                 size lines and the Fallen cells in autumn; the spectator's grid and size line;
 *                 the result's target tile, every guess and every player in text.
 * Depends on:     vitest, @testing-library/react, ./fixtures, ./PlayerPanel, ./SpectatorPanel,
 *                 ./ResultPanel
 * Spec:           docs/spec/02d-game-seasonal-target.md §6, §8, §9, §10, §11
 */
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
} from './fixtures.js';
import { PlayerPanel } from './PlayerPanel.js';
import { ResultPanel } from './ResultPanel.js';
import { SpectatorPanel } from './SpectatorPanel.js';

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
      '4',
      '5',
      'correct',
    ]);
    expect(tile(2, 2).textContent).toBe('9↗');
    expect(tile(3, 3).textContent).toBe('4');
    expect(tile(4, 4).textContent).toBe('');
    expect(tile(6, 6).textContent).toBe('◎');
    expect(tile(7, 7).dataset['step']).toBeUndefined();
    expect(tile(4, 4).title).toBe('column 4, row 4: You — Hot');
    expect(screen.getByTestId('heat-legend').textContent).toBe('ColdHot');
  });

  it('leaves the numbers out when the tiles are too small to read', () => {
    // 20 tiles across 300 px on a desktop: 15 px a tile.
    screenOf(300, false);
    renderInput(playerView({ guesses: [own(1, 2, 2, ne)] }));
    expect(tile(2, 2).textContent).toBe('');
    expect(tile(2, 2).dataset['step']).toBe('1');
    expect(tile(2, 2).title).toBe('column 2, row 2: You — 9 cells away, to the north-east');
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
    expect(tile(2, 2).textContent).toBe('…');
    expect(tile(2, 2).title).toBe('column 2, row 2: You — answer arriving');
    const mark = tile(9, 9).querySelector<HTMLElement>('.st-mark');
    expect(mark?.style.background).toBe('var(--color-winter)');
    expect(tile(9, 9).getAttribute('aria-label')).toBe(
      'column 9, row 9: Anna — 9 cells away, to the north-east',
    );
    // A guess under `numbers`: the tile and the player, no answer, no fill.
    expect(tile(4, 4).title).toBe('column 4, row 4: Anna guessed');
    expect(tile(4, 4).dataset['step']).toBeUndefined();
    // A player the list has no colour for still gets a mark, named by key.
    expect(tile(3, 3).title).toBe('column 3, row 3: c guessed');
    expect(tile(1, 1).querySelector('.st-mark')).toBeNull();
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
    expect(t.textContent).toBe('4↓');
    expect(t.dataset['own']).toBe('true');
    expect(t.title).toBe(
      'column 5, row 5: You — 9 cells away, to the north-east; ' +
        'Anna — 4 cells away, to the south; Walter — 9 cells away, to the north-east',
    );
    // The first other player's mark.
    expect(t.querySelector<HTMLElement>('.st-mark')?.style.background).toBe('var(--color-winter)');
  });
});

describe('fallen, area and quarter', () => {
  it('hatches fallen tiles, dims tiles outside the area and tints the quarter', () => {
    const quarter = { name: 'north-west', left: 1, right: 10, top: 1, bottom: 10 } as const;
    renderInput(
      playerView({
        area: { left: 1, right: 10, top: 1, bottom: 20 },
        hint: quarter,
        fallen: [{ x: 3, y: 12 }],
      }),
    );
    expect(tile(3, 12).dataset['fallen']).toBe('true');
    expect(tile(3, 12).title).toBe('column 3, row 12: fallen');
    expect(tile(4, 12).dataset['fallen']).toBe('false');
    expect(tile(11, 1).dataset['out']).toBe('true');
    expect(tile(11, 1).title).toBe('column 11, row 1: outside the target area');
    expect(tile(10, 1).dataset['out']).toBe('false');
    expect(tile(10, 10).dataset['quarter']).toBe('true');
    expect(tile(10, 11).dataset['quarter']).toBe('false');
  });
});

describe('panels', () => {
  const quarter = { name: 'north-west', left: 1, right: 10, top: 1, bottom: 10 } as const;
  const base = {
    act: vi.fn(),
    canAct: false,
    frostDelayMs: null,
    now: () => 0,
    waitS: null,
    ...roster,
  };

  it('shows the hint, the area or size line and the Fallen cells in autumn', () => {
    const view = playerView({
      hint: quarter,
      area: { left: 6, right: 15, top: 1, bottom: 20 },
      fallen: [{ x: 7, y: 2 }],
    });
    render(<PlayerPanel {...base} view={view} season="autumn" specialOn />);
    expect(screen.getByTestId('hint').textContent).toBe(
      'Free hint: the target is in the north-west quarter (columns 1–10, rows 1–10).',
    );
    expect(screen.getByTestId('area-line').textContent).toBe(
      'Target area: columns 6–15, rows 1–20',
    );
    expect(screen.getByTestId('fallen').textContent).toBe('Fallen cells (1)');
    fireEvent.click(screen.getByTestId('fallen-toggle'));
    expect(screen.getByTestId('fallen-list').textContent).toBe('(7, 2)');
    cleanup();
    render(<PlayerPanel {...base} view={playerView()} season="spring" specialOn />);
    expect(screen.getByTestId('area-line').textContent).toBe('Grid: 20 × 20 tiles');
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
    expect(screen.getByTestId('fallen').textContent).toBe('Fallen cells (0)');
  });
});

describe('result panel', () => {
  const guesses = {
    a: [{ value: { x: 12, y: 10 }, feedback: { kind: 'correct' } }],
    b: [{ value: { x: 4, y: 14 }, feedback: ne }],
  };

  it('marks the shared target and shows every guess', () => {
    const view = { map: { width: 20, height: 20 }, target: { x: 12, y: 10 }, targets: null };
    render(
      <ResultPanel
        view={{ ...view, guesses, fallen: [{ x: 1, y: 1 }], closestMiss: null }}
        {...roster}
        viewerKey="b"
      />,
    );
    expect(screen.getByTestId('secret').textContent).toBe('Target: column 12, row 10');
    const target = screen.getByTestId('target-tile').closest<HTMLElement>('[data-x]');
    expect([target?.dataset['x'], target?.dataset['y'], target?.dataset['step']]).toEqual([
      '12',
      '10',
      'correct',
    ]);
    expect(target?.title).toBe('column 12, row 10: the target; Walter — Target found!');
    expect(tile(4, 14).dataset['own']).toBe('true');
    expect(tile(12, 10).querySelector<HTMLElement>('.st-mark')?.style.background).toBe(
      'var(--color-summer)',
    );
    expect(tile(1, 1).dataset['fallen']).toBe('true');
  });

  it('shows the viewer only their own target and guesses in individual mode, all in text', () => {
    const view = {
      map: { width: 20, height: 20 },
      target: null,
      targets: { a: { x: 12, y: 10 }, b: { x: 5, y: 5 } },
      guesses,
      fallen: [],
      closestMiss: null,
    };
    render(
      <ResultPanel view={view} names={{ a: 'Walter' }} colors={roster.colors} viewerKey="b" />,
    );
    expect(screen.getByTestId('secret').textContent).toBe('Target: column 5, row 5');
    expect(screen.getByTestId('target-tile').closest<HTMLElement>('[data-x]')?.dataset['x']).toBe(
      '5',
    );
    expect(tile(4, 14).dataset['step']).toBe('1');
    // Walter's guess was about his own target: not on the viewer's grid.
    expect(tile(12, 10).dataset['step']).toBeUndefined();
    const items = within(screen.getByRole('list', { name: 'Every guess' }))
      .getAllByRole('listitem')
      .map((li) => li.textContent);
    expect(items).toEqual([
      'b — target (5, 5): (4, 14) 9 away, NE ↗',
      'Walter — target (12, 10): (12, 10) Target found!',
    ]);
  });
});
