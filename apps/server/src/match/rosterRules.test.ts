/**
 * @file   apps/server/src/match/rosterRules.test.ts
 * @module server/match
 * @brief  The linked-chat rule has no effect in website mode; standalone still asks for a provider.
 *
 * Responsibility: with `antiMulti.requireLinkedChat` on and no account-age rule, a website-mode
 *                 install admits the whole roster without reading the database (DECISIONS
 *                 T222); a standalone install first looks for an enabled JWT handoff provider
 *                 and, finding none, admits everyone too (T103).
 * Depends on:     vitest, @smg/application (types), @smg/game-sdk (types), ../db/pool (types),
 *                 ./rosterRules
 * Spec:           docs/spec/05-security-threat-model.md §6; docs/spec/07-integration.md §4
 */
import type { SettingsService } from '@smg/application';
import type { RosterPlayer } from '@smg/game-sdk';
import { describe, expect, it, vi } from 'vitest';

import type { DbPool } from '../db/pool.js';
import { rosterAdmission } from './rosterRules.js';

const settings = {
  values: () =>
    Promise.resolve({ 'antiMulti.minAccountAgeH': 0, 'antiMulti.requireLinkedChat': true }),
} as unknown as SettingsService;
const players = [{ playerId: 'a1' }, { playerId: 'bot-1' }] as unknown as RosterPlayer[];

describe('the linked-chat rule', () => {
  it('has no effect in website mode and reads nothing', async () => {
    const query = vi.fn();
    const admit = rosterAdmission({ query } as unknown as DbPool, settings, true);
    expect(await admit('r1', players)).toBe(players);
    expect(query).not.toHaveBeenCalled();
  });

  it('asks for a handoff provider in a standalone install', async () => {
    const query = vi.fn((_sql: string) => Promise.resolve({ rowCount: 0, rows: [] }));
    const admit = rosterAdmission({ query } as unknown as DbPool, settings, false);
    expect(await admit('r1', players)).toBe(players);
    expect(String(query.mock.calls[0]?.[0])).toMatch(/jwt_handoff/);
  });
});
