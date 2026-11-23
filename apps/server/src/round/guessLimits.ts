/**
 * @file   apps/server/src/round/guessLimits.ts
 * @module server/round
 * @brief  Play rate limits (guesses, team changes, the host's round commands), the round queue
 *         bound and the abuse signals of guesses.
 *
 * Responsibility: the limits are settings (`rate.*`, `abuse.*`, 08 §6) read every second into
 *                 memory, so the gateway checks them without waiting (04 §5.2: nothing is
 *                 awaited between reading a guess and queueing it), and a change takes effect
 *                 within a second ("immediate"). A guess flood above the per-account limit is
 *                 RATE_LIMITED and raises the abuse score; so do more cooldown refusals per
 *                 minute than `abuse.cooldownRejectsPerMin` (05 §2, §5), and more than
 *                 BOT_TIMED_PER_MIN accepted guesses in a minute that each arrive within
 *                 `abuse.botTimingWindowMs` after the account's previous cooldown ended (05 §7).
 *                 A team change and a host's round command each wait their interval
 *                 (`rate.teamChoosePerMin`, `rate.hostRoundCommandsPerMin`: one per 60 s ÷ the
 *                 setting) per account (05 §5). Bots have no account and raise nothing.
 * Depends on:     @smg/application (settings), @smg/contracts, @smg/domain (Reply),
 *                 @smg/game-sdk, ../auth/rateLimit, ../admin/abuse, ../db/pool
 * Used by:        ./runtime, ../realtime/*, ../http/routes/rounds, ../http/routes/matches,
 *                 ../http/routes/series, ../../tools/testServer and test/harness (`aheadClock`)
 * Spec:           docs/spec/05-security-threat-model.md §2, §5, §7; docs/spec/08-admin-settings.md §6
 */
import type { SettingsService } from '@smg/application';
import { PLATFORM_SETTINGS } from '@smg/contracts';
import type { Reply } from '@smg/domain';
import { resolveSettings } from '@smg/game-sdk';

import { recordSignal } from '../admin/abuse.js';
import { RateLimiter } from '../auth/rateLimit.js';
import type { DbPool } from '../db/pool.js';

// More guesses than this in one minute, each within the window after its cooldown's end, are
// "repeatedly" (05 §7): one abuse signal for that minute.
export const BOT_TIMED_PER_MIN = 3;

interface Values {
  readonly perAccountPerS: number;
  readonly httpPerSessionPerMin: number;
  readonly teamPerMin: number;
  readonly hostPerMin: number;
  readonly queueBound: number;
  readonly cooldownRejectsPerMin: number;
  readonly botWindowMs: number;
}

function read(rates: Record<string, unknown>, security: Record<string, unknown>): Values {
  return {
    perAccountPerS: rates['rate.guessPerAccountPerS'] as number,
    httpPerSessionPerMin: rates['rate.httpGuessPerSessionPerMin'] as number,
    teamPerMin: rates['rate.teamChoosePerMin'] as number,
    hostPerMin: rates['rate.hostRoundCommandsPerMin'] as number,
    queueBound: rates['rate.roundQueueBound'] as number,
    cooldownRejectsPerMin: security['abuse.cooldownRejectsPerMin'] as number,
    botWindowMs: security['abuse.botTimingWindowMs'] as number,
  };
}

// The play limits' clock of an automated run: a minute later at every read, so no run waits
// for a host's or a team change's interval (the suites' harness, the e2e test server, T406).
export function aheadClock(): () => number {
  let t = Date.now();
  return () => (t += 60_000);
}

// One call per interval: a bucket of one token, refilled in 60 s ÷ `perMin`.
const oneEvery = (perMin: number, now?: () => number) =>
  new RateLimiter({ limit: 1, windowMs: 60_000 / perMin }, now);

// A count per account and minute: the count once it passes `over` (once a minute), else null.
function counted(
  counts: Map<string, { minute: number; n: number }>,
  accountId: string,
  now: number,
  over: number,
): number | null {
  const minute = Math.floor(now / 60_000);
  const seen = counts.get(accountId);
  const n = seen?.minute === minute ? seen.n + 1 : 1;
  counts.set(accountId, { minute, n });
  return n === over + 1 ? n : null;
}

export class GuessLimits {
  private values: Values = read(
    resolveSettings(PLATFORM_SETTINGS.rate_limits ?? [], {}),
    resolveSettings(PLATFORM_SETTINGS.security ?? [], {}),
  );
  private account = new RateLimiter({ limit: this.values.perAccountPerS, windowMs: 1_000 });
  private http = new RateLimiter({ limit: this.values.httpPerSessionPerMin, windowMs: 60_000 });
  private team: RateLimiter;
  private host: RateLimiter;
  private readonly cooldownRejects = new Map<string, { minute: number; n: number }>();
  private readonly botTimed = new Map<string, { minute: number; n: number }>();
  // Each account's last accepted guess's cooldown end (05 §7).
  private readonly cooldownEnds = new Map<string, number>();
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly settings: SettingsService,
    private readonly pool: DbPool,
    // The clock of the team and host limits (tests move it).
    private readonly now: () => number = Date.now,
  ) {
    this.team = oneEvery(this.values.teamPerMin, now);
    this.host = oneEvery(this.values.hostPerMin, now);
  }

  start(): void {
    const refresh = () => this.refresh();
    void refresh();
    this.timer = setInterval(() => void refresh(), 1_000);
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  // Reads the settings once; `start` repeats it every second.
  async refresh(): Promise<void> {
    try {
      const [r, s] = await Promise.all([
        this.settings.values('rate_limits'),
        this.settings.values('security'),
      ]);
      this.apply(read(r, s));
    } catch (error) {
      console.error('[smg] guess limits refresh failed:', error);
    }
  }

  private apply(next: Values): void {
    const was = this.values;
    if (next.perAccountPerS !== was.perAccountPerS) {
      this.account = new RateLimiter({ limit: next.perAccountPerS, windowMs: 1_000 });
    }
    if (next.httpPerSessionPerMin !== was.httpPerSessionPerMin) {
      this.http = new RateLimiter({ limit: next.httpPerSessionPerMin, windowMs: 60_000 });
    }
    if (next.teamPerMin !== was.teamPerMin) this.team = oneEvery(next.teamPerMin, this.now);
    if (next.hostPerMin !== was.hostPerMin) this.host = oneEvery(next.hostPerMin, this.now);
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

  // A team change (`team.choose` or POST …/team) by this account (05 §5).
  allowTeam(accountId: string): boolean {
    return this.team.take(accountId).allowed;
  }

  // A host's round command (create, start, end, abort, a series' start) over HTTP or socket.
  allowHost(accountId: string): boolean {
    return this.host.take(accountId).allowed;
  }

  // A guess's answer, received at `at`: cooldown refusals and bot-like timing count (05 §2, §7).
  noteReply(accountId: string | null, answer: Reply, at = Date.now()): void {
    if (accountId === null) return;
    if (!answer.ok) {
      if (answer.code !== 'COOLDOWN_ACTIVE') return;
      const n = counted(this.cooldownRejects, accountId, at, this.values.cooldownRejectsPerMin);
      if (n !== null)
        this.signal(accountId, 'cooldownRejects', `${String(n)} cooldown refusals in a minute`);
      return;
    }
    if (answer.cooldownEndsAt === undefined) return;
    const before = this.cooldownEnds.get(accountId);
    this.cooldownEnds.set(accountId, answer.cooldownEndsAt);
    // Accepted, so at or after the previous cooldown's end; within the window counts.
    if (before === undefined || at - before > this.values.botWindowMs) return;
    const n = counted(this.botTimed, accountId, at, BOT_TIMED_PER_MIN);
    if (n !== null) {
      const ms = String(this.values.botWindowMs);
      this.signal(
        accountId,
        'botTiming',
        `${String(n)} guesses within ${ms} ms of the cooldown's end in a minute`,
      );
    }
  }

  private signal(accountId: string, kind: string, detail: string): void {
    void recordSignal(this.pool, { accountId, kind, detail, weight: 1 }).catch((error: unknown) => {
      console.error('[smg] abuse signal failed:', error);
    });
  }
}
