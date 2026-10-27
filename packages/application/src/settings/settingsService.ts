/**
 * @file   packages/application/src/settings/settingsService.ts
 * @module application/settings
 * @brief  Read and change versioned settings documents, with permission checks and audit.
 *
 * Responsibility: a document's view (definitions, stored overrides, effective values, the
 *                 keys the viewer may edit); an update that checks every key against its
 *                 definition and the editor's permissions, refuses a stale version, writes a
 *                 new version and one audit entry with the before/after diff (./diff); a
 *                 rollback is such an update with an earlier version's overrides, audited as
 *                 `settings.rollback`. The documents
 *                 are passed in (platform ones from contracts, game ones from the registry),
 *                 so this layer never names a game.
 * Depends on:     @smg/game-sdk (checks), @smg/contracts (shapes), ./ports, ./diff, ../audit/ports
 * Used by:        ../index, apps/server (settings routes, round creation)
 * Spec:           docs/spec/08-admin-settings.md §1, §2; Bingo 02 §6, Bingo 11 §1
 */
import type { SettingsDocumentView, SettingsUpdate } from '@smg/contracts';
import {
  boundsProblem,
  resolveSettings,
  settingProblem,
  type SettingDef,
  type SettingOverride,
  type SettingValue,
} from '@smg/game-sdk';

import type { AuditActor, AuditLog } from '../audit/ports.js';
import { overrideChanges } from './diff.js';
import type { SettingsStore, StoredDocument } from './ports.js';

export class SettingsError extends Error {
  constructor(
    readonly code: 'NOT_FOUND' | 'FORBIDDEN' | 'SETTING_INVALID' | 'CONFIG_VERSION_CONFLICT',
    readonly detail: string = code,
  ) {
    super(detail);
  }
}

export class SettingsService {
  constructor(
    private readonly documents: Readonly<Record<string, readonly SettingDef[]>>,
    private readonly store: SettingsStore,
    private readonly audit: AuditLog,
  ) {}

  ids(): readonly string[] {
    return Object.keys(this.documents);
  }

  // Effective values of a document, for code that reads settings (no permission needed).
  async values(id: string): Promise<Record<string, SettingValue>> {
    const defs = this.defs(id);
    const stored = await this.store.load(id);
    return resolveSettings(defs, stored?.overrides ?? {});
  }

  async view(id: string, permissions: readonly string[]): Promise<SettingsDocumentView> {
    const defs = this.defs(id);
    const stored = await this.store.load(id);
    const overrides = stored?.overrides ?? {};
    return {
      id,
      version: stored?.version ?? 1,
      updatedAt: stored?.updatedAt ?? null,
      defs,
      overrides,
      values: resolveSettings(defs, overrides),
      editable: defs.filter((d) => permissions.includes(d.editPermission)).map((d) => d.key),
    };
  }

  async update(
    id: string,
    change: SettingsUpdate,
    actor: AuditActor,
    action: 'settings.update' | 'settings.rollback' = 'settings.update',
  ): Promise<SettingsDocumentView> {
    const defs = this.defs(id);
    const before = (await this.store.load(id)) ?? emptyDocument();
    if (before.version !== change.version) throw new SettingsError('CONFIG_VERSION_CONFLICT');
    const next = this.checked(defs, before.overrides, change.overrides, actor.permissions);
    const saved = await this.store.save(id, {
      expectedVersion: before.version,
      overrides: next,
      comment: change.comment ?? null,
      actorAccountId: actor.accountId,
    });
    if (!saved) throw new SettingsError('CONFIG_VERSION_CONFLICT');
    await this.audit.append(actor, {
      action,
      targetType: 'settings',
      targetId: id,
      diff: changedKeys(before.overrides, next, change.comment),
    });
    return this.view(id, actor.permissions);
  }

  private defs(id: string): readonly SettingDef[] {
    const defs = this.documents[id];
    if (defs === undefined) throw new SettingsError('NOT_FOUND');
    return defs;
  }

  // The new override map: every changed key must exist, be editable by the actor and fit.
  private checked(
    defs: readonly SettingDef[],
    before: Readonly<Record<string, SettingOverride>>,
    proposed: Readonly<Record<string, SettingOverride>>,
    permissions: readonly string[],
  ): Record<string, SettingOverride> {
    const byKey = new Map(defs.map((d) => [d.key, d]));
    const next: Record<string, SettingOverride> = {};
    for (const [key, o] of Object.entries(proposed)) {
      const def = byKey.get(key);
      if (def === undefined) throw new SettingsError('SETTING_INVALID', `${key}: unknown setting`);
      if (JSON.stringify(before[key] ?? {}) !== JSON.stringify(o)) mayEdit(def, permissions);
      const problem = boundsProblem(def, o) ?? valueProblem(def, o);
      if (problem !== null) throw new SettingsError('SETTING_INVALID', `${def.label}: ${problem}`);
      if (Object.keys(o).length > 0) next[key] = o;
    }
    // A key left out of the proposal goes back to its definition only with the permission.
    for (const key of Object.keys(before)) {
      const def = byKey.get(key);
      if (!(key in proposed) && def !== undefined) mayEdit(def, permissions);
    }
    return next;
  }
}

function mayEdit(def: SettingDef, permissions: readonly string[]): void {
  if (!permissions.includes(def.editPermission)) {
    throw new SettingsError('FORBIDDEN', `${def.key}: needs ${def.editPermission}`);
  }
}

// The stored default (or, without one, the definition's) must fit the narrowed bounds.
function valueProblem(def: SettingDef, o: SettingOverride): string | null {
  return settingProblem(def, o.value ?? def.default, o);
}

function emptyDocument(): StoredDocument {
  return { version: 1, overrides: {}, updatedAt: null };
}

function changedKeys(
  before: Readonly<Record<string, SettingOverride>>,
  after: Readonly<Record<string, SettingOverride>>,
  comment: string | undefined,
): unknown {
  const changes = Object.fromEntries(
    overrideChanges(before, after).map((c) => [c.key, { before: c.before, after: c.after }]),
  );
  return { changes, comment: comment ?? null };
}
