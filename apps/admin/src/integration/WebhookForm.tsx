/**
 * @file   apps/admin/src/integration/WebhookForm.tsx
 * @module admin/integration
 * @brief  The form for a new webhook endpoint or a change of one.
 *
 * Responsibility: the https address, the events it wants (07 §3.2) and whether it is enabled,
 *                 checked with WebhookEndpointBody before it is sent; a new endpoint hands
 *                 the server's answer (with its signing secret, shown once) to its panel.
 * Depends on:     react, @smg/contracts (webhook schema, events, views), ../http, ../TextInput,
 *                 ./form
 * Used by:        ./WebhooksPanel
 * Spec:           docs/spec/07-integration.md §3.2; Bingo 07 §5
 */
import {
  WEBHOOK_EVENTS,
  WebhookEndpointBody,
  type WebhookEndpointCreated,
  type WebhookEndpointView,
  type WebhookEvent,
} from '@smg/contracts';
import { useState, type ReactElement, type SyntheticEvent } from 'react';

import { api, failureText } from '../http.js';
import { TextInput } from '../TextInput.js';
import { Checkbox, FormEnd, issueText } from './form.js';

const LABELS = { url: 'Address', events: 'Events', enabled: 'Enabled' };

export function WebhookForm(p: {
  readonly endpoint: WebhookEndpointView | null;
  // The created endpoint with its secret, or null after a change.
  readonly done: (created: WebhookEndpointCreated | null) => void;
  readonly cancel: () => void;
}): ReactElement {
  const [url, setUrl] = useState(p.endpoint?.url ?? '');
  const [events, setEvents] = useState<readonly WebhookEvent[]>(p.endpoint?.events ?? []);
  const [enabled, setEnabled] = useState(p.endpoint?.enabled ?? true);
  const [problem, setProblem] = useState<string | null>(null);
  const save = (e: SyntheticEvent): void => {
    e.preventDefault();
    const checked = WebhookEndpointBody.safeParse({
      url: url.trim(),
      events: WEBHOOK_EVENTS.filter((x) => events.includes(x)),
      enabled,
    });
    if (!checked.success) {
      setProblem(issueText(checked.error.issues, LABELS));
      return;
    }
    const body = checked.data;
    const sent =
      p.endpoint === null
        ? api<WebhookEndpointCreated>('/admin/webhooks', { method: 'POST', body })
        : api(`/admin/webhooks/${p.endpoint.id}`, { method: 'PUT', body }).then(() => null);
    sent.then(p.done).catch((error: unknown) => {
      setProblem(failureText(error, 'Saving the endpoint'));
    });
  };
  return (
    <form className="smg-panel smg-panel--inset smg-stack" onSubmit={save}>
      <h3>{p.endpoint === null ? 'New webhook endpoint' : `Change ${p.endpoint.url}`}</h3>
      <TextInput label="Address (https)" visible value={url} onChange={setUrl} maxLength={500} />
      <fieldset className="smg-row">
        <legend>Events</legend>
        {WEBHOOK_EVENTS.map((x) => (
          <Checkbox
            key={x}
            label={x}
            checked={events.includes(x)}
            onChange={(on) => {
              setEvents(on ? [...events, x] : events.filter((y) => y !== x));
            }}
          />
        ))}
      </fieldset>
      <Checkbox label="Enabled" checked={enabled} onChange={setEnabled} />
      <FormEnd saveLabel="Save endpoint" problem={problem} cancel={p.cancel} />
    </form>
  );
}
