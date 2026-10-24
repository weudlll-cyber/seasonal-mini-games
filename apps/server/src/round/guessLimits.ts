/**
 * @file   apps/server/src/round/guessLimits.ts
 * @module server/round
 * @brief  Guess rate limits, the round queue bound and the abuse signals of refused guesses.
 *
 * Responsibility: the limits are settings (`rate.*`, `abuse.*`, 08 §6) read every second into
 *                 memory, so the gateway checks them without waiting (04 §5.2: nothing is
 *                 awaited between reading a guess and queueing it). A guess flood above the
 *                 per-account limit is RATE_LIMITED and raises the abuse score; so do more
 *                 cooldown refusals per minute than `abuse.cooldownRejectsPerMin` (05 §2, §5).
 *                 Bots have no account and raise nothing.
 * Depends on:     @smg/application (settings), @smg/contracts, @smg/game-sdk, ../auth/rateLimit,
 *                 ../admin/abuse, ../db/pool
 * Used by:        ../http/app, ../realtime/intents, ../http/routes/rounds
 * Spec:           docs/spec/05-security-threat-model.md §2, §5; docs/spec/08-admin-settings.md §6
 */
import type { SettingsService } from '@smg/application';
import { PLATFORM_SETTINGS } from '@smg/contracts';
import { resolveSettings } from '@smg/game-sdk';

import { recordSignal } from '../admin/abuse.js';
import { RateLimiter } from '../auth/rateLimit.js';
import type { DbPool } from '../db/pool.js';

interface Values {
  readonly perAccountPerS: number;
  readonly httpPerSessionPerMin: number;
  readonly queueBound: number;
  readonly cooldownRejectsPerMin: number;
}

function read(rates: Record<string, unknown>, security: Record<string, unknown>): Values {
  return {
    perAccountPerS: rates['rate.guessPerAccountPerS'] as number,
    httpPerSessionPerMin: rates['rate.httpGuessPerSessionPerMin'] as number,
    queueBound: rates['rate.roundQueueBound'] as number,
    cooldownRejectsPerMin: security['abuse.cooldownRejectsPerMin'] as number,
  };
}

export class GuessLimits {
  private values: Values = read(
    resolveSettings(PLATFORM_SETTINGS.rate_limits ?? [], {}),
    resolveSettings(PLATFORM_SETTINGS.security ?? [], {}),
  );
  private account = new RateLimiter({ limit: this.values.perAccountPerS, windowMs: 1_000 });
  private http = new RateLimiter({ limit: this.values.httpPerSessionPerMin, windowMs: 60_000 });
  private readonly cooldownRejects = new Map<string, { minute: number; n: number }>();
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly settings: SettingsService,
    private readonly pool: DbPool,
  ) {}

  start(): void {
    const refresh = () => {
      void Promise.all([this.settings.values('rate_limits'), this.settings.values('security')])
        .then(([r, s]) => {
          this.apply(read(r, s));
        })
        .catch((error: unknown) => {
          console.error('[smg] guess limits refresh failed:', error);
        });
    };
    refresh();
    this.timer = setInterval(refresh, 1_000);
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  private apply(next: Values): void {
    if (next.perAccountPerS !== this.values.perAccountPerS) {
      this.account = new RateLimiter({ limit: next.perAccountPerS, windowMs: 1_000 });
    }
    if (next.httpPerSessionPerMin !== this.values.httpPerSessionPerMin) {
      this.http = new RateLimiter({ limit: next.httpPerSessionPerMin, windowMs: 60_000 });
    }
    this.values = next;
  }

  queueBound(): number {
    return this.values.queueBound;
  }

  // Socket and HTTP guesses of one account share this limit; HTTP adds its own per session.
  allow(accountId: string | null, playerKey: string, httpSession?: string): boolean {
    const ok =
      this.account.take(playerKey).allowed &&
      (httpSession === undefined || this.http.take(httpSession).allowed);
    if (!ok && accountId !== null) this.signal(accountId, 'rateLimited', 'guess flood');
    return ok;
  }

  noteReply(accountId: string | null, code: string | undefined, now = Date.now()): void {
    if (accountId === null || code !== 'COOLDOWN_ACTIVE') return;
    const minute = Math.floor(now / 60_000);
    const seen = this.cooldownRejects.get(accountId);
    const n = seen?.minute === minute ? seen.n + 1 : 1;
    this.cooldownRejects.set(accountId, { minute, n });
    // One signal per minute, when the count passes the threshold.
    if (n === this.values.cooldownRejectsPerMin + 1) {
      this.signal(accountId, 'cooldownRejects', `${String(n)} cooldown refusals in a minute`);
    }
  }

  private signal(accountId: string, kind: string, detail: string): void {
    void recordSignal(this.pool, { accountId, kind, detail, weight: 1 }).catch((error: unknown) => {
      console.error('[smg] abuse signal failed:', error);
    });
  }
}
