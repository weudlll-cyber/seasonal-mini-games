/**
 * @file   apps/server/src/integration/safePost.ts
 * @module server/integration
 * @brief  POST a small body to an outside HTTPS address without opening a door inward.
 *
 * Responsibility: the webhook side of `SafeHttpClient` (Bingo 03 §10), with the address rules of
 *                 ../seasons/safeFetch: HTTPS only, every address the host resolves to must be
 *                 public (checked on the address actually connected, so DNS rebinding cannot
 *                 slip past), no redirects followed, a 5 s timeout, the answer's body discarded.
 *                 Development and tests may allow private addresses and add a trusted test CA.
 * Depends on:     node:https, node:dns, node:net, ../seasons/safeFetch (address rules)
 * Used by:        ./webhookDelivery, ../http/app
 * Spec:           docs/spec/07-integration.md §1, §3.2; Bingo 07 §5; Bingo 03 §10
 */
import { lookup, type LookupAddress } from 'node:dns';
import { request } from 'node:https';
import { isIP, type LookupFunction } from 'node:net';

import { FetchRefused, isPublicAddress } from '../seasons/safeFetch.js';

const TIMEOUT_MS = 5_000;

interface PostOptions {
  // Development and tests only: private and loopback addresses (a local test receiver).
  readonly allowLocal: boolean;
  // Tests only: the certificate of a local HTTPS receiver.
  readonly ca?: string;
}

// The lookup the socket uses: every resolved address must be public.
const publicOnly: LookupFunction = (hostname, options, callback) => {
  lookup(hostname, { ...options, all: true }, (error, addresses: LookupAddress[]) => {
    const refused =
      error ??
      (addresses.length === 0 || !addresses.every((a) => isPublicAddress(a.address))
        ? new FetchRefused('the webhook address is not public')
        : null);
    const first = addresses[0];
    if (refused !== null || first === undefined) {
      callback(refused ?? new FetchRefused('no address'), '', 4);
    } else if (options.all === true) {
      (callback as unknown as (e: null, all: LookupAddress[]) => void)(null, addresses);
    } else {
      callback(null, first.address, first.family);
    }
  });
};

function target(address: string, options: PostOptions): URL {
  const url = new URL(address);
  if (url.protocol !== 'https:') throw new FetchRefused('a webhook must be an https address');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (!options.allowLocal && isIP(host) !== 0 && !isPublicAddress(host)) {
    throw new FetchRefused('the webhook address is not public');
  }
  return url;
}

// The answer's status code; throws on a refused address, a network error or the timeout.
export async function safePost(
  address: string,
  body: string,
  headers: Readonly<Record<string, string>>,
  options: PostOptions,
): Promise<number> {
  const url = target(address, options);
  return new Promise<number>((resolve, reject) => {
    const req = request(
      url,
      {
        method: 'POST',
        headers: { ...headers, 'content-length': String(Buffer.byteLength(body)) },
        timeout: TIMEOUT_MS,
        ...(options.allowLocal ? {} : { lookup: publicOnly }),
        ...(options.ca === undefined ? {} : { ca: options.ca }),
      },
      (res) => {
        // The answer is not read: only its status counts.
        res.resume();
        resolve(res.statusCode ?? 0);
      },
    );
    req.on('timeout', () => req.destroy(new FetchRefused('the webhook timed out')));
    req.on('error', reject);
    req.end(body);
  });
}
