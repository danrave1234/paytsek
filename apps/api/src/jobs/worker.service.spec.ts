import { describe, expect, it, vi } from 'vitest';
import type { JobsService, JobRow } from './jobs.service';
import type { ReconcileService } from '../matching/reconcile.service';
import type { ExportService } from './export.service';
import type { RetentionService } from './retention.service';
import type { AccountDeletionService } from '../privacy/account-deletion.service';
import { WorkerService } from './worker.service';

vi.mock('../config/env', () => ({ loadEnv: () => ({ WORKER_LEASE_SECONDS: 60, WORKER_POLL_INTERVAL_MS: 1 }) }));
vi.mock('../common/monitoring', () => ({ reportOperationalError: vi.fn(async () => undefined) }));
const job: JobRow = { id: '00000000-0000-4000-8000-000000000001', kind: 'PURGE_RETENTION', dedupe_key: 'purge:periodic', payload: {}, attempts: 1, max_attempts: 8, revision: 1 };
function setup(more = false, runAfterSeconds = 1) {
  const jobs = { lease: vi.fn(async (_worker: string, _limit: number, _seconds: number) => [job]), complete: vi.fn(), defer: vi.fn(), fail: vi.fn(), enqueue: vi.fn() };
  const retention = { run: vi.fn(async () => ({more,runAfterSeconds})) };
  const worker = new WorkerService(jobs as unknown as JobsService, {} as ReconcileService, {} as ExportService, retention as unknown as RetentionService, {} as AccountDeletionService);
  return { jobs, retention, worker };
}
describe('bounded worker', () => {
  it('leases one job at a time and respects the invocation job limit', async () => {
    const { worker, jobs } = setup();
    expect(await worker.drain({ maxJobs: 2 })).toEqual({ processed: 2, timedOut: false });
    expect(jobs.lease.mock.calls.every((call) => call[1] === 1)).toBe(true);
    expect(jobs.complete).toHaveBeenCalledTimes(2);
  });
  it('defers a partial retention batch instead of marking it complete', async () => {
    const { worker, jobs } = setup(true);
    await worker.runOne(job);
    expect(jobs.defer).toHaveBeenCalledWith(job,1);
    expect(jobs.complete).not.toHaveBeenCalled();
  });
  it('schedules an intentional upload-capability hold at its deadline',async()=>{
    const {worker,jobs}=setup(true,86400);
    await worker.runOne(job);
    expect(jobs.defer).toHaveBeenCalledWith(job,86400);
    expect(jobs.complete).not.toHaveBeenCalled();
  });
  it('records a stable retry code without raw exception data', async () => {
    const { worker, jobs, retention } = setup();
    retention.run.mockRejectedValue(new Error('sensitive arbitrary value'));
    await worker.runOne(job);
    expect(jobs.fail).toHaveBeenCalledWith(job, 'JOB_FAILED');
    expect(jobs.complete).not.toHaveBeenCalled();
  });
});
