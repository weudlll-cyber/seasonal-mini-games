/**
 * @file   apps/admin/src/integration/IntegrationPage.tsx
 * @module admin/integration
 * @brief  The Integration area: identity providers, embed origins and webhooks.
 *
 * Responsibility: one tab each for the identity providers of the JWT handoff, the embed
 *                 allowlist and the webhook endpoints; the area opens for `integration.manage`
 *                 (admin, security admin and super admin, migration 0010), which the server
 *                 checks again on every route.
 * Depends on:     react, ./ProvidersPanel, ./OriginsPanel, ./WebhooksPanel
 * Used by:        ../App
 * Spec:           docs/spec/07-integration.md §1; Bingo 05 §3; Bingo 11 §1
 */
import { useState, type ReactElement } from 'react';

import { OriginsPanel } from './OriginsPanel.js';
import { ProvidersPanel } from './ProvidersPanel.js';
import { WebhooksPanel } from './WebhooksPanel.js';

const TABS = [
  { id: 'providers', label: 'Identity providers' },
  { id: 'origins', label: 'Embed origins' },
  { id: 'webhooks', label: 'Webhooks' },
] as const;
type Tab = (typeof TABS)[number]['id'];

export function IntegrationPage(): ReactElement {
  const [tab, setTab] = useState<Tab>('providers');
  return (
    <div className="smg-stack">
      <h1>Integration</h1>
      <nav className="admin-tabs" aria-label="Integration">
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
      {tab === 'providers' ? <ProvidersPanel /> : null}
      {tab === 'origins' ? <OriginsPanel /> : null}
      {tab === 'webhooks' ? <WebhooksPanel /> : null}
    </div>
  );
}
