// @vitest-environment jsdom
/**
 * @file   games/seasonal-target/web/tags.test.tsx
 * @module games/seasonal-target/web
 * @brief  Players on the grid by tag (O62): the corner tag, its 20 px threshold, the highlight.
 *
 * Responsibility: with 22 players every guessed tile shows its first guesser's tag and one of
 *                 24 distinct colour-shape markers; tiles under 20 px leave the tag out, the
 *                 loupe still shows it; a highlighted player's tiles stay bright and the other
 *                 guessed tiles fade, empty tiles untouched; hovering a tile highlights its
 *                 first guesser, leaving clears it; the result's grid the same (T211).
 * Depends on:     vitest, @testing-library/react, @smg/game-sdk (marksOf), @smg/ui (highlight),
 *                 ./fixtures
 * Spec:           docs/spec/02d-game-seasonal-target.md §11
 */
import { marksOf } from '@smg/game-sdk';
import { setHighlight, useHighlight } from '@smg/ui';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { other, own, playerView, plainScreen, props, screenOf } from './fixtures.js';
import { ResultPanel } from './ResultPanel.js';
import { TargetInput } from './TargetInput.js';

// jsdom draws the 400 tiles of a 20 × 20 grid with 22 players' tags: up to 2 s a test alone on
// the development laptop (DECISIONS T206).
vi.setConfig({ testTimeout: 20_000 });

afterEach(() => {
  act(() => {
    setHighlight(null);
  });
  cleanup();
  plainScreen();
});

const close = { kind: 'closeness', tier: 'cold' } as const;
// The viewer p1 and 21 bots, each with one guess on a tile of their own.
const keys = [
  'p1',
  ...Array.from({ length: 21 }, (_, i) => `bot-${String(i + 1).padStart(2, '0')}`),
];
const log = keys
  .slice(1)
  .map((k, i) => other(k, own(i + 2, 1 + (i % 20), 2 + Math.floor(i / 20), close)));

function renderBusy(): void {
  const p = props(playerView({ feedbackMode: 'closeness', guesses: [own(1, 20, 20, close)], log }));
  render(
    <TargetInput
      {...p}
      names={Object.fromEntries(keys.map((k) => [k, k]))}
      colors={Object.fromEntries(keys.map((k) => [k, 'var(--color-spring)']))}
      marks={marksOf(keys, 'p1')}
      viewerKey="p1"
    />,
  );
}

const tile = (x: number, y: number) =>
  screen
    .getAllByTestId('tile')
    .find((t) => t.dataset['x'] === String(x) && t.dataset['y'] === String(y)) as HTMLElement;
const tagOn = (x: number, y: number) => tile(x, y).querySelector('.smg-mark-tag')?.textContent;

describe('tags on the tiles (O62)', () => {
  it('tags every guessed tile with its guesser, each marker its own', () => {
    renderBusy();
    expect(tagOn(1, 2)).toBe('b1');
    expect(tagOn(1, 3)).toBe('b21');
    expect(tagOn(20, 20)).toBe('you');
    expect(tile(5, 5).dataset['marked']).toBe('false');
    const shapes = screen
      .getAllByTestId('tile')
      .flatMap((t) => [...t.querySelectorAll<HTMLElement>('.smg-mark-shape')])
      .map((s) => `${s.style.getPropertyValue('--mark')}/${s.dataset['shape'] ?? ''}`);
    expect(shapes).toHaveLength(22);
    expect(new Set(shapes).size).toBe(22);
  });

  it('leaves the tag out on tiles under 20 px', () => {
    // 20 tiles in 380 px, less the gaps: 17.1 px a tile.
    screenOf(380, false);
    renderBusy();
    expect(tile(1, 2).querySelector('.smg-mark-tag')).toBeNull();
    expect(tile(1, 2).dataset['marked']).toBe('false');
  });
});

describe('the highlighted player', () => {
  it("keeps the player's tiles bright and fades the other guessed tiles", () => {
    renderBusy();
    act(() => {
      setHighlight('bot-03');
    });
    expect(tile(3, 2).dataset['hl']).toBe('on');
    expect(tile(1, 2).dataset['hl']).toBe('off');
    expect(tile(20, 20).dataset['hl']).toBe('off');
    expect(tile(5, 5).dataset['hl']).toBeUndefined();
  });

  it('is set by hovering a tile and cleared by leaving the grid', () => {
    let seen: string | null = null;
    function Spy(): null {
      seen = useHighlight();
      return null;
    }
    render(<Spy />);
    renderBusy();
    fireEvent.mouseOver(tile(4, 2));
    expect(seen).toBe('bot-04');
    fireEvent.mouseLeave(screen.getByTestId('tile-grid'));
    expect(seen).toBeNull();
  });
});

describe('the result grid (T211)', () => {
  it("carries the round's tags and lights the highlighted player's tiles", () => {
    const guesses = {
      'bot-01': [{ value: { x: 3, y: 3 }, feedback: close }],
      p1: [{ value: { x: 5, y: 5 }, feedback: close }],
    };
    render(
      <ResultPanel
        view={{
          map: { width: 20, height: 20 },
          target: { x: 9, y: 9 },
          targets: null,
          guesses,
          fallen: [],
          closestMiss: null,
        }}
        names={{ p1: 'dev-host', 'bot-01': 'bot-01' }}
        colors={{ p1: 'var(--color-spring)', 'bot-01': 'var(--color-winter)' }}
        marks={marksOf(['p1', 'bot-01'], 'p1')}
        viewerKey="p1"
        part="reveal"
      />,
    );
    expect(tagOn(3, 3)).toBe('b1');
    expect(tagOn(5, 5)).toBe('you');
    act(() => {
      setHighlight('bot-01');
    });
    expect(tile(3, 3).dataset['hl']).toBe('on');
    expect(tile(5, 5).dataset['hl']).toBe('off');
  });
});
