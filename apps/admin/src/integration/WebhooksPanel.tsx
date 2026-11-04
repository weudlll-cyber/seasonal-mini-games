/**
 * @file   apps/admin/src/integration/WebhooksPanel.tsx
 * @module admin/integration
 * @brief  The webhook endpoints: list, add (secret shown once), change, disable, remove, and
 *         an endpoint's recent deliveries.
 *
 * Responsibility: whether the feature is on (SMG_FEATURE_WEBHOOKS; off, nothing is queued or
 *                 sent) and the endpoints (`GET /admin/webhooks`) with their events, state and
 *                 last delivery; New and Change open ./WebhookForm; a new endpoint's signing
 *                 secret is shown once, in this page's memory only, until the admin closes it
 *                 (as the two-factor recovery codes, DECISIONS T176); Disable (through the
 *                 confirm dialog) and Enable send the endpoint with only `enabled` changed;
 *                 Remove through the confirm dialog; Deliveries opens ./WebhookDeliveries.
 * Depends on:     react, @smg/contracts (webhook views), ../ConfirmDialog (type), ../http,
 *                 ./form, ./useListed, ./WebhookForm, ./WebhookDeliveries
 * Used by:        ./IntegrationPage
 * Spec:           docs/spec/07-integration.md §3.2; Bingo 07 §5; Bingo 11 §1
 */
import type { WebhookEndpointCreated, WebhookEndpointView } from '@smg/contracts';
import { useState, type ReactElement } from 'react';

import type { ConfirmRequest } from '../ConfirmDialog.js';
import { api } from '../http.js';
import { NewOrForm } from './form.js';
import { WebhookDeliveries } from './WebhookDeliveries.js';
import { WebhookForm } from './WebhookForm.js';
import { useListed } from './useListed.js';

const at = (w: WebhookEndpointView) => `/admin/webhooks/${w.id}`;
const switched = (w: WebhookEndpointView) => ({
  url: w.url,
  events: w.events,
  enabled: !w.enabled,
});

const disableRequest = (w: WebhookEndpointView): ConfirmRequest => ({
  title: 'Disable this endpoint',
  effect: `No event is queued for ${w.url} until it is enabled again.`,
  confirmLabel: 'Disable',
  danger: true,
  action: () => api(at(w), { method: 'PUT', body: switched(w) }),
});

const removeRequest = (w: WebhookEndpointView): ConfirmRequest => ({
  title: 'Remove this endpoint',
  effect: `${w.url} gets no more events, and its secret and delivery history are deleted.`,
  confirmLabel: 'Remove',
  danger: true,
  action: () => api(at(w), { method: 'DELETE' }),
});

function lastText(w: WebhookEndpointView): string {
  const d = w.lastDelivery;
  if (d === null) return 'none';
  const error = d.error === null ? '' : ` (${d.error})`;
  return `${d.status}, ${new Date(d.at).toLocaleString()}${error}`;
}

// The signing secret of the endpoint just made; never loaded again.
function Secret(p: {
  readonly made: WebhookEndpointCreated;
  readonly close: () => void;
}): ReactElement {
  return (
    <section className="smg-panel smg-panel--inset smg-stack" aria-label="Signing secret">
      <h3>Signing secret</h3>
      <p>
        The receiver checks each call&apos;s HMAC-SHA256 signature with this secret. Store it now:
        it is shown only this once.
      </p>
      <code className="admin-diff" data-testid="webhook-secret">
        {p.made.secret}
      </code>
      <button type="button" className="smg-btn" onClick={p.close}>
        I have stored it
      </button>
    </section>
  );
}

interface RowActions {
  readonly edit: (w: WebhookEndpointView) => void;
  readonly open: (r: ConfirmRequest) => void;
  readonly enable: (w: WebhookEndpointView) => void;
}

function Row({ w, a }: { readonly w: WebhookEndpointView; readonly a: RowActions }): ReactElement {
  const [deliveries, setDeliveries] = useState(false);
  const button = (label: string, act: () => void, danger = false) => (
    <button type="button" className={`smg-btn${danger ? ' smg-btn--danger' : ''}`} onClick={act}>
      {label}
    </button>
  );
  return (
    <li className="smg-panel smg-panel--inset smg-stack" data-testid={`webhook-${w.url}`}>
      <strong className="admin-diff">{w.url}</strong>
      <span>
        {w.events.join(', ')} · {w.enabled ? 'enabled' : 'disabled'} · last delivery: {lastText(w)}
      </span>
      <div className="smg-row">
        {button('Change', () => {
          a.edit(w);
        })}
        {button(w.enabled ? 'Disable' : 'Enable', () => {
          if (w.enabled) a.open(disableRequest(w));
          else a.enable(w);
        })}
        {button(deliveries ? 'Hide deliveries' : 'Deliveries', () => {
          setDeliveries(!deliveries);
        })}
        {button(
          'Remove',
          () => {
            a.open(removeRequest(w));
          },
          true,
        )}
      </div>
      {deliveries ? <WebhookDeliveries id={w.id} /> : null}
    </li>
  );
}

interface Listed {
  readonly feature: boolean;
  readonly endpoints: readonly WebhookEndpointView[];
}

export function WebhooksPanel(): ReactElement {
  const list = useListed<Listed>('/admin/webhooks');
  const [editing, setEditing] = useState<WebhookEndpointView | 'new' | null>(null);
  const [made, setMade] = useState<WebhookEndpointCreated | null>(null);
  const enable = (w: WebhookEndpointView): void => {
    list.put(at(w), switched(w), 'Enabling');
  };
  const form =
    editing === null ? null : (
      <WebhookForm
        key={editing === 'new' ? 'new' : editing.id}
        endpoint={editing === 'new' ? null : editing}
        done={(created) => {
          setEditing(null);
          setMade(created);
          void list.load();
        }}
        cancel={() => {
          setEditing(null);
        }}
      />
    );
  return (
    <section className="smg-panel smg-stack" aria-label="Webhooks">
      <h2>Webhooks</h2>
      <p className="smg-muted" data-testid="webhook-feature">
        {list.data?.feature === false
          ? 'Webhooks are off on this server (SMG_FEATURE_WEBHOOKS): nothing is queued or sent.'
          : 'Each event is posted, signed, to every enabled endpoint that wants it.'}
      </p>
      {list.problem === null ? null : <p role="alert">{list.problem}</p>}
      {made === null ? null : (
        <Secret
          made={made}
          close={() => {
            setMade(null);
          }}
        />
      )}
      {list.data?.endpoints.length === 0 ? <p>No webhook endpoint yet.</p> : null}
      <ul className="admin-list">
        {list.data?.endpoints.map((w) => (
          <Row key={w.id} w={w} a={{ edit: setEditing, open: list.open, enable }} />
        ))}
      </ul>
      <NewOrForm
        label="New webhook endpoint"
        form={form}
        start={() => {
          setEditing('new');
        }}
      />
      {list.dialog}
    </section>
  );
}
