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
  revision: number;
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
    const insert = async (runner: Queryable) => {
      if (dedupeKey) await runner.query(`select pg_advisory_xact_lock(hashtextextended($1,902))`, [dedupeKey]);
      await runner.query(
      `insert into jobs (kind, dedupe_key, payload, run_after) values ($1,$2,$3, now() + make_interval(secs => $4))
       on conflict (dedupe_key) where status = 'PENDING' and dedupe_key is not null
       do update set revision=jobs.revision+1, payload=excluded.payload, run_after=least(jobs.run_after,excluded.run_after)`,
      [kind, dedupeKey, JSON.stringify(payload), runAfterSeconds],
      );
    };
    if (q) await insert(q); else await this.db.tx(insert);
  }

  async lease(worker: string, limit: number, leaseSeconds: number): Promise<JobRow[]> {
    const r = await this.db.query<JobRow>(`select * from lease_jobs($1,$2,$3)`, [worker, limit, leaseSeconds]);
    return r.rows;
  }

  async complete(job: JobRow): Promise<void> {
    await this.db.query(`update jobs set status='DONE',finished_at=now(),leased_until=null
      where id=$1 and status='LEASED' and attempts=$2 and revision=$3`, [job.id, job.attempts, job.revision]);
  }

  async pendingToken(key: string): Promise<{ id: string; revision: number } | null> {
    return this.db.one(`select id,revision from jobs where dedupe_key=$1 and status='PENDING'`, [key]);
  }

  async completeInline(token: { id: string; revision: number } | null): Promise<void> {
    if (!token) return;
    await this.db.query(`update jobs set status='DONE',finished_at=now() where id=$1 and revision=$2 and status='PENDING'`, [token.id, token.revision]);
  }

  /** A maintenance batch makes progress, so continuations don't consume retries.
   * Resetting attempts also advances revision: an old lease must never regain
   * ownership when a later continuation reaches the same attempt count (ABA). */
  async defer(job: JobRow, runAfterSeconds = 1): Promise<void> {
    await this.retry(job, null, Math.max(1,Math.ceil(runAfterSeconds)), true);
  }

  private async retry(job: JobRow, code: string | null, seconds: number, progress = false): Promise<void> {
    await this.db.tx(async (tx) => {
      // Serialize with enqueue's uniqueness check, so a newer pending job wins.
      await tx.query(`select pg_advisory_xact_lock(hashtextextended($1,902))`, [job.dedupe_key ?? job.id]);
      const newer = job.dedupe_key ? await tx.query(`select id from jobs where dedupe_key=$1 and status='PENDING' and id<>$2`, [job.dedupe_key, job.id]) : null;
      if (newer?.rowCount) {
        await tx.query(`update jobs set status='DONE',finished_at=now(),leased_until=null where id=$1 and status='LEASED' and attempts=$2 and revision=$3`, [job.id, job.attempts, job.revision]);
        return;
      }
      await tx.query(`update jobs set status='PENDING',last_error=$3,leased_until=null,run_after=now()+make_interval(secs=>$4),
        attempts=case when $5 then 0 else attempts end,revision=case when $5 then revision+1 else revision end
        where id=$1 and status='LEASED' and attempts=$2 and revision=$6`, [job.id, job.attempts, code, seconds, progress, job.revision]);
    });
  }

  async fail(job: JobRow, error: string): Promise<void> {
    if (job.attempts >= job.max_attempts) {
      const changed = await this.db.query(`update jobs set status='DEAD',last_error=$3,finished_at=now(),leased_until=null
        where id=$1 and status='LEASED' and attempts=$2 and revision=$4`, [job.id, job.attempts, 'JOB_FAILED', job.revision]);
      if (changed.rowCount && job.kind === 'DELETE_ACCOUNT') await this.db.query(`update account_deletions set status='FAILED',last_error_code=coalesce(last_error_code,'ACCOUNT_DELETE_FAILED') where id=$1 and status<>'COMPLETE'`, [job.payload.requestId]);
      return;
    }
    // Exponential backoff with jitter, capped at 1 hour.
    const backoff = Math.min(3600, 5 * 2 ** job.attempts) + Math.floor(Math.random() * 5);
    await this.retry(job, 'JOB_RETRY', backoff);
  }
}
