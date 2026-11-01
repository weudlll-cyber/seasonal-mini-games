/**
 * @file   packages/contracts/src/settings/chat.ts
 * @module contracts/settings
 * @brief  The `chat` settings document of the builtin chat: length, links, slow mode, limits,
 *         retention.
 *
 * Responsibility: Bingo's `chat` document (Bingo 11 §4) with Bingo 03 §12's defaults, adopted
 *                 by 08 §1, without `typingIndicator` (there is no typing indicator to switch).
 *                 Read by the server's chat pipeline; shown and edited in the admin app.
 * Depends on:     @smg/game-sdk (SettingDef)
 * Used by:        ./platform
 * Spec:           docs/spec/08-admin-settings.md §1; docs/spec/07-integration.md §2; Bingo 11 §4, Bingo 03 §12
 */
import type { SettingDef } from '@smg/game-sdk';

const GAME_ADMIN = 'settings.game.edit';

export const chat: readonly SettingDef[] = [
  {
    key: 'chat.maxLength',
    kind: 'int',
    label: 'Longest message',
    help: 'Characters per chat message; plain text only.',
    default: 300,
    min: 20,
    max: 300,
    unit: 'characters',
    status: 'adopted',
    editPermission: GAME_ADMIN,
    hostChooses: false,
    running: 'immediate',
    spec: '08 §1 (Bingo 11 §4)',
  },
  {
    key: 'chat.allowLinks',
    kind: 'bool',
    label: 'Links in chat',
    help: 'Off: a message with a web address is refused.',
    default: false,
    status: 'adopted',
    editPermission: GAME_ADMIN,
    hostChooses: false,
    running: 'immediate',
    spec: '08 §1 (Bingo 11 §4)',
  },
  {
    key: 'chat.slowModeDefault',
    kind: 'int',
    label: 'Slow mode of a new room',
    help: 'Seconds between two messages of one person in a newly made room; 0 is off.',
    default: 0,
    min: 0,
    max: 3600,
    unit: 's',
    status: 'adopted',
    editPermission: GAME_ADMIN,
    hostChooses: false,
    running: 'next',
    spec: '08 §1 (Bingo 11 §4)',
  },
  {
    key: 'chat.rateMessages',
    kind: 'int',
    label: 'Messages per window',
    help: 'How many messages one person may send within the rate window.',
    default: 5,
    min: 1,
    max: 50,
    unit: '',
    status: 'adopted',
    editPermission: GAME_ADMIN,
    hostChooses: false,
    running: 'immediate',
    spec: '08 §1 (Bingo 03 §12)',
  },
  {
    key: 'chat.rateWindowS',
    kind: 'int',
    label: 'Rate window',
    help: 'The window of the message limit.',
    default: 10,
    min: 1,
    max: 600,
    unit: 's',
    status: 'adopted',
    editPermission: GAME_ADMIN,
    hostChooses: false,
    running: 'immediate',
    spec: '08 §1 (Bingo 03 §12)',
  },
  {
    key: 'chat.newAccountSlowModeHours',
    kind: 'int',
    label: 'Slow mode for new accounts',
    help: 'Accounts younger than this wait 10 s between messages; 0 is off.',
    default: 24,
    min: 0,
    max: 168,
    unit: 'h',
    status: 'adopted',
    editPermission: GAME_ADMIN,
    hostChooses: false,
    running: 'immediate',
    spec: '08 §1 (Bingo 03 §12)',
  },
  {
    key: 'chat.retentionDays',
    kind: 'int',
    label: 'Keep chat messages',
    help: 'Messages older than this are deleted every night.',
    default: 90,
    min: 1,
    max: 3650,
    unit: 'days',
    status: 'adopted',
    editPermission: GAME_ADMIN,
    hostChooses: false,
    running: 'immediate',
    spec: '08 §1 (Bingo 04 §3.5)',
  },
];
