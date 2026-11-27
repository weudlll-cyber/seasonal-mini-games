/**
 * @file   apps/web/src/match/sharedCall.ts
 * @module web/match
 * @brief  The live shared call's id, from the docked screen to the result's way back.
 *
 * Responsibility: the id the kit's shared call slot reports (./DockedMatch, website mode only),
 *                 null without a live call or outside a docked screen; ./ResultBar shows the
 *                 kit's "Back to the call" with it. The game keeps it nowhere else (kit K77).
 * Depends on:     react
 * Used by:        ./DockedMatch, ./ResultBar
 * Spec:           docs/spec/07-integration.md §2
 */
import { createContext } from 'react';

export const SharedCallContext = createContext<number | null>(null);
