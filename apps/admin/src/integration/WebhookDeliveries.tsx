/**
 * @file   apps/admin/src/integration/WebhookDeliveries.tsx
 * @module admin/integration
 * @brief  One webhook endpoint's recent deliveries.
 *
 * Responsibility: the last 50 deliveries of an endpoint (`GET /admin/webhooks/:id/deliveries`):
 *                 event, state, attempts, last error, when queued and when delivered.
 * Depends on:     react, @smg/contracts (delivery view), ../http
 * Used by:        ./WebhooksPanel
 * Spec:           docs/spec/07-integration.md §3.2; Bingo 07 §5
 */
import type { WebhookDeliveryView } from '@smg/contracts';
import { useEffect, useState, type ReactElement } from 'react';

import { api, failureText } from '../http.js';

const when = (iso: string | null) => (iso === null ? '—' : new Date(iso).toLocaleString());

export function WebhookDeliveries({ id }: { readonly id: string }): ReactElement {
  const [rows, setRows] = useState<readonly WebhookDeliveryView[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    api<{ deliveries: WebhookDeliveryView[] }>(`/admin/webhooks/${id}/deliveries`)
      .then((r) => {
        setRows(r.deliveries);
      })
      .catch((e: unknown) => {
        setProblem(failureText(e, 'Loading the deliveries'));
      });
  }, [id]);
  if (problem !== null) return <p role="alert">{problem}</p>;
  if (rows === null) return <p className="smg-muted">Loading…</p>;
  if (rows.length === 0) return <p data-testid="deliveries">No delivery yet.</p>;
  return (
    <ul className="admin-list" data-testid="deliveries">
      {rows.map((d) => (
        <li key={d.id}>
          {d.event} · {d.status} · {String(d.attempts)} attempts · queued {when(d.createdAt)} ·
          delivered {when(d.deliveredAt)}
          {d.lastError === null ? null : <small className="smg-muted"> ({d.lastError})</small>}
        </li>
      ))}
    </ul>
  );
}
