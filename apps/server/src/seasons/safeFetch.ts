/**
 * @file   apps/server/src/seasons/safeFetch.ts
 * @module server/seasons
 * @brief  Fetch a small JSON document from an outside address without opening a door inward.
 *
 * Responsibility: what 07 §5 asks of `SafeHttpClient` (Bingo 03 §10): HTTPS only, every
 *                 address the host resolves to must be public (no loopback, private,
 *                 link-local, carrier-grade NAT or unique-local range, IPv4-mapped included),
 *                 no redirects, a 5 s timeout and a 64 KiB limit on the answer. Development
 *                 builds may allow plain HTTP and private addresses, for a local test feed.
 * Depends on:     node:dns/promises, node:net
 * Used by:        ./feed
 * Spec:           docs/spec/07-integration.md §5; docs/spec/09-testing-strategy.md §6 (feed)
 */
import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

const LIMIT_BYTES = 64 * 1024;
const TIMEOUT_MS = 5_000;

const blocked = new BlockList();
for (const [net, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
  ['224.0.0.0', 4],
] as const) {
  blocked.addSubnet(net, prefix, 'ipv4');
}
for (const [net, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  blocked.addSubnet(net, prefix, 'ipv6');
}

export function isPublicAddress(address: string): boolean {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1];
  if (mapped !== undefined) return isPublicAddress(mapped);
  const family = isIP(address);
  if (family === 0) return false;
  return !blocked.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

export class FetchRefused extends Error {}

export interface SafeFetchOptions {
  // Development only: plain HTTP and private addresses (a local test feed).
  readonly allowLocal: boolean;
}

async function checkTarget(url: URL, options: SafeFetchOptions): Promise<void> {
  if (url.protocol !== 'https:' && !(options.allowLocal && url.protocol === 'http:')) {
    throw new FetchRefused('the feed must be an https address');
  }
  if (options.allowLocal) return;
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses =
    isIP(host) !== 0 ? [host] : (await lookup(host, { all: true })).map((a) => a.address);
  if (addresses.length === 0 || !addresses.every(isPublicAddress)) {
    throw new FetchRefused('the feed address is not public');
  }
}

async function readLimited(response: Response): Promise<string> {
  if (response.body === null) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of response.body as AsyncIterable<Uint8Array>) {
    size += chunk.byteLength;
    if (size > LIMIT_BYTES) throw new FetchRefused('the feed answer is larger than 64 KiB');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function safeFetchJson(address: string, options: SafeFetchOptions): Promise<unknown> {
  const url = new URL(address);
  await checkTarget(url, options);
  const response = await fetch(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { accept: 'application/json' },
  });
  if (!response.ok) throw new FetchRefused(`the feed answered ${String(response.status)}`);
  return JSON.parse(await readLimited(response)) as unknown;
}
