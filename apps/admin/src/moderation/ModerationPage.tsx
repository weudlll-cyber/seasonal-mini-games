/**
 * @file   apps/admin/src/moderation/ModerationPage.tsx
 * @module admin/moderation
 * @brief  The Moderation area of the builtin chat: reports, sanctions, rooms and word lists.
 *
 * Responsibility: one tab per part (Bingo 11 §3.5): the report queue (./ReportsPanel), mutes
 *                 and bans (./SanctionsPanel), a room's slow mode and lock and the word lists
 *                 (./RoomsPanel). A server whose chat is not the builtin one answers
 *                 CHAT_DISABLED, which the panels show in plain words.
 * Depends on:     react, ./ReportsPanel, ./SanctionsPanel, ./RoomsPanel
 * Used by:        ../App
 * Spec:           docs/spec/07-integration.md §2; Bingo 11 §3.5; Bingo 05 §3
 */
import { useState, type ReactElement } from 'react';

import { ReportsPanel } from './ReportsPanel.js';
import { RoomsPanel } from './RoomsPanel.js';
import { SanctionsPanel } from './SanctionsPanel.js';

const TABS = [
  { id: 'reports', label: 'Reports' },
  { id: 'sanctions', label: 'Sanctions' },
  { id: 'rooms', label: 'Rooms and word lists' },
] as const;
type Tab = (typeof TABS)[number]['id'];

export function ModerationPage(): ReactElement {
  const [tab, setTab] = useState<Tab>('reports');
  return (
    <div className="smg-stack">
      <h1>Moderation</h1>
      <nav className="admin-tabs" aria-label="Moderation">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className="smg-btn"
            aria-pressed={t.id === tab}
            onClick={() => {
              setTab(t.id);
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>
      {tab === 'reports' ? <ReportsPanel /> : null}
      {tab === 'sanctions' ? <SanctionsPanel /> : null}
      {tab === 'rooms' ? <RoomsPanel /> : null}
    </div>
  );
}
