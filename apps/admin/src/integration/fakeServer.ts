/**
 * @file   apps/admin/src/integration/fakeServer.ts
 * @module admin/integration
 * @brief  For the Integration area's tests: a fake API in place of `fetch`, and the steps
 *         a test takes on the page.
 *
 * Responsibility: answer each call with what the test's handler returns for its method and
 *                 path (204 without a body by default) and record every call with its body,
 *                 so a test checks what the screen sent; type into a labelled field, click a
 *                 button by its name, confirm the open dialog, and let the answers arrive.
 * Depends on:     vitest, @testing-library/react
 * Used by:        ./providers.test, ./origins.test, ./webhooks.test
 * Spec:           docs/spec/09-testing-strategy.md §1
 */
import { act, fireEvent, screen } from '@testing-library/react';
import { vi } from 'vitest';

export interface Call {
  readonly method: string;
  // Under api/v1, with the query: "/admin/embed-origins?origin=…".
  readonly path: string;
  readonly body: unknown;
}

export interface Answer {
  readonly status: number;
  readonly body?: unknown;
}

export function fakeServer(answer: (call: Call) => Answer | undefined): Call[] {
  const calls: Call[] = [];
  const fetch = vi.fn((url: string, init: RequestInit = {}) => {
    const call = {
      method: init.method ?? 'GET',
      path: url.replace(/^.*api\/v1/, ''),
      body: typeof init.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
    };
    calls.push(call);
    const a = answer(call) ?? { status: 204 };
    // What ../http reads of a response, settled in microtasks: a real `Response` parses its
    // body through a stream over several turns of the event loop, more on a busy machine,
    // so `flush` let a full test run miss an answer (play-test clean state, piece 3).
    const reply = {
      status: a.status,
      ok: a.status >= 200 && a.status < 300,
      headers: new Headers(),
      json: () =>
        a.body === undefined ? Promise.reject(new SyntaxError('no body')) : Promise.resolve(a.body),
    };
    return Promise.resolve(reply as unknown as Response);
  });
  vi.stubGlobal('fetch', fetch);
  return calls;
}

// The writes among the calls (everything but GET).
export const writes = (calls: readonly Call[]): Call[] => calls.filter((c) => c.method !== 'GET');

export const flush = () =>
  act(async () => {
    for (let i = 0; i < 5; i += 1) await new Promise((done) => setTimeout(done, 0));
  });

export const type = (label: string | RegExp, value: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
};

export async function click(name: string | RegExp): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name }));
  await flush();
}

// The open confirm dialog's sentence, then its confirm button pressed.
export async function confirm(): Promise<string> {
  const effect = screen.getByTestId('confirm-effect').textContent;
  fireEvent.click(screen.getByTestId('confirm-action'));
  await flush();
  return effect;
}
