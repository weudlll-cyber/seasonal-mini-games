// @vitest-environment jsdom
/**
 * @file   games/seasonal-target/web/quarters.test.tsx
 * @module games/seasonal-target/web
 * @brief  The grid's fallen tiles, target area and Spring Herald's two quarters (O61).
 *
 * Responsibility: fallen tiles hatched and named, tiles outside the target area dimmed and
 *                 named, both quarters tinted, each with its "Hint" tag on its tile nearest
 *                 the outer corner inside the area (T144).
 * Depends on:     vitest, @testing-library/react, ./fixtures
 * Spec:           docs/spec/02d-game-seasonal-target.md §8.1, §8.3, §8.4, §11
 */
import type { Quarter } from '@smg-game/seasonal-target';
import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { plainScreen, playerView, renderInput } from './fixtures.js';

afterEach(() => {
  cleanup();
  plainScreen();
});

const tile = (x: number, y: number) =>
  screen
    .getAllByTestId('tile')
    .find((t) => t.dataset['x'] === String(x) && t.dataset['y'] === String(y)) as HTMLElement;

describe('fallen, area and quarter', () => {
  it('hatches fallen tiles, dims tiles outside the area and tints both quarters', () => {
    const quarters: [Quarter, Quarter] = [
      { name: 'north-east', left: 11, right: 20, top: 1, bottom: 10 },
      { name: 'south-west', left: 1, right: 10, top: 11, bottom: 20 },
    ];
    renderInput(
      playerView({
        area: { left: 1, right: 15, top: 1, bottom: 20 },
        hint: quarters,
        fallen: [{ x: 3, y: 12 }],
      }),
    );
    // "Hint" once per quarter, on its tile nearest the corner inside the area (T144, O61).
    const tags = screen.getAllByTestId('hint-tag');
    expect(tags.map((t) => t.textContent)).toEqual(['Hint', 'Hint']);
    expect(tags.map((t) => t.dataset['corner'])).toEqual(['north-east', 'south-west']);
    expect(tags[0]?.closest<HTMLElement>('[data-x]')?.dataset['x']).toBe('15');
    expect(tags[0]?.closest<HTMLElement>('[data-x]')?.dataset['y']).toBe('1');
    expect(tile(3, 12).dataset['fallen']).toBe('true');
    expect(tile(3, 12).title).toBe('column 3, row 12: fallen');
    expect(tile(4, 12).dataset['fallen']).toBe('false');
    expect(tile(16, 1).dataset['out']).toBe('true');
    expect(tile(16, 1).title).toBe('column 16, row 1: outside the target area');
    expect(tile(15, 1).dataset['out']).toBe('false');
    expect(tile(11, 10).dataset['quarter']).toBe('true');
    expect(tile(10, 10).dataset['quarter']).toBe('false');
    expect(tile(11, 11).dataset['quarter']).toBe('false');
    expect(tile(4, 13).dataset['quarter']).toBe('true');
  });
});
