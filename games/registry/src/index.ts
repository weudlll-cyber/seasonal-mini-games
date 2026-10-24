/**
 * @file   games/registry/src/index.ts
 * @module games/registry
 * @brief  The registered game modules, for the server.
 *
 * Responsibility: one line per game (04 §4.6): its module and its conformance kit. The platform finds games only here; the
 *                 player client has the matching web half (games/registry/web).
 * Depends on:     @smg-game/guess-the-number
 * Used by:        apps/server, ./conformance.test
 * Spec:           docs/spec/04-software-architecture.md §4.6, docs/spec/10-repository-structure.md §1
 */
import { gtnConformance, guessTheNumber } from '@smg-game/guess-the-number';

export const GAMES = [{ module: guessTheNumber, conformance: gtnConformance }] as const;
