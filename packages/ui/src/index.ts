/**
 * @file   packages/ui/src/index.ts
 * @module ui
 * @brief  Public entry point of @smg/ui.
 *
 * Responsibility: shared React components and design tokens for web, admin and the game
 *                 screens: the ± sign toggle so far (./SignToggle), the CSS files beside it.
 * Depends on:     ./SignToggle
 * Used by:        ./index.test, apps/web, games/guess-the-number/web
 * Spec:           docs/spec/10-repository-structure.md §1
 */

// Package identity, so the shell is importable and the test runner has something to check.
export const PACKAGE_NAME = '@smg/ui';

export { flipSign, SignToggle } from './SignToggle.js';
