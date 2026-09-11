import { Injectable } from '@nestjs/common';
import type { JobKind } from '@paytsek/contracts';
import { DbService, type Queryable } from '../db/db.service';

export interface JobRow {
  id: string;
  kind: JobKind;
  dedupe_key: string | null;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
}

@Injectable()
export class JobsService {
  constructor(private readonly db: DbService) {}

  /**
   * Enqueue a durable job. With a dedupe key, at most one PENDING job exists per
   * key (coalescing bursts of reconciliation triggers for the same record).
   * Call inside the caller's transaction so the job commits with the data.
   */
  async enqueue(kind: JobKind, payload: Record<string, unknown>, dedupeKey: string | null, q?: Queryable, runAfterSeconds = 0): Promise<void> {
    const runner = q ?? this.db.pool;
    await runner.query(
      `insert into jobs (kind, dedupe_key, payload, run_after) values ($1,$2,$3, now() + make_interval(secs => $4))
       on conflict (dedupe_key) where status = 'PENDING' and dedupe_key is not null do nothing`,
      [kind, dedupeKey, JSON.stringify(payload), runAfterSeconds],
    );
  }

  async lease(worker: string, limit: number, leaseSeconds: number): Promise<JobRow[]> {
    const r = await this.db.query<JobRow>(`select * from lease_jobs($1,$2,$3)`, [worker, limit, leaseSeconds]);
    return r.rows;
  }

  async complete(id: string): Promise<void> {
    await this.db.query(`update jobs set status = 'DONE', finished_at = now(), leased_until = null where id = $1`, [id]);
  }

  async fail(job: JobRow, error: string): Promise<void> {
    if (job.attempts >= job.max_attempts) {
      await this.db.query(`update jobs set status = 'DEAD', last_error = $2, finished_at = now() where id = $1`, [job.id, error.slice(0, 500)]);
      return;
    }
    // Exponential backoff with jitter, capped at 1 hour.
    const backoff = Math.min(3600, 5 * 2 ** job.attempts) + Math.floor(Math.random() * 5);
    await this.db.query(
      `update jobs set status = 'PENDING', last_error = $2, leased_until = null, run_after = now() + make_interval(secs => $3) where id = $1`,
      [job.id, error.slice(0, 500), backoff],
    );
  }
}
