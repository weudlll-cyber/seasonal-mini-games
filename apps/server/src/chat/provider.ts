/**
 * @file   apps/server/src/chat/provider.ts
 * @module server/chat
 * @brief  The chat settings as the server applies them: the provider in force, the host
 *         chat's source for the CSP, and the builtin chat's rules.
 *
 * Responsibility: `integrations.chatProvider` and `integrations.hostChatUrl` read when asked
 *                 (07 §2: `none`, `builtin`, `hostEmbed`; the host room's address only for
 *                 hostEmbed); while an admin has stored no provider, the deployment's default
 *                 applies (`chatDefault`: SMG_CHAT_PROVIDER, in website mode hostEmbed with the
 *                 website's own room `/embed/chat?room=mini-games`, O66), and the admin app's
 *                 Integrations page shows it with its reason (`chatInEffect`, T240); the
 *                 source of the host room for the CSP's `frame-src` (the website's room by its
 *                 path on the public origin, any other host chat by its origin), cached for 5 s
 *                 and refreshed in the background so a response never waits for it; the `chat`
 *                 document (08 §1) read for every message.
 * Depends on:     @smg/application (SettingsService), @smg/contracts (ChatConfigView,
 *                 SettingInEffectView), ../config/env (types)
 * Used by:        ./chat, ./roundLines, ./retention, ../http/app, ../http/routes/chat,
 *                 ../http/routes/adminSettings
 * Spec:           docs/spec/07-integration.md §2, §7; docs/spec/08-admin-settings.md §1, §5
 */
import type { SettingsService } from '@smg/application';
import type { ChatConfigView, ChatProvider, SettingInEffectView } from '@smg/contracts';

import type { Env } from '../config/env.js';

const ORIGIN_CACHE_MS = 5_000;
const PROVIDER = 'integrations.chatProvider';
const HOST_URL = 'integrations.hostChatUrl';

// The website's own chat room (O66): its embed page on the same origin as the game.
export const WEBSITE_CHAT_URL = '/embed/chat?room=mini-games';

// The chat while no admin has chosen one (DECISIONS T236); null: the settings' own defaults.
// `reason`: why it applies, in the admin app's words (T240).
export interface ChatDefault {
  readonly provider: ChatProvider;
  readonly hostChatUrl: string;
  readonly reason: string;
}

const WEBSITE_REASON =
  'This install runs inside the website; its chat is used until an admin chooses another.';
const ENV_REASON =
  "This install's default (SMG_CHAT_PROVIDER), used until an admin chooses another.";
const ROOM_REASON =
  "The website's own room on this site, used until an admin sets another address.";

export function chatDefault(
  env: Pick<Env, 'SMG_AUTH_MODE' | 'SMG_CHAT_PROVIDER'>,
): ChatDefault | null {
  const website = env.SMG_AUTH_MODE === 'website';
  const provider = env.SMG_CHAT_PROVIDER ?? (website ? 'hostEmbed' : null);
  if (provider === null) return null;
  const reason = website ? WEBSITE_REASON : ENV_REASON;
  return { provider, hostChatUrl: website ? WEBSITE_CHAT_URL : '', reason };
}

// The admin's stored choice wins; without one, the deployment's default. An empty host
// address counts as none chosen. `defaulted`: which of the two the default supplied.
async function resolve(settings: SettingsService, fallback: ChatDefault | null) {
  const { values, overrides } = await settings.view('integrations', []);
  const chosen = fallback === null || overrides[PROVIDER] !== undefined;
  const provider = (chosen ? values[PROVIDER] : fallback.provider) as ChatProvider;
  const stored = values[HOST_URL] as string;
  const urlDefaulted = stored === '' && fallback !== null && fallback.hostChatUrl !== '';
  const url = urlDefaulted ? fallback.hostChatUrl : stored;
  return { provider, url, defaulted: { provider: !chosen, url: urlDefaulted } };
}

export async function chatConfig(
  settings: SettingsService,
  fallback: ChatDefault | null,
): Promise<ChatConfigView> {
  const { provider, url } = await resolve(settings, fallback);
  return { provider, hostChatUrl: provider === 'hostEmbed' && url !== '' ? url : null };
}

// The chat keys whose value in force is the deployment's default rather than the document's,
// each with that value and why, for the Integrations page (08 §1, T240).
export async function chatInEffect(
  settings: SettingsService,
  fallback: ChatDefault | null,
): Promise<Record<string, SettingInEffectView>> {
  if (fallback === null) return {};
  const { provider, url, defaulted } = await resolve(settings, fallback);
  const shown: Record<string, SettingInEffectView> = {};
  if (defaulted.provider) shown[PROVIDER] = { value: provider, reason: fallback.reason };
  if (defaulted.url && provider === 'hostEmbed') {
    shown[HOST_URL] = { value: url, reason: ROOM_REASON };
  }
  return shown;
}

export interface ChatRules {
  readonly maxLength: number;
  readonly allowLinks: boolean;
  readonly slowModeDefault: number;
  readonly rateMessages: number;
  readonly rateWindowS: number;
  readonly newAccountSlowModeHours: number;
  readonly retentionDays: number;
}

export async function chatRules(settings: SettingsService): Promise<ChatRules> {
  const v = await settings.values('chat');
  return {
    maxLength: v['chat.maxLength'] as number,
    allowLinks: v['chat.allowLinks'] as boolean,
    slowModeDefault: v['chat.slowModeDefault'] as number,
    rateMessages: v['chat.rateMessages'] as number,
    rateWindowS: v['chat.rateWindowS'] as number,
    newAccountSlowModeHours: v['chat.newAccountSlowModeHours'] as number,
    retentionDays: v['chat.retentionDays'] as number,
  };
}

// What `frame-src` admits for the host chat: the website's room (a path) only by that path on
// the public origin (`https://<site>/embed/chat`), another host chat by its origin; '' for none.
// The path comes from WEBSITE_CHAT_URL alone: a stored address must be https (08 §5).
export function frameSource(url: string | null, publicUrl: string | undefined): string {
  if (url === null) return '';
  if (!url.startsWith('/')) return new URL(url).origin;
  if (publicUrl === undefined) return '';
  const at = new URL(url, publicUrl);
  return `${at.origin}${at.pathname}`;
}

// The host chat's source for `frame-src` while the provider is hostEmbed, else ''. The first
// responses after a change still carry the old value: at most 5 s, then the new one.
export function hostChatSource(
  settings: SettingsService,
  fallback: ChatDefault | null,
  publicUrl: string | undefined,
): () => string {
  let source = '';
  let readAt = -Infinity;
  let reading = false;
  return () => {
    if (!reading && Date.now() - readAt > ORIGIN_CACHE_MS) {
      reading = true;
      chatConfig(settings, fallback)
        .then((c) => {
          source = frameSource(c.hostChatUrl, publicUrl);
        })
        .catch(() => {
          source = '';
        })
        .finally(() => {
          readAt = Date.now();
          reading = false;
        });
    }
    return source;
  };
}
