/**
 * @file   apps/web/src/shell/http.test.ts
 * @module web/shell
 * @brief  The client finds its base path from its own address (standalone or inside the website).
 *
 * Responsibility: "/" for a standalone install, "/games/mini-games/" inside the website, with or
 *                 without a hash route or a page file name.
 * Depends on:     vitest, ./http
 * Spec:           Bingo 09 §1
 */
import { describe, expect, it } from 'vitest';

import { basePathOf } from './http.js';

describe('the base path', () => {
  it('is the folder of the page address', () => {
    expect(basePathOf('https://bingo.example/')).toBe('/');
    expect(basePathOf('https://site.example/games/mini-games/#/match/ABC123')).toBe(
      '/games/mini-games/',
    );
    expect(basePathOf('https://site.example/games/mini-games/index.html')).toBe(
      '/games/mini-games/',
    );
  });
});
