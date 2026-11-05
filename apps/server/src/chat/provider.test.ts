/**
 * @file   apps/server/src/chat/provider.test.ts
 * @module server/chat
 * @brief  The chat in force: the deployment's default until an admin chooses, and its frame source.
 *
 * Responsibility: website mode defaults to hostEmbed with the website's room
 *                 `/embed/chat?room=mini-games`, SMG_CHAT_PROVIDER sets the default otherwise,
 *                 none of them keeps the settings' default (builtin); a stored provider or host
 *                 address wins; `frame-src` gets the website's room by its path on the public
 *                 origin and another host chat by its origin (DECISIONS T236).
 * Depends on:     vitest, @smg/application, @smg/contracts, ./provider
 * Spec:           docs/spec/07-integration.md §2; docs/spec/08-admin-settings.md §5
 */
import { SettingsService, type AuditLog, type SettingsStore } from '@smg/application';
import { PLATFORM_SETTINGS } from '@smg/contracts';
import { describe, expect, it } from 'vitest';

import { chatConfig, chatDefault, frameSource, WEBSITE_CHAT_URL } from './provider.js';

// A settings service whose `integrations` document holds the given overrides.
function settingsWith(overrides: Record<string, { value: string }>): SettingsService {
  const store: SettingsStore = {
    load: () => Promise.resolve({ version: 2, overrides, updatedAt: 'now' }),
    save: () => Promise.resolve(false),
  };
  const audit: AuditLog = { append: () => Promise.resolve() };
  return new SettingsService(PLATFORM_SETTINGS, store, audit);
}

const website = chatDefault({ SMG_AUTH_MODE: 'website', SMG_CHAT_PROVIDER: undefined });

describe('the chat default', () => {
  it("is the website's room in website mode, SMG_CHAT_PROVIDER otherwise, else none", () => {
    expect(website).toEqual({ provider: 'hostEmbed', hostChatUrl: WEBSITE_CHAT_URL });
    expect(WEBSITE_CHAT_URL).toBe('/embed/chat?room=mini-games');
    expect(chatDefault({ SMG_AUTH_MODE: 'local', SMG_CHAT_PROVIDER: 'none' })).toEqual({
      provider: 'none',
      hostChatUrl: '',
    });
    expect(chatDefault({ SMG_AUTH_MODE: 'local', SMG_CHAT_PROVIDER: undefined })).toBeNull();
  });

  it('applies until an admin stores a choice', async () => {
    expect(await chatConfig(settingsWith({}), website)).toEqual({
      provider: 'hostEmbed',
      hostChatUrl: WEBSITE_CHAT_URL,
    });
    expect(await chatConfig(settingsWith({}), null)).toEqual({
      provider: 'builtin',
      hostChatUrl: null,
    });
    const builtin = { 'integrations.chatProvider': { value: 'builtin' } };
    expect(await chatConfig(settingsWith(builtin), website)).toEqual({
      provider: 'builtin',
      hostChatUrl: null,
    });
    const other = { 'integrations.hostChatUrl': { value: 'https://chat.example/room' } };
    expect(await chatConfig(settingsWith(other), website)).toEqual({
      provider: 'hostEmbed',
      hostChatUrl: 'https://chat.example/room',
    });
  });
});

describe('the frame source', () => {
  it("is the website's room by its path, another host chat by its origin", () => {
    const publicUrl = 'https://example.org/games/mini-games/';
    expect(frameSource(WEBSITE_CHAT_URL, publicUrl)).toBe('https://example.org/embed/chat');
    expect(frameSource('https://chat.example/embed/chat?room=x', publicUrl)).toBe(
      'https://chat.example',
    );
    expect(frameSource(null, publicUrl)).toBe('');
    expect(frameSource(WEBSITE_CHAT_URL, undefined)).toBe('');
  });
});
