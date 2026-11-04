/**
 * @file   games/seasonal-target/web/hint.test.ts
 * @module games/seasonal-target/web
 * @brief  Where the "Hint" tag hangs: the quarter's tile nearest its corner inside the area (T144).
 *
 * Responsibility: with the whole grid in play the tag is on the quarter's outer corner tile;
 *                 when a halving leaves that tile outside the target area, on the first tile
 *                 of the quarter that is still inside, nearest the corner; none when no tile of
 *                 the quarter is left in the area.
 * Depends on:     vitest, ./TileGrid
 * Spec:           docs/spec/02d-game-seasonal-target.md §8.1, §8.4; docs/spec/09-testing-strategy.md §2
 */
import { describe, expect, it } from 'vitest';

import { tagTileOf } from './TileGrid.js';

const southEast = { name: 'south-east', left: 11, right: 20, top: 11, bottom: 20 } as const;
const northWest = { name: 'north-west', left: 1, right: 10, top: 1, bottom: 10 } as const;
const whole = { left: 1, right: 20, top: 1, bottom: 20 };

describe('the Hint tag', () => {
  it('hangs on the quarter’s corner tile while the whole grid is in play', () => {
    expect(tagTileOf(southEast, whole)).toEqual({ x: 20, y: 20 });
    expect(tagTileOf(northWest, null)).toEqual({ x: 1, y: 1 });
  });

  it('moves to the quarter’s first tile inside a halved area', () => {
    expect(tagTileOf(southEast, { left: 6, right: 15, top: 1, bottom: 20 })).toEqual({
      x: 15,
      y: 20,
    });
    expect(tagTileOf(northWest, { left: 4, right: 13, top: 6, bottom: 15 })).toEqual({
      x: 4,
      y: 6,
    });
  });

  it('is left out when no tile of the quarter is in the area', () => {
    expect(tagTileOf(southEast, { left: 1, right: 10, top: 1, bottom: 20 })).toBeNull();
  });
});
