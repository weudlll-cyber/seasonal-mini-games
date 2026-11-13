/**
 * @file   games/registry/src/testing.ts
 * @module games/registry
 * @brief  For tests only: the phased fixture game as an installed game.
 *
 * Responsibility: the entry @smg-game/registry/testing, so the server's tests can run a
 *                 phased round (04 §4.8) with the registry's games plus the fixture; no
 *                 production code imports it, and the fixture is not in `GAMES`.
 * Depends on:     ./index (install), ./phasedFixture
 * Used by:        apps/server/test
 * Spec:           docs/spec/09-testing-strategy.md §4.2
 */
import { install, type InstalledGame } from './index.js';
import { sidesEntry } from './phasedFixture.js';

export { SIDES_PLAN } from './phasedFixture.js';

export const SIDES_FIXTURE: InstalledGame = install(sidesEntry);
