import { describe, expect, it, vi } from 'vitest';
import type { DbService } from '../db/db.service';
import type { StorageService } from '../db/storage.service';
import { ReadinessService } from './readiness.controller';

vi.mock('../config/env',()=>({loadEnv:()=>({BETA_MODE:true})}));
describe('dependency readiness and operational health',()=>{
  it('measures overdue deadlines instead of the age of intentionally scheduled jobs',async()=>{
    const one=vi.fn().mockResolvedValueOnce({ready:true}).mockResolvedValueOnce({pending:1,dead:0,oldestAgeSeconds:0,failedDeletions:0});
    const service=new ReadinessService({one} as unknown as DbService,{privateBucketsReady:async()=>true} as StorageService);
    expect(await service.inspect()).toMatchObject({ok:true,operationalStatus:'HEALTHY'});
    const sql=one.mock.calls[1]![0] as string;
    expect(sql).toContain("status='PENDING' and run_after<=now()");
    expect(sql).toContain("status='LEASED' and leased_until<=now()");
    expect(sql).not.toContain('min(created_at)');
  });
  it('allows a corrective deploy with healthy dependencies and a visible old queue',async()=>{
    const one=vi.fn().mockResolvedValueOnce({ready:true}).mockResolvedValueOnce({pending:20,dead:0,oldestAgeSeconds:3600,failedDeletions:0});
    const service=new ReadinessService({one} as unknown as DbService,{privateBucketsReady:async()=>true} as StorageService);
    expect(await service.inspect()).toMatchObject({ok:true,betaModeEnabled:true,operationalStatus:'DEGRADED',checks:{database:true,schema:true,storage:true,queue:false}});
  });
  it('fails readiness when private storage or expected schema is unavailable',async()=>{
    const service=new ReadinessService({one:async()=>({ready:false})} as unknown as DbService,{privateBucketsReady:async()=>false} as StorageService);
    expect(await service.inspect()).toMatchObject({ok:false,checks:{schema:false,storage:false}});
  });
  it('returns in a bounded time when a dependency hangs',async()=>{
    vi.useFakeTimers();
    try {
      const service=new ReadinessService({one:()=>new Promise(()=>{})} as unknown as DbService,{privateBucketsReady:async()=>true} as StorageService);
      const response=service.inspect();
      await vi.advanceTimersByTimeAsync(5000);
      expect(await response).toMatchObject({ok:false,checks:{database:false,storage:true}});
    } finally {vi.useRealTimers();}
  });
});
