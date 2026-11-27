/**
 * @file   apps/web/src/noFixedColours.test.ts
 * @module web
 * @brief  No component hard-codes a colour: every screen works in the light and dark theme.
 *
 * Responsibility: the kit's `findFixedColours` over every .tsx file of the client finds nothing;
 *                 colours come from the tokens. A fixed dark colour would break the light theme.
 * Depends on:     vitest, node:url, @seasonal/kit/testing
 * Spec:           Bingo 01 §13
 */
import { fileURLToPath } from 'node:url';

import { findFixedColours } from '@seasonal/kit/testing';
import { describe, expect, it } from 'vitest';

describe('theme-safe components', () => {
  it('uses tokens, never a fixed hex colour, in every component', () => {
    expect(findFixedColours([fileURLToPath(new URL('.', import.meta.url))])).toEqual([]);
  });
});
