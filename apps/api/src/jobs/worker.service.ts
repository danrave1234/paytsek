import { Injectable, Logger } from '@nestjs/common';
import { hostname } from 'node:os';
import { loadEnv } from '../config/env';
import { ReconcileService } from '../matching/reconcile.service';
import { AccountDeletionService } from '../privacy/account-deletion.service';
import { JobsService, type JobRow } from './jobs.service';
import { ExportService } from './export.service';
import { RetentionService } from './retention.service';
import { reportOperationalError } from '../common/monitoring';
export { csvEscape } from './export.service';

@Injectable()
export class WorkerService {
  private readonly logger = new Logger(WorkerService.name);
  private readonly env = loadEnv();
  private readonly workerId = `${hostname()}:${process.pid}`;
  private stopping = false;
  constructor(
    private readonly jobs: JobsService,
    private readonly reconcile: ReconcileService,
    private readonly exports: ExportService,
    private readonly retention: RetentionService,
    private readonly deletion: AccountDeletionService,
  ) {}

  async runForever(): Promise<void> {
    let lastMaintenance = 0;
    while (!this.stopping) {
      try {
        if (Date.now() - lastMaintenance > 3600_000) {
          await this.enqueueMaintenance();
          lastMaintenance = Date.now();
        }
        const result = await this.drain({ maxJobs: 25 });
        if (!result.processed) await new Promise((resolve) => setTimeout(resolve, this.env.WORKER_POLL_INTERVAL_MS));
      } catch {
        this.logger.error('WORKER_LOOP_RETRY');
        await new Promise((resolve) => setTimeout(resolve, this.env.WORKER_POLL_INTERVAL_MS));
      }
    }
  }
  stop(): void { this.stopping = true; }

  async drain({ maxJobs = 25, budgetMs = 8_000 }: { maxJobs?: number; budgetMs?: number } = {}): Promise<{ processed: number; timedOut: boolean }> {
    const limit = Math.max(1, Math.min(100, Math.floor(maxJobs)));
    const deadline = Date.now() + Math.max(1, Math.min(20_000, budgetMs));
    let processed = 0;
    while (!this.stopping && processed < limit && Date.now() < deadline) {
      // Do not lease a batch which the invocation cannot finish. Each job has
      // an attempt token; an expired worker cannot acknowledge a newer lease.
      const leased = await this.jobs.lease(this.workerId, 1, this.env.WORKER_LEASE_SECONDS);
      if (!leased.length) break;
      await this.runOne(leased[0]!);
      processed += 1;
    }
    return { processed, timedOut: Date.now() >= deadline };
  }

  async enqueueMaintenance(): Promise<void> {
    await this.jobs.enqueue('PURGE_RETENTION', {}, 'purge:periodic');
  }

  async runOne(job: JobRow): Promise<void> {
    try {
      switch (job.kind) {
        case 'RECONCILE_RECORD': await this.reconcile.reconcileRecord(String(job.payload.recordId)); break;
        case 'RECONCILE_EVENT': await this.reconcile.reconcileEvent(String(job.payload.eventId)); break;
        case 'GENERATE_EXPORT': await this.exports.generate(String(job.payload.exportJobId)); break;
        case 'DELETE_ACCOUNT': await this.deletion.process(String(job.payload.requestId)); break;
        case 'PURGE_RETENTION':
          if (await this.retention.run(job.payload.orgId ? String(job.payload.orgId) : null, Boolean(job.payload.hardDelete))) {
            await this.jobs.defer(job);
            return;
          }
          break;
        case 'RECONCILE_ENTITLEMENT': break;
        default: throw new Error('UNKNOWN_JOB_KIND');
      }
      await this.jobs.complete(job);
    } catch {
      // Payloads and arbitrary exception messages may contain personal data.
      this.logger.warn(`JOB_RETRY id=${job.id} kind=${job.kind} attempt=${job.attempts}`);
      await reportOperationalError('WORKER_FAILED');
      try { await this.jobs.fail(job, 'JOB_FAILED'); }
      catch { this.logger.error(`JOB_RETRY_PERSIST_FAILED id=${job.id}`); }
    }
  }
}
