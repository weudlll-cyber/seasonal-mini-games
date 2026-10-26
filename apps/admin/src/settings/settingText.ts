/**
 * @file   apps/admin/src/settings/settingText.ts
 * @module admin/settings
 * @brief  How the settings table names roles, effects, statuses, documents and values.
 *
 * Responsibility: the words of 08 §2 for each column: who may change a key (from its edit
 *                 permission, plus "host per round"), when a change applies to running rounds,
 *                 where a value comes from (the owner with the decision, a proposal, a
 *                 technical choice), the documents' names, and values shown as text.
 * Depends on:     @smg/game-sdk (types)
 * Used by:        ./SettingRow, ./SettingsPage
 * Spec:           docs/spec/08-admin-settings.md §2
 */
import type { SettingDef, SettingValue } from '@smg/game-sdk';

const ROLES: Readonly<Record<string, string>> = {
  'settings.game.edit': 'game admin',
  'settings.security.edit': 'security admin',
  'season.manage': 'season admin',
};

export function whoText(def: SettingDef): string {
  const role = ROLES[def.editPermission] ?? def.editPermission;
  return def.hostChooses ? `host per round; default by ${role}` : role;
}

export function runningText(def: SettingDef): string {
  if (def.running === 'frozen') return 'frozen into each new round';
  return def.running === 'immediate'
    ? 'at once, also in running rounds'
    : 'the next time it is read';
}

export function statusText(def: SettingDef): string {
  if (def.status === 'owner')
    return def.decision === undefined ? 'owner' : `owner (${def.decision})`;
  return def.status;
}

const DOCUMENTS: Readonly<Record<string, string>> = {
  matchmaking: 'Matches',
  seasons: 'Seasons',
  integrations: 'Integrations',
  security: 'Security',
  rate_limits: 'Rate limits',
};

export function documentName(id: string): string {
  if (id.startsWith('game.')) return `Game: ${id.slice('game.'.length)}`;
  return DOCUMENTS[id] ?? id;
}

export function valueText(value: SettingValue | undefined, def: SettingDef): string {
  if (value === undefined) return '—';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'on' : 'off';
  const unit = 'unit' in def && def.unit !== '' ? ` ${def.unit}` : '';
  return value === '' ? '(empty)' : `${String(value)}${unit}`;
}
