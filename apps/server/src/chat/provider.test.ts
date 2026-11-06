/**
 * @file   apps/server/src/chat/provider.test.ts
 * @module server/chat
 * @brief  The chat in force: the deployment's default until an admin chooses, and its frame source.
 *
 * Responsibility: website mode defaults to hostEmbed with the website's room
 *                 `/embed/chat?room=mini-games`, SMG_CHAT_PROVIDER sets the default otherwise,
 *                 none of them keeps the settings' default (builtin); a stored provider or host
 *                 address wins; `frame-src` gets the website's room by its path on the public
 *                 origin and another host chat by its origin (DECISIONS T236); the admin app is
 *                 told which keys the default supplies, with the value and why (T240).
 * Depends on:     vitest, @smg/application, @smg/contracts, ./provider
 * Spec:           docs/spec/07-integration.md §2; docs/spec/08-admin-settings.md §5
 */
import { SettingsService, type AuditLog, type SettingsStore } from '@smg/application';
import { PLATFORM_SETTINGS } from '@smg/contracts';
import { describe, expect, it } from 'vitest';

import {
  chatConfig,
  chatDefault,
  chatInEffect,
  frameSource,
  WEBSITE_CHAT_URL,
} from './provider.js';

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
    expect(website).toMatchObject({ provider: 'hostEmbed', hostChatUrl: WEBSITE_CHAT_URL });
    expect(website?.reason).toMatch(/^This install runs inside the website/);
    expect(WEBSITE_CHAT_URL).toBe('/embed/chat?room=mini-games');
    expect(chatDefault({ SMG_AUTH_MODE: 'local', SMG_CHAT_PROVIDER: 'none' })).toEqual({
      provider: 'none',
      hostChatUrl: '',
      reason: "This install's default (SMG_CHAT_PROVIDER), used until an admin chooses another.",
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

describe('the chat in effect for the admin app', () => {
  it('names the keys the default supplies, until an admin stores them', async () => {
    const shown = await chatInEffect(settingsWith({}), website);
    expect(Object.keys(shown)).toEqual(['integrations.chatProvider', 'integrations.hostChatUrl']);
    expect(shown['integrations.chatProvider']?.value).toBe('hostEmbed');
    expect(shown['integrations.hostChatUrl']?.value).toBe(WEBSITE_CHAT_URL);
    const hostEmbed = { 'integrations.chatProvider': { value: 'hostEmbed' } };
    expect(Object.keys(await chatInEffect(settingsWith(hostEmbed), website))).toEqual([
      'integrations.hostChatUrl',
    ]);
    const builtin = { 'integrations.chatProvider': { value: 'builtin' } };
    expect(await chatInEffect(settingsWith(builtin), website)).toEqual({});
    expect(await chatInEffect(settingsWith({}), null)).toEqual({});
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
