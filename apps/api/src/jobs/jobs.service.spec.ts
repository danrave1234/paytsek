import { describe, expect, it, vi } from 'vitest';
import type { DbService } from '../db/db.service';
import { JobsService, type JobRow } from './jobs.service';

const oldLease: JobRow = { id:'00000000-0000-4000-8000-000000000001',kind:'RECONCILE_RECORD',payload:{recordId:'fixture'},dedupe_key:'record:fixture',attempts:1,max_attempts:8,revision:1 };
describe('job acknowledgment concurrency', () => {
  it('uses the captured revision, never an unconditional dedupe-key completion', async () => {
    const query = vi.fn(async () => ({ rowCount: 0, rows: [] }));
    const service = new JobsService({ query } as unknown as DbService);
    await service.completeInline({ id:oldLease.id,revision:1 });
    expect(query).toHaveBeenCalledWith(expect.stringContaining("revision=$2 and status='PENDING'"),[oldLease.id,1]);
  });
  it('does not let an expired lease complete a newer attempt', async () => {
    const query = vi.fn(async () => ({ rowCount: 0, rows: [] }));
    const service = new JobsService({ query } as unknown as DbService);
    await service.complete(oldLease);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("status='LEASED' and attempts=$2"),[oldLease.id,1]);
  });
  it('coalesces a failed leased job into newer pending work without unique-key failure', async () => {
    const query = vi.fn(async (sql: string) => ({ rowCount:sql.startsWith('select id') ? 1 : 0,rows:[] }));
    const tx = vi.fn(async (fn: (connection: { query: typeof query }) => unknown) => fn({ query }));
    const service = new JobsService({ tx } as unknown as DbService);
    await service.fail(oldLease,'private database detail');
    expect(query.mock.calls.some(([sql]) => sql.startsWith("update jobs set status='DONE'"))).toBe(true);
    expect(query.mock.calls.some(([sql]) => sql.startsWith("update jobs set status='PENDING'"))).toBe(false);
    expect(JSON.stringify(query.mock.calls)).not.toContain('private database detail');
  });
});
