/**
 * @file   apps/server/src/db/pool.ts
 * @module server/db
 * @brief  Lightweight wrapper around node-postgres with a single pool per server.
 *
 * Responsibility: create and dispose a pg.Pool, run one transaction (`inTransaction`), expose
 *                 a readiness probe used by /readyz. The pool is kept small for dev (max 10) and left to the
 *                 operator to tune for production via DATABASE_URL's `max=` query.
 * Depends on:     pg
 * Used by:        ../main, ../http/app, ./migrator, ../cli, ../index, ../auth/*, ../admin/*,
 *                 ../http/routes/*, ../match/*, ../round/*, ../realtime/*, ../dev/quickTest
 * Spec:           Bingo 04 §1, Bingo 02 §7
 */
import pg from 'pg';

const { Pool } = pg;

export type DbPool = pg.Pool;

export function createPool(databaseUrl: string): DbPool {
  // application_name tags connections in pg_stat_activity so an operator can see which
  // server is talking to this database.
  return new Pool({ connectionString: databaseUrl, application_name: 'smg-server', max: 10 });
}

// One transaction on one client: committed when `work` returns, rolled back when it throws.
export async function inTransaction<T>(
  pool: DbPool,
  work: (c: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const c = await pool.connect();
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

export async function pingDatabase(pool: DbPool): Promise<void> {
  // `SELECT 1` keeps the probe cheap and sidesteps planner hints on empty tables.
  await pool.query('SELECT 1');
}
