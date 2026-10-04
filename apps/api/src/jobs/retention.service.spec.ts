import { describe, expect, it, vi } from 'vitest';
import type { DbService } from '../db/db.service';
import type { StorageService } from '../db/storage.service';
import { RetentionService } from './retention.service';

vi.mock('../config/env',()=>({loadEnv:()=>({RETENTION_RECORDS_MONTHS:12})}));
describe('resumable retention',()=>{
  it('records a dry-run report without deleting historical payment records',async()=>{
    const query=vi.fn(async()=>({rows:[],rowCount:0}));
    const service=new RetentionService({query} as unknown as DbService,{} as StorageService);
    await expect(service.run(null,false)).resolves.toBe(false);
    const sql=JSON.stringify(query.mock.calls);
    expect(sql).toContain('DRY_RUN');
    expect(sql).not.toContain('delete from payment_records');
  });
  it('does not mark an object purged when its Storage removal fails',async()=>{
    const query=vi.fn(async(sql:string)=>sql.startsWith('select id,storage_path from payment_proofs')?{rows:[{id:'proof',storage_path:'workspace/proof.jpg'}],rowCount:1}:{rows:[],rowCount:0});
    const remove=vi.fn(async()=>{throw new Error('storage unavailable');});
    const service=new RetentionService({query} as unknown as DbService,{remove} as unknown as StorageService);
    await expect(service.run(null,false)).rejects.toThrow('storage unavailable');
    expect(query.mock.calls.some(([sql])=>sql.startsWith('update payment_proofs'))).toBe(false);
  });
  it('refuses an unscoped hard deletion',async()=>{
    const service=new RetentionService({} as DbService,{} as StorageService);
    await expect(service.run(null,true)).rejects.toThrow('RETENTION_SCOPE_REQUIRED');
  });
});
