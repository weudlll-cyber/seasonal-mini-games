/**
 * @file   apps/server/src/chat/retention.ts
 * @module server/chat
 * @brief  Nightly chat retention: messages older than `chat.retentionDays` are deleted.
 *
 * Responsibility: run the purge once at start and then every 24 hours, reading the setting
 *                 each time; the reports about a purged message go with it. A failure is
 *                 logged and tried again the next day. The pattern of ../auth/retention.
 * Depends on:     @smg/application (SettingsService), ../db/pool, ./provider, ./rooms
 * Used by:        ../main
 * Spec:           Bingo 04 §3.5; docs/spec/08-admin-settings.md §1
 */
import type { SettingsService } from '@smg/application';

import type { DbPool } from '../db/pool.js';
import { chatRules } from './provider.js';
import { purgeOldMessages } from './rooms.js';

export function startChatRetention(pool: DbPool, settings: SettingsService): () => void {
  const run = (): void => {
    chatRules(settings)
      .then((rules) => purgeOldMessages(pool, rules.retentionDays))
      .catch((error: unknown) => {
        console.error('[smg] chat retention failed:', error);
      });
  };
  run();
  const timer = setInterval(run, 24 * 3600_000);
  return () => {
    clearInterval(timer);
  };
}
