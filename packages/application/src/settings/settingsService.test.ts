/**
 * @file   packages/application/src/settings/settingsService.test.ts
 * @module application/settings
 * @brief  Settings documents: views, permission checks, validation, versions and audit.
 *
 * Responsibility: a view lists only the keys the viewer may edit; an update with the right
 *                 permission and a fitting value makes a new version and one audit entry;
 *                 unknown keys, wrong values, widened bounds, missing permissions and stale
 *                 versions are refused without a write; resetting a key needs the same
 *                 permission; a lost save race is a version conflict.
 * Depends on:     vitest, ./settingsService, ../fakes, @smg/contracts
 * Spec:           docs/spec/08-admin-settings.md §1, §2
 */
import { PLATFORM_SETTINGS } from '@smg/contracts';
import { describe, expect, it } from 'vitest';

import type { AuditActor } from '../audit/ports.js';
import { MemoryAuditLog, MemorySettingsStore } from '../fakes.js';
import { SettingsService } from './settingsService.js';

const actor = (permissions: string[]): AuditActor => ({
  accountId: 'a1',
  roles: ['game_admin'],
  permissions,
  requestId: 'r1',
  ip: null,
});

function service() {
  const store = new MemorySettingsStore();
  const audit = new MemoryAuditLog();
  return { store, audit, settings: new SettingsService(PLATFORM_SETTINGS, store, audit) };
}

describe('SettingsService', () => {
  it('shows defaults and the keys the viewer may edit', async () => {
    const { settings } = service();
    const view = await settings.view('matchmaking', ['settings.game.edit']);
    expect(view.values['match.maxPlayers']).toBe(500);
    expect(view.editable).toContain('match.maxPlayers');
    expect((await settings.view('security', ['settings.game.edit'])).editable).toEqual([]);
  });

  it('saves a fitting change as a new version with one audit entry', async () => {
    const { settings, audit } = service();
    const view = await settings.update(
      'matchmaking',
      {
        version: 1,
        overrides: { 'match.maxPlayers': { value: 300, max: 800 } },
        comment: 'smaller',
      },
      actor(['settings.game.edit']),
    );
    expect(view.version).toBe(2);
    expect(view.values['match.maxPlayers']).toBe(300);
    expect(audit.entries).toHaveLength(1);
    expect(audit.entries[0]?.entry.action).toBe('settings.update');
  });

  it('refuses unknown keys, bad values, wider bounds, missing rights and stale versions', async () => {
    const { settings, audit } = service();
    const editor = actor(['settings.game.edit']);
    const attempts = [
      { version: 1, overrides: { nope: { value: 1 } } },
      { version: 1, overrides: { 'match.maxPlayers': { value: 5_000 } } },
      { version: 1, overrides: { 'match.maxPlayers': { max: 5_000 } } },
      { version: 1, overrides: { 'match.maxPlayers': { value: 300, max: 200 } } },
      { version: 2, overrides: {} },
    ];
    for (const a of attempts) {
      await expect(settings.update('matchmaking', a, editor)).rejects.toThrow();
    }
    await expect(
      settings.update(
        'security',
        { version: 1, overrides: { 'antiMulti.minAccountAgeH': { value: 5 } } },
        editor,
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(settings.view('nope', [])).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(audit.entries).toHaveLength(0);
  });
});

describe('SettingsService resets and races', () => {
  it('lists its documents and resolves values for readers', async () => {
    const { settings } = service();
    expect(settings.ids()).toContain('matchmaking');
    expect((await settings.values('matchmaking'))['match.maxPlayers']).toBe(500);
  });

  it('keeps unchanged keys of others, and resets a key only with its permission', async () => {
    const { settings, store, audit } = service();
    store.docs.set('security', {
      version: 1,
      overrides: { 'antiMulti.minAccountAgeH': { value: 5 } },
      updatedAt: null,
    });
    const gameAdmin = actor(['settings.game.edit']);
    await expect(
      settings.update('security', { version: 1, overrides: {} }, gameAdmin),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const kept = { 'antiMulti.minAccountAgeH': { value: 5 } };
    await expect(
      settings.update('security', { version: 1, overrides: kept }, gameAdmin),
    ).resolves.toMatchObject({ version: 2 });
    const reset = await settings.update(
      'security',
      { version: 2, overrides: {} },
      actor(['settings.security.edit']),
    );
    expect(reset.values['antiMulti.minAccountAgeH']).toBe(0);
    expect(audit.entries).toHaveLength(2);
  });

  it('turns a save that lost the race into a version conflict', async () => {
    const { store, audit } = service();
    const racing = new SettingsService(
      PLATFORM_SETTINGS,
      { load: (id) => store.load(id), save: () => Promise.resolve(false) },
      audit,
    );
    await expect(
      racing.update('matchmaking', { version: 1, overrides: {} }, actor([])),
    ).rejects.toMatchObject({ code: 'CONFIG_VERSION_CONFLICT' });
    expect(audit.entries).toHaveLength(0);
  });
});
