import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { loadEnv } from '../config/env';

export type Queryable = Pick<PoolClient, 'query'>;

/**
 * Thin repository layer over `pg`. All SQL is parameterized; no string
 * interpolation of user input is permitted anywhere in the API.
 */
@Injectable()
export class DbService implements OnModuleDestroy {
  readonly pool: Pool;

  constructor() {
    const env = loadEnv();
    // Every warm serverless instance keeps its own pool, and there can be many
    // at once, so a per-instance max sized for a single long-running server
    // would exhaust Postgres connections under load. Vercel sets VERCEL=1.
    // Pair this with Supabase's pooled connection string (port 6543), not the
    // direct one (5432) -- see docs/run-and-release.md.
    const serverless = process.env.VERCEL === '1';
    this.pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: serverless ? 1 : env.DATABASE_POOL_MAX,
      idleTimeoutMillis: serverless ? 10_000 : undefined,
      application_name: 'paytsek-api',
      statement_timeout: 15_000,
    });
  }

  query<R extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<QueryResult<R>> {
    return this.pool.query<R>(text, params);
  }

  async one<R extends QueryResultRow>(text: string, params: unknown[] = []): Promise<R | null> {
    const r = await this.pool.query<R>(text, params);
    return r.rows[0] ?? null;
  }

  /**
   * Run `fn` inside a transaction. Serialization failures / deadlocks are
   * retried a bounded number of times; unique-violation conflicts are NOT
   * retried — callers translate them into stable conflict errors.
   */
  async tx<T>(fn: (client: PoolClient) => Promise<T>, opts: { isolation?: 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE'; retries?: number } = {}): Promise<T> {
    const retries = opts.retries ?? 3;
    let attempt = 0;
    for (;;) {
      const client = await this.pool.connect();
      try {
        await client.query(`BEGIN ISOLATION LEVEL ${opts.isolation ?? 'READ COMMITTED'}`);
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        const code = (err as { code?: string }).code;
        if ((code === '40001' || code === '40P01') && attempt < retries) {
          attempt += 1;
          await new Promise((r) => setTimeout(r, 25 * 2 ** attempt));
          continue;
        }
        throw err;
      } finally {
        client.release();
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}

export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  const e = err as { code?: string; constraint?: string };
  if (e?.code !== '23505') return false;
  return constraint ? e.constraint === constraint : true;
}
