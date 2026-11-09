/**
 * @file   apps/server/src/integration/accountFeed.ts
 * @module server/integration
 * @brief  Website mode: the background poller of the website's account-changes feed (O66).
 *
 * Responsibility: every 15 s, GET /api/games/mini-games/account-changes?since=<cursor> from
 *                 the website's local address (SMG_WEBSITE_LOCAL_URL) with X-Games-Sync-Token;
 *                 each answer's changes are applied in order (./accountChanges) and its `next`
 *                 stored as the cursor (smg.website_feed), asking again until `next` stops
 *                 changing (at most 500 changes an answer). A kind the game does not know is
 *                 logged once per process and handled like `rights`. The time of the last
 *                 successful poll is kept for `smg status` (GET /readyz, `feedLastSuccess`).
 *                 Errors back off (30 s doubling to 10 min) and are logged by their message only: the token is
 *                 never in a log line. A plain fetch with a 10 s timeout, no redirects and a
 *                 256 KiB cap, not the SafeHttpClient, which takes public https addresses only
 *                 (an SSRF guard for addresses admins type); this one is the operator's local
 *                 http address from the env file (DECISIONS T217).
 * Depends on:     zod, ../db/pool, ../auth/sessionEnds (types), ./accountChanges,
 *                 ../seasons/safeFetch (readLimited, FetchRefused)
 * Used by:        ../main, ../http/routes/health (feedLastSuccess), test/*
 * Spec:           docs/spec/07-integration.md §7; docs/spec/05-security-threat-model.md §1
 */
import { z } from 'zod';

import type { SessionEnds } from '../auth/sessionEnds.js';
import type { DbPool } from '../db/pool.js';
import { FetchRefused, readLimited } from '../seasons/safeFetch.js';
import {
  ACCOUNT_CHANGE_KINDS,
  applyAccountChange,
  FeedChange,
  type AccountChange,
} from './accountChanges.js';

const FEED_PATH = '/api/games/mini-games/account-changes';
const TIMEOUT_MS = 10_000;
const LIMIT_BYTES = 256 * 1024;
const POLL_MS = 15_000;
const BACKOFF_FIRST_MS = 30_000;
const BACKOFF_MAX_MS = 10 * 60_000;
// Answers read in one poll at most (500 changes each); the rest waits for the next poll.
const PAGES_PER_POLL = 20;

const Page = z.object({
  changes: z.array(FeedChange).max(500),
  next: z.string().min(1).max(128),
});

interface FeedLog {
  info(details: object, message: string): void;
  warn(details: object, message: string): void;
}

export interface AccountFeedDeps {
  readonly pool: DbPool;
  // The site origin: the issuer of the website's `proxy_header` provider.
  readonly issuer: string;
  readonly localUrl: string;
  readonly token: string;
  readonly sessionEnds: SessionEnds;
  readonly log: FeedLog;
}

async function fetchPage(deps: AccountFeedDeps, since: string): Promise<z.infer<typeof Page>> {
  const url = new URL(FEED_PATH, deps.localUrl);
  url.searchParams.set('since', since);
  const response = await fetch(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { accept: 'application/json', 'x-games-sync-token': deps.token },
  });
  if (!response.ok) throw new FetchRefused(`the feed answered ${String(response.status)}`);
  const page = Page.safeParse(JSON.parse(await readLimited(response, LIMIT_BYTES)));
  if (!page.success) throw new FetchRefused('the feed answer has the wrong shape');
  return page.data;
}

// The unknown kinds already logged by this process: each is logged once.
const loggedKinds = new Set<string>();

// A change the game knows; an unknown kind is logged once and handled like `rights` (its
// sessions end, so the next sign-in asks the website again), as Bingo's feed does.
function known(deps: AccountFeedDeps, change: z.infer<typeof FeedChange>): AccountChange {
  const kind = ACCOUNT_CHANGE_KINDS.find((k) => k === change.kind);
  if (kind !== undefined) return { id: change.id, kind };
  if (!loggedKinds.has(change.kind)) {
    loggedKinds.add(change.kind);
    deps.log.warn({ kind: change.kind }, 'website account feed: unknown kind handled as rights');
  }
  return { id: change.id, kind: 'rights' };
}

async function cursorOf(pool: DbPool): Promise<string> {
  const r = await pool.query<{ cursor: string }>('SELECT cursor FROM smg.website_feed');
  return r.rows[0]?.cursor ?? '0';
}

// One poll: every new change applied, the cursor moved on; the number of changes applied.
export async function pollAccountFeed(deps: AccountFeedDeps): Promise<number> {
  let since = await cursorOf(deps.pool);
  let applied = 0;
  for (let page = 0; page < PAGES_PER_POLL; page += 1) {
    const answer = await fetchPage(deps, since);
    for (const change of answer.changes) {
      const ended = await applyAccountChange(deps.pool, deps.issuer, known(deps, change));
      deps.sessionEnds.end(ended);
    }
    applied += answer.changes.length;
    await deps.pool.query('UPDATE smg.website_feed SET cursor = $1', [answer.next]);
    if (answer.next === since || answer.changes.length === 0) break;
    since = answer.next;
  }
  await deps.pool.query('UPDATE smg.website_feed SET last_success_at = now()');
  return applied;
}

// When the last poll succeeded, or null before the first.
export async function feedLastSuccess(pool: DbPool): Promise<Date | null> {
  const r = await pool.query<{ at: Date | null }>(
    'SELECT last_success_at AS at FROM smg.website_feed',
  );
  return r.rows[0]?.at ?? null;
}

// A failure's message without anything sent (the token is a header, never in an error).
function reason(error: unknown): string {
  if (!(error instanceof Error)) return 'unknown error';
  const cause = (error.cause as { code?: unknown } | undefined)?.code;
  return typeof cause === 'string' ? `${error.message} (${cause})` : error.message;
}

// Starts the poller; the returned function stops it.
export function startAccountFeed(deps: AccountFeedDeps): () => void {
  let timer: NodeJS.Timeout | undefined;
  let stopped = false;
  let backoff = 0;
  const schedule = (ms: number) => {
    if (!stopped) timer = setTimeout(() => void tick(), ms).unref();
  };
  const tick = async () => {
    try {
      const applied = await pollAccountFeed(deps);
      if (applied > 0) deps.log.info({ applied }, 'website account changes applied');
      backoff = 0;
      schedule(POLL_MS);
    } catch (error) {
      backoff = backoff === 0 ? BACKOFF_FIRST_MS : Math.min(backoff * 2, BACKOFF_MAX_MS);
      await deps.pool
        .query('UPDATE smg.website_feed SET last_failure_at = now()')
        .catch(() => undefined);
      deps.log.warn({ reason: reason(error), retryMs: backoff }, 'website account feed failed');
      schedule(backoff);
    }
  };
  schedule(0);
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
