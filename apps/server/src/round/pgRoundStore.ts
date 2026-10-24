/**
 * @file   apps/server/src/round/pgRoundStore.ts
 * @module server/round
 * @brief  Rounds in PostgreSQL: creation with the sealed seed, batched event appends with
 *         their projections, snapshots, and loading for recovery.
 *
 * Responsibility: one transaction per batch (04 §5.3): the events, the round row's status,
 *                 the scheduled actions of a countdown, and at the end the results, team
 *                 results and the match standings; a snapshot every 200 events, keeping the
 *                 last two. Events are opaque JSON here; the actor knows their types.
 * Depends on:     pg (via ../db/pool), @smg/domain (types), ./pgResults, ./seal
 * Used by:        ./actor, ./rounds
 * Spec:           docs/spec/06-data-model-api-realtime.md §2.3–§2.5; docs/spec/04-software-architecture.md §5.3
 */
import type { PlayerResult, TeamResult } from '@smg/domain';
import type pg from 'pg';

import type { DbPool } from '../db/pool.js';
import { ts, writeResults } from './pgResults.js';
import { openSeed, sealSeed } from './seal.js';

export interface StoredEvent {
  readonly seq: number;
  readonly at: number;
  readonly type: string;
  readonly event: unknown;
}

export interface NewRoundRow {
  readonly id: string;
  readonly matchId: string;
  readonly gameId: string;
  readonly secretMode: 'shared' | 'individual';
  readonly season: string;
  readonly seasonSource: string;
  readonly specialOn: boolean;
  readonly halving: boolean;
  readonly teamsOn: boolean;
  readonly cooldownMs: number;
  readonly settings: unknown;
  readonly commitment: string | null;
  readonly seed: Uint8Array;
  readonly createdBy: string | null;
}

export interface RoundStatusRow {
  readonly status: string;
  readonly opensAt: number | null;
  readonly endedAt: number | null;
  readonly endReason: string | null;
  readonly abortReason: string | null;
}

export interface BatchWrite {
  readonly roundId: string;
  readonly matchId: string;
  readonly events: readonly StoredEvent[];
  readonly status: RoundStatusRow;
  readonly snapshot: { readonly seq: number; readonly state: unknown } | null;
  readonly schedule: readonly { readonly kind: string; readonly dueAt: number }[];
  readonly ended: {
    readonly results: readonly PlayerResult[];
    readonly teams: readonly TeamResult[];
  } | null;
  // Ended or aborted: pending scheduled actions are done.
  readonly finished: boolean;
}

export interface LoadedRound {
  readonly id: string;
  readonly matchId: string;
  readonly gameId: string;
  readonly seed: Uint8Array;
  readonly snapshot: { readonly seq: number; readonly state: unknown } | null;
  readonly events: readonly StoredEvent[];
}

export class PgRoundStore {
  constructor(
    private readonly pool: DbPool,
    private readonly key: Buffer,
  ) {}

  // Inserts the round row with its first event (RoundCreated) in one transaction.
  async create(row: NewRoundRow, created: StoredEvent): Promise<number> {
    return this.tx(async (c) => {
      const r = await c.query<{ round_index: number }>(
        `INSERT INTO smg.rounds (id, match_id, round_index, game_id, secret_mode, season,
           season_source, special_on, halving, teams_on, cooldown_ms, settings, seed_commitment,
           seed_enc, created_by)
         SELECT $14, $1, coalesce(max(round_index), 0) + 1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                decode($11, 'hex'), $12, $13
         FROM smg.rounds WHERE match_id = $1
         RETURNING round_index`,
        [
          row.matchId,
          row.gameId,
          row.secretMode,
          row.season,
          row.seasonSource,
          row.specialOn,
          row.halving,
          row.teamsOn,
          row.cooldownMs,
          JSON.stringify(row.settings),
          row.commitment,
          sealSeed(row.seed, this.key),
          row.createdBy,
          row.id,
        ],
      );
      await insertEvents(c, row.id, [created]);
      return r.rows[0]?.round_index ?? 0;
    });
  }

  async append(batch: BatchWrite): Promise<void> {
    await this.tx(async (c) => {
      await insertEvents(c, batch.roundId, batch.events);
      const s = batch.status;
      await c.query(
        `UPDATE smg.rounds SET status = $2, opens_at = $3, ended_at = $4, end_reason = $5,
           aborted_reason = $6 WHERE id = $1`,
        [batch.roundId, s.status, ts(s.opensAt), ts(s.endedAt), s.endReason, s.abortReason],
      );
      for (const a of batch.schedule) {
        await c.query(
          `INSERT INTO smg.scheduled_actions (round_id, kind, due_at) VALUES ($1, $2, $3)`,
          [batch.roundId, a.kind, ts(a.dueAt)],
        );
      }
      if (batch.finished) {
        await c.query(
          'UPDATE smg.scheduled_actions SET done_at = now() WHERE round_id = $1 AND done_at IS NULL',
          [batch.roundId],
        );
      }
      if (batch.ended !== null) await writeResults(c, batch.roundId, batch.matchId, batch.ended);
      if (batch.snapshot !== null) await writeSnapshot(c, batch.roundId, batch.snapshot);
    });
  }

  async load(roundId: string): Promise<LoadedRound | null> {
    const r = await this.pool.query<{ match_id: string; game_id: string; seed_enc: Buffer }>(
      'SELECT match_id::text, game_id, seed_enc FROM smg.rounds WHERE id = $1',
      [roundId],
    );
    const row = r.rows[0];
    if (row === undefined) return null;
    const snap = await this.pool.query<{ seq: string; state: unknown }>(
      'SELECT seq, state FROM smg.round_snapshots WHERE round_id = $1 ORDER BY seq DESC LIMIT 1',
      [roundId],
    );
    const snapRow = snap.rows[0];
    const snapshot =
      snapRow === undefined ? null : { seq: Number(snapRow.seq), state: snapRow.state };
    const events = await this.pool.query<{ seq: string; type: string; payload: unknown; at: Date }>(
      `SELECT seq, type, payload, occurred_at AS at FROM smg.round_events
       WHERE round_id = $1 AND seq > $2 ORDER BY seq`,
      [roundId, snapshot?.seq ?? 0],
    );
    return {
      id: roundId,
      matchId: row.match_id,
      gameId: row.game_id,
      seed: openSeed(row.seed_enc, this.key),
      snapshot,
      events: events.rows.map((e) => ({
        seq: Number(e.seq),
        at: e.at.getTime(),
        type: e.type,
        event: e.payload,
      })),
    };
  }

  // The whole log, for the verification route and tests.
  async log(roundId: string): Promise<StoredEvent[]> {
    const events = await this.pool.query<{ seq: string; type: string; payload: unknown; at: Date }>(
      'SELECT seq, type, payload, occurred_at AS at FROM smg.round_events WHERE round_id = $1 ORDER BY seq',
      [roundId],
    );
    return events.rows.map((e) => ({
      seq: Number(e.seq),
      at: e.at.getTime(),
      type: e.type,
      event: e.payload,
    }));
  }

  // Rounds that were running when the server stopped (recovery at start, 04 §5.3).
  async running(): Promise<string[]> {
    const r = await this.pool.query<{ id: string }>(
      `SELECT id::text FROM smg.rounds WHERE status IN ('created', 'countdown', 'open') ORDER BY created_at`,
    );
    return r.rows.map((x) => x.id);
  }

  private async tx<T>(work: (c: pg.PoolClient) => Promise<T>): Promise<T> {
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      const result = await work(c);
      await c.query('COMMIT');
      return result;
    } catch (error) {
      await c.query('ROLLBACK');
      throw error;
    } finally {
      c.release();
    }
  }
}

async function insertEvents(c: pg.PoolClient, roundId: string, events: readonly StoredEvent[]) {
  if (events.length === 0) return;
  await c.query(
    `INSERT INTO smg.round_events (round_id, seq, type, payload, occurred_at)
     SELECT $1, x.seq, x.type, x.payload, to_timestamp(x.at / 1000.0)
     FROM jsonb_to_recordset($2::jsonb) AS x(seq bigint, type text, payload jsonb, at double precision)`,
    [
      roundId,
      JSON.stringify(events.map((e) => ({ seq: e.seq, type: e.type, payload: e.event, at: e.at }))),
    ],
  );
}

async function writeSnapshot(
  c: pg.PoolClient,
  roundId: string,
  snap: { seq: number; state: unknown },
) {
  await c.query('INSERT INTO smg.round_snapshots (round_id, seq, state) VALUES ($1, $2, $3)', [
    roundId,
    snap.seq,
    JSON.stringify(snap.state),
  ]);
  // Keep the last two while the round runs (06 §2.3).
  await c.query(
    `DELETE FROM smg.round_snapshots WHERE round_id = $1 AND seq < (
       SELECT min(seq) FROM (SELECT seq FROM smg.round_snapshots WHERE round_id = $1
                             ORDER BY seq DESC LIMIT 2) last)`,
    [roundId],
  );
}
