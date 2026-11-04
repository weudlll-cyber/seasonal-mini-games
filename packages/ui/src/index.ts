/**
 * @file   packages/ui/src/index.ts
 * @module ui
 * @brief  Public entry point of @smg/ui.
 *
 * Responsibility: shared React components and design tokens for web, admin and the game
 *                 screens: the ± sign toggle (./SignToggle), the open-and-close hook of menus
 *                 and panels (./useDisclosure), how many of a clipped list's items show
 *                 (./useFit), a player's marker and tag (./PlayerMark) and the one highlighted
 *                 player (./highlight), the CSS files beside it.
 * Depends on:     ./SignToggle, ./useDisclosure, ./useFit, ./PlayerMark, ./highlight
 * Used by:        ./index.test, apps/web, games/guess-the-number/web
 * Spec:           docs/spec/10-repository-structure.md §1
 */

// Package identity, so the shell is importable and the test runner has something to check.
export const PACKAGE_NAME = '@smg/ui';

export { flipSign, SignToggle } from './SignToggle.js';
export { useDisclosure, type Disclosure } from './useDisclosure.js';
export { fitCount, useFit } from './useFit.js';
export { flashHighlight, lit, setHighlight, useHighlight } from './highlight.js';
export { PlayerMark, type MarkView } from './PlayerMark.js';
