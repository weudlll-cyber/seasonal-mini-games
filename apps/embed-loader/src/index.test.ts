/**
 * @file   apps/embed-loader/src/index.test.ts
 * @module embed-loader
 * @brief  Smoke test proving Vitest discovers this workspace project.
 *
 * Responsibility: import the package entry point and check its identity.
 * Depends on:     ./index
 * Spec:           Bingo 12
 */
import { describe, expect, it } from 'vitest';

import { PACKAGE_NAME } from './index.js';

describe('@smg/embed-loader', () => {
  it('is discovered by the test runner', () => {
    expect(PACKAGE_NAME).toBe('@smg/embed-loader');
  });
});
