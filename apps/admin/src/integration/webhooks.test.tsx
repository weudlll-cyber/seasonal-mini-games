// @vitest-environment jsdom
/**
 * @file   apps/admin/src/integration/webhooks.test.tsx
 * @module admin/integration
 * @brief  The webhooks screen: feature state, new (secret once), change, disable, remove with
 *         the step-up, deliveries.
 *
 * Responsibility: the screen says when the feature is off; a new endpoint needs an https
 *                 address and an event, and its secret is shown once, gone when closed and not
 *                 in the list again; a change sends the endpoint; Disable goes through the
 *                 confirm dialog; a Remove answered AUTH_STEP_UP_REQUIRED asks for a code
 *                 (../StepUp) and is sent again; Deliveries lists an endpoint's deliveries.
 * Depends on:     vitest, @testing-library/react, @smg/contracts, ../StepUp, ./WebhooksPanel,
 *                 ./fakeServer
 * Spec:           docs/spec/07-integration.md §3.2; Bingo 07 §5; Bingo 11 §1
 */
import type { WebhookEndpointView } from '@smg/contracts';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StepUp } from '../StepUp.js';
import {
  click,
  confirm,
  fakeServer,
  flush,
  type,
  writes,
  type Answer,
  type Call,
} from './fakeServer.js';
import { WebhooksPanel } from './WebhooksPanel.js';

// Each test renders the screen with the step-up dialog and walks it: up to 1.8 s alone on the
// development laptop, past 5 s in a full run's parallel files; a test past its time keeps
// running into the next one (DECISIONS T206).
vi.setConfig({ testTimeout: 20_000 });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const HOOK: WebhookEndpointView = {
  id: '6f1e0c2a-0000-4000-8000-0000000000aa',
  url: 'https://hooks.example/in',
  events: ['round.ended'],
  enabled: true,
  createdAt: '2026-11-04T00:00:00.000Z',
  lastDelivery: null,
};
const SECRET = 'whsec-shown-once';

function answer(c: Call): Answer | undefined {
  if (c.path.endsWith('/deliveries')) {
    const delivery = { id: 'd1', event: 'round.ended', status: 'failed', attempts: 3 };
    return {
      status: 200,
      body: {
        deliveries: [
          { ...delivery, lastError: 'HTTP 500', createdAt: HOOK.createdAt, deliveredAt: null },
        ],
      },
    };
  }
  if (c.method === 'GET') return { status: 200, body: { feature: false, endpoints: [HOOK] } };
  if (c.method === 'POST') return { status: 201, body: { ...HOOK, id: 'new', secret: SECRET } };
  return undefined;
}

async function screenWith(serve: (c: Call) => Answer | undefined) {
  const calls = fakeServer(serve);
  render(
    <>
      <StepUp />
      <WebhooksPanel />
    </>,
  );
  await flush();
  return calls;
}

describe('the webhooks screen', () => {
  it('says the feature is off and shows a new endpoint secret once', async () => {
    const calls = await screenWith(answer);
    expect(screen.getByTestId('webhook-feature').textContent).toContain('Webhooks are off');
    await click('New webhook endpoint');
    type('Address (https)', 'http://plain.example/in');
    await click('Save endpoint');
    expect(screen.getByRole('alert').textContent).toMatch(/^Address: /);
    type('Address (https)', 'https://new.example/in');
    await click('Save endpoint');
    expect(screen.getByRole('alert').textContent).toMatch(/^Events: /);
    screen.getByLabelText('match.opened').click();
    await click('Save endpoint');
    expect(writes(calls)).toEqual([
      {
        method: 'POST',
        path: '/admin/webhooks',
        body: { url: 'https://new.example/in', events: ['match.opened'], enabled: true },
      },
    ]);
    expect(screen.getByTestId('webhook-secret').textContent).toBe(SECRET);
    await click('I have stored it');
    expect(screen.queryByTestId('webhook-secret')).toBeNull();
    expect(document.body.textContent).not.toContain(SECRET);
  });

  it('changes an endpoint, disables it through the confirm dialog, lists its deliveries', async () => {
    const calls = await screenWith(answer);
    await click('Change');
    screen.getByLabelText('match.closed').click();
    await click('Save endpoint');
    expect(writes(calls)[0]).toMatchObject({
      method: 'PUT',
      body: { events: ['round.ended', 'match.closed'] },
    });
    await click('Disable');
    expect(await confirm()).toContain('No event is queued for https://hooks.example/in');
    expect(writes(calls)[1]?.body).toEqual({ url: HOOK.url, events: HOOK.events, enabled: false });
    await click('Deliveries');
    expect(screen.getByTestId('deliveries').textContent).toContain(
      'round.ended · failed · 3 attempts',
    );
  });
});

describe('a write on the webhooks screen that needs the step-up', () => {
  it('asks for a fresh two-factor check when the server wants one, then removes', async () => {
    let fresh = false;
    const calls = await screenWith((c) => {
      if (c.path === '/me/2fa/step-up') fresh = true;
      if (c.method === 'DELETE' && !fresh)
        return { status: 403, body: { code: 'AUTH_STEP_UP_REQUIRED' } };
      return answer(c);
    });
    await click('Remove');
    await confirm();
    type('Code', '123456');
    await click('Check code');
    expect(writes(calls).map((c) => `${c.method} ${c.path}`)).toEqual([
      `DELETE /admin/webhooks/${HOOK.id}`,
      'POST /me/2fa/step-up',
      `DELETE /admin/webhooks/${HOOK.id}`,
    ]);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
