/**
 * @file   packages/contracts/src/settings/platform.ts
 * @module contracts/settings
 * @brief  The platform's settings documents: every key with default, min, max, who and effect.
 *
 * Responsibility: the catalogue of spec 08 §4–§6 as data, so the server validates with it
 *                 and the admin app renders it; one array of definitions per document.
 *                 Game settings live in each game module (games/<game>/src/settings).
 * Depends on:     @smg/game-sdk (SettingDef), ./security
 * Used by:        ../index, apps/server (settings service), apps/admin
 * Spec:           docs/spec/08-admin-settings.md §4, §5 (and §6 through ./security)
 */
import type { SettingDef } from '@smg/game-sdk';

import { rateLimits, security } from './security.js';

const GAME_ADMIN = 'settings.game.edit';
const SECURITY_ADMIN = 'settings.security.edit';
const SEASON_ADMIN = 'season.manage';

const matchmaking: readonly SettingDef[] = [
  {
    key: 'match.minPlayersPerRound',
    kind: 'int',
    label: 'Players needed to start a round',
    help: 'A round starts its countdown only with at least this many connected players.',
    default: 2,
    min: 1,
    max: 50,
    unit: '',
    status: 'owner',
    decision: 'O15',
    editPermission: GAME_ADMIN,
    hostChooses: false,
    running: 'next',
    spec: '08 §4',
  },
  {
    key: 'match.maxPlayers',
    kind: 'int',
    label: 'Players per match at most',
    help: 'The host may pick a lower limit when opening a match.',
    default: 500,
    min: 2,
    max: 1_000,
    unit: '',
    status: 'owner',
    decision: 'O15',
    editPermission: GAME_ADMIN,
    hostChooses: true,
    running: 'next',
    spec: '08 §4',
  },
  {
    key: 'match.lobbyIdleCloseMin',
    kind: 'int',
    label: 'Close an idle match after',
    help: 'A match with no round for this long closes itself.',
    default: 60,
    min: 10,
    max: 1_440,
    unit: 'min',
    status: 'owner',
    decision: 'O15',
    editPermission: GAME_ADMIN,
    hostChooses: false,
    running: 'immediate',
    spec: '08 §4',
  },
  {
    key: 'match.maxConcurrentRounds',
    kind: 'int',
    label: 'Rounds running at once on this server',
    help: 'Creating a round beyond this answers "server busy".',
    default: 20,
    min: 1,
    max: 100,
    unit: '',
    status: 'technical',
    editPermission: GAME_ADMIN,
    hostChooses: false,
    running: 'next',
    spec: '08 §4',
  },
  {
    key: 'leaderboard.minPlayersForPoints',
    kind: 'int',
    label: 'Distinct players for league points',
    help: 'A match gives league points only with at least this many distinct players.',
    default: 4,
    min: 2,
    max: 50,
    unit: '',
    status: 'owner',
    decision: 'O11',
    editPermission: GAME_ADMIN,
    hostChooses: false,
    running: 'next',
    spec: '08 §4',
  },
];

const seasons: readonly SettingDef[] = [
  {
    key: 'seasons.feedUrl',
    kind: 'text',
    label: 'In Season feed address',
    help: 'HTTPS address of the website feed. Empty: In Season is not offered.',
    default: '',
    maxLength: 300,
    pattern: '^https://[^\\s]+$',
    status: 'technical',
    editPermission: SECURITY_ADMIN,
    hostChooses: false,
    running: 'next',
    spec: '08 §5',
  },
  {
    key: 'inSeason.pollS',
    kind: 'int',
    label: 'Ask the feed every',
    help: 'How often the server reads the In Season feed.',
    default: 300,
    min: 60,
    max: 3_600,
    unit: 's',
    status: 'technical',
    editPermission: SEASON_ADMIN,
    hostChooses: false,
    running: 'immediate',
    spec: '08 §5',
  },
  {
    key: 'inSeason.staleAfterH',
    kind: 'int',
    label: 'Feed answer too old after',
    help: 'An older answer is not used; the host then picks the season by hand.',
    default: 24,
    min: 1,
    max: 168,
    unit: 'h',
    status: 'owner',
    decision: 'O15',
    editPermission: SEASON_ADMIN,
    hostChooses: false,
    running: 'next',
    spec: '08 §5',
  },
  {
    key: 'halving.timeZone',
    kind: 'text',
    label: 'Time zone of halving days',
    help: 'Halving days are calendar dates in this IANA time zone.',
    default: 'UTC',
    maxLength: 64,
    pattern: '^[A-Za-z_]+(/[A-Za-z0-9_+-]+)*$',
    status: 'owner',
    decision: 'O15',
    editPermission: SEASON_ADMIN,
    hostChooses: false,
    running: 'next',
    spec: '08 §5',
  },
];

const integrations: readonly SettingDef[] = [
  {
    key: 'integrations.chatProvider',
    kind: 'enum',
    label: 'Chat',
    help: 'none: no chat panel; builtin: the platform chat; hostEmbed: a room of the host site.',
    default: 'builtin',
    options: ['none', 'builtin', 'hostEmbed'],
    status: 'technical',
    editPermission: SECURITY_ADMIN,
    hostChooses: false,
    running: 'immediate',
    spec: '08 §5',
  },
  {
    key: 'integrations.hostChatUrl',
    kind: 'text',
    label: 'Host chat address',
    help: 'The embedded chat room when the chat is hostEmbed.',
    default: '',
    maxLength: 300,
    pattern: '^https://[^\\s]+$',
    status: 'adopted',
    editPermission: SECURITY_ADMIN,
    hostChooses: false,
    running: 'immediate',
    spec: '08 §5',
  },
];

// Document id → its definitions. The ids are the rows of smg.settings_documents.
export const PLATFORM_SETTINGS: Readonly<Record<string, readonly SettingDef[]>> = {
  matchmaking,
  seasons,
  integrations,
  security,
  rate_limits: rateLimits,
};
