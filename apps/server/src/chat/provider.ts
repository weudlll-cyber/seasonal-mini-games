/**
 * @file   apps/server/src/chat/provider.ts
 * @module server/chat
 * @brief  The chat settings as the server applies them: the provider in force, the host
 *         chat's origin for the CSP, and the builtin chat's rules.
 *
 * Responsibility: `integrations.chatProvider` and `integrations.hostChatUrl` read when asked
 *                 (07 §2: `none`, `builtin`, `hostEmbed`; the host room's address only for
 *                 hostEmbed); the origin of that address for the CSP's `frame-src`, cached for
 *                 5 s and refreshed in the background so a response never waits for it; the
 *                 `chat` document (08 §1) read for every message.
 * Depends on:     @smg/application (SettingsService), @smg/contracts (ChatConfigView)
 * Used by:        ./chat, ./roundLines, ./retention, ../http/app, ../http/routes/chat
 * Spec:           docs/spec/07-integration.md §2; docs/spec/08-admin-settings.md §1, §5
 */
import type { SettingsService } from '@smg/application';
import type { ChatConfigView, ChatProvider } from '@smg/contracts';

const ORIGIN_CACHE_MS = 5_000;

export async function chatConfig(settings: SettingsService): Promise<ChatConfigView> {
  const v = await settings.values('integrations');
  const provider = v['integrations.chatProvider'] as ChatProvider;
  const url = v['integrations.hostChatUrl'] as string;
  return { provider, hostChatUrl: provider === 'hostEmbed' && url !== '' ? url : null };
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

// The host chat's origin for `frame-src` while the provider is hostEmbed, else ''. The first
// responses after a change still carry the old value: at most 5 s, then the new one.
export function hostChatOrigin(settings: SettingsService): () => string {
  let origin = '';
  let readAt = -Infinity;
  let reading = false;
  return () => {
    if (!reading && Date.now() - readAt > ORIGIN_CACHE_MS) {
      reading = true;
      chatConfig(settings)
        .then((c) => {
          origin = c.hostChatUrl === null ? '' : new URL(c.hostChatUrl).origin;
        })
        .catch(() => {
          origin = '';
        })
        .finally(() => {
          readAt = Date.now();
          reading = false;
        });
    }
    return origin;
  };
}
