/**
 * @file   packages/game-sdk/src/phasedSettings.ts
 * @module game-sdk
 * @brief  The platform's round keys that only a `phased` game's settings document carries.
 *
 * Responsibility: the hold before the result (`round.resultHoldS`, owner 2026-11-18, T384): a
 *                 phased round's result comes this long after its plan's end, so everyone sees
 *                 the last moves of play on the game screen first. Its lower bound is the old
 *                 settle of 1 s (T380): the last moves reach every page before the result. The
 *                 host chooses it per round like the other timing settings; it is frozen into
 *                 the round as its time-up. No guess game has it (04 §4.8 rule 4).
 * Depends on:     ./settings
 * Used by:        ./index, packages/application (round settings), apps/server (Quick Test),
 *                 apps/web (Quick Test)
 * Spec:           docs/spec/08-admin-settings.md §3.4; docs/spec/04-software-architecture.md §4.8
 */
import type { SettingDef, SettingValue } from './settings.js';

const HOLD = 'round.resultHoldS';

export const PHASED_ROUND_SETTINGS: readonly SettingDef[] = [
  {
    key: HOLD,
    kind: 'int',
    label: 'Hold before the result',
    help: 'How long the game screen stays after the round’s end, so everyone sees the last switches.',
    default: 5,
    min: 1,
    max: 20,
    unit: 's',
    status: 'proposal',
    spec: '08 §3.4',
    editPermission: 'settings.game.edit',
    hostChooses: true,
    running: 'frozen',
  },
];

// The frozen hold in milliseconds; the values come from resolveSettings and the host's checked
// choices, so the key has its kind.
export const resultHoldMs = (values: Readonly<Record<string, SettingValue>>): number =>
  (values[HOLD] as number) * 1_000;
