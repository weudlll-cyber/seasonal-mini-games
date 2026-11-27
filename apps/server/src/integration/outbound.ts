/**
 * @file   apps/server/src/integration/outbound.ts
 * @module server/integration
 * @brief  The two calls the server makes to addresses an admin typed: read JSON, post a webhook.
 *
 * Responsibility: both go through the kit's `guardedFetch` (T429), which refuses every address
 *                 that is not public, however it is written, checks the one actually connected,
 *                 follows no redirect and ends after 5 s. The JSON read (season feed, provider
 *                 keys) may reach only the host of the address asked for (T266) and takes 64 KiB
 *                 at most. A webhook is https only, also in development, and only its answer's
 *                 status counts. Development builds may allow private addresses (a local test
 *                 feed or receiver), and for the JSON read plain HTTP.
 * Depends on:     @seasonal/kit/server (guardedFetch, FetchRefused)
 * Used by:        ../seasons/seasons, ../http/integrationWiring
 * Spec:           docs/spec/07-integration.md §1, §3.2, §5; Bingo 03 §10; Bingo 07 §5
 */
import { FetchRefused, guardedFetch } from '@seasonal/kit/server';

// The kit reads an answer whole, so a webhook's answer is bounded too, though nothing reads it:
// far above any receiver's "ok", so a talkative one still counts as delivered (T429).
const WEBHOOK_ANSWER_BYTES = 1024 * 1024;

interface OutboundOptions {
  // Development and tests only: private and loopback addresses.
  readonly allowLocal: boolean;
}

// A JSON document from `address`; throws on a refused address, a status that is not 2xx, an
// answer too large or no JSON.
export async function fetchJson(address: string, options: OutboundOptions): Promise<unknown> {
  const send = guardedFetch({ ...options, allowedHosts: [new URL(address).hostname] });
  const response = await send(address, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new FetchRefused(`the feed answered ${String(response.status)}`);
  return response.json();
}

// The status a webhook receiver answers with; throws on a refused address, a redirect, a
// network error or the timeout.
export async function postWebhook(
  address: string,
  body: string,
  headers: Readonly<Record<string, string>>,
  options: OutboundOptions,
): Promise<number> {
  // The kit allows plain HTTP with the development allowance; a webhook never does.
  if (new URL(address).protocol !== 'https:') {
    throw new FetchRefused('a webhook must be an https address');
  }
  const send = guardedFetch({ ...options, maxBytes: WEBHOOK_ANSWER_BYTES });
  return (await send(address, { method: 'POST', headers: { ...headers }, body })).status;
}
