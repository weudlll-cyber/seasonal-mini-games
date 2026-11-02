/**
 * @file   apps/web/src/useReducedMotion.ts
 * @module web
 * @brief  React hook: does the viewer prefer reduced motion? (01 §13)
 *
 * Responsibility: read `prefers-reduced-motion: reduce` and follow changes (./useMediaQuery;
 *                 without matchMedia it animates). Components add their animation class only
 *                 when this returns false; motion.css also switches every animation off under
 *                 the same media query.
 * Depends on:     ./useMediaQuery
 * Used by:        ./components/*, ./game/CurrentBall
 * Spec:           Bingo 01 §13
 */
import { useMediaQuery } from './useMediaQuery.js';

export const useReducedMotion = (): boolean => useMediaQuery('(prefers-reduced-motion: reduce)');
