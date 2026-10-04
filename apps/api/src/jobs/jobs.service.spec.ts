import { describe, expect, it, vi } from 'vitest';
import type { DbService } from '../db/db.service';
import { JobsService, type JobRow } from './jobs.service';

const oldLease: JobRow = { id:'00000000-0000-4000-8000-000000000001',kind:'RECONCILE_RECORD',payload:{recordId:'fixture'},dedupe_key:'record:fixture',attempts:1,max_attempts:8,revision:1 };
describe('job acknowledgment concurrency', () => {
  it('expedites previously deferred work when a fresh trigger is due now',async()=>{
    const query=vi.fn(async()=>({rows:[],rowCount:1}));
    const service=new JobsService({tx:async(fn:(connection:{query:typeof query})=>unknown)=>fn({query})} as unknown as DbService);
    await service.enqueue('PURGE_RETENTION',{},'purge:periodic');
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining('run_after=least(jobs.run_after,excluded.run_after)'),['PURGE_RETENTION','purge:periodic','{}',0]);
  });
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
    expect(query).toHaveBeenCalledWith(expect.stringContaining("status='LEASED' and attempts=$2 and revision=$3"),[oldLease.id,1,1]);
  });
  it('coalesces a failed leased job into newer pending work without unique-key failure', async () => {
    const query = vi.fn(async (sql: string, _params?: unknown[]) => ({ rowCount:sql.startsWith('select id') ? 1 : 0,rows:[] }));
    const tx = vi.fn(async (fn: (connection: { query: typeof query }) => unknown) => fn({ query }));
    const service = new JobsService({ tx } as unknown as DbService);
    await service.fail(oldLease,'private database detail');
    expect(query.mock.calls.some(([sql]) => sql.startsWith("update jobs set status='DONE'"))).toBe(true);
    expect(query.mock.calls.some(([sql]) => sql.startsWith("update jobs set status='PENDING'"))).toBe(false);
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining('attempts=$2 and revision=$3'),[oldLease.id,1,1]);
    expect(JSON.stringify(query.mock.calls)).not.toContain('private database detail');
  });
  it('advances revision atomically whenever a continuation resets attempts',async()=>{
    const query=vi.fn(async(_sql:string,_params?:unknown[])=>({rows:[],rowCount:1}));
    const service=new JobsService({tx:async(fn:(connection:{query:typeof query})=>unknown)=>fn({query})} as unknown as DbService);
    await service.defer({...oldLease,dedupe_key:null},8100);
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining('revision=case when $5 then revision+1 else revision end'),[oldLease.id,1,null,8100,true,1]);
    expect(query.mock.calls.at(-1)![0]).toContain('attempts=$2 and revision=$6');
  });
  it('fences failed retry updates without resetting retry count',async()=>{
    const query=vi.fn(async(_sql:string,_params?:unknown[])=>({rows:[],rowCount:0}));
    const service=new JobsService({tx:async(fn:(connection:{query:typeof query})=>unknown)=>fn({query})} as unknown as DbService);
    await service.fail({...oldLease,dedupe_key:null},'private details');
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining('attempts=$2 and revision=$6'),[oldLease.id,1,'JOB_RETRY',expect.any(Number),false,1]);
  });
  it('never marks account deletion failed when a stale terminal lease changes no job',async()=>{
    const query=vi.fn(async(_sql:string,_params?:unknown[])=>({rows:[],rowCount:0}));
    const service=new JobsService({query} as unknown as DbService);
    await service.fail({...oldLease,kind:'DELETE_ACCOUNT',max_attempts:1,payload:{requestId:'request'}},'private details');
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('attempts=$2 and revision=$4'),[oldLease.id,1,'JOB_FAILED',1]);
  });
  it('marks only the changed terminal account job failed and preserves completed requests',async()=>{
    const query=vi.fn(async(_sql:string,_params?:unknown[])=>({rows:[],rowCount:1}));
    const service=new JobsService({query} as unknown as DbService);
    await service.fail({...oldLease,kind:'DELETE_ACCOUNT',max_attempts:1,payload:{requestId:'request'}},'private details');
    expect(query).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining("status<>'COMPLETE'"),['request']);
  });
});
