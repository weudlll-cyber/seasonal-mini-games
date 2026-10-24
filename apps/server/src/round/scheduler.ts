/**
 * @file   apps/server/src/round/scheduler.ts
 * @module server/round
 * @brief  Timed round commands as rows in scheduled_actions: open and time-up.
 *
 * Responsibility: the loop polls every `pollMs`, claims due rows with FOR UPDATE SKIP
 *                 LOCKED and a 30-second lease (safe with several instances), runs each
 *                 through its round in due order, and marks it done; a failing action is
 *                 retried up to five times with a growing delay. Rows are written by the
 *                 batch that starts a countdown (./pgRoundStore), so a restarted server
 *                 continues every round. The round itself catches up with time, so a late
 *                 firing changes nothing (DECISIONS T32). Adapted from Bingo's pgScheduler.ts.
 * Depends on:     node:crypto, ../db/pool, ./rounds
 * Used by:        ../main, test/*
 * Spec:           docs/spec/04-software-architecture.md §5.5; docs/spec/06-data-model-api-realtime.md §2.5
 */
import { randomUUID } from 'node:crypto';

import type { DbPool } from '../db/pool.js';
import type { Rounds } from './rounds.js';

const MAX_ATTEMPTS = 5;

interface ActionRow {
  id: string;
  round_id: string;
  kind: 'round_open' | 'round_time_up' | 'special';
  attempts: number;
}

export class RoundScheduler {
  private readonly owner = `smg-${randomUUID()}`;
  private timer: NodeJS.Timeout | null = null;
  private running: Promise<void> | null = null;

  constructor(
    private readonly pool: DbPool,
    private readonly rounds: Rounds,
    private readonly pollMs: number,
  ) {}

  start(): void {
    const tick = (): void => {
      this.running = this.runDue()
        .catch((error: unknown) => {
          console.error('[smg] scheduler tick failed:', error);
        })
        .finally(() => {
          if (this.timer !== null) this.timer = setTimeout(tick, this.pollMs);
        });
    };
    this.timer = setTimeout(tick, this.pollMs);
  }

  async stop(): Promise<void> {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    await this.running;
  }

  private async runDue(): Promise<void> {
    const claimed = await this.pool.query<ActionRow>(
      `UPDATE smg.scheduled_actions SET lease_owner = $1, lease_until = now() + interval '30 seconds'
       WHERE id IN (
         SELECT id FROM smg.scheduled_actions
         WHERE done_at IS NULL AND due_at <= now() AND (lease_until IS NULL OR lease_until < now())
         ORDER BY due_at, id LIMIT 50 FOR UPDATE SKIP LOCKED)
       RETURNING id::text, round_id::text, kind, attempts`,
      [this.owner],
    );
    const rows = [...claimed.rows].sort((a, b) => Number(a.id) - Number(b.id));
    for (const row of rows) await this.runOne(row);
  }

  private async runOne(row: ActionRow): Promise<void> {
    try {
      const round = await this.rounds.get(row.round_id);
      // Specials join with the seasonal specials; until then no row of that kind exists.
      if (round !== null && row.kind !== 'special') {
        await round.run({ type: row.kind === 'round_open' ? 'open' : 'timeUp' });
      }
      await this.pool.query('UPDATE smg.scheduled_actions SET done_at = now() WHERE id = $1', [
        row.id,
      ]);
    } catch (error) {
      const attempts = row.attempts + 1;
      console.error(
        `[smg] action ${row.kind} for ${row.round_id} failed (${String(attempts)}):`,
        error,
      );
      await this.pool.query(
        `UPDATE smg.scheduled_actions SET attempts = $2, lease_until = NULL,
           due_at = now() + make_interval(secs => $2),
           done_at = CASE WHEN $2 >= $3 THEN now() END
         WHERE id = $1`,
        [row.id, attempts, MAX_ATTEMPTS],
      );
    }
  }
}
