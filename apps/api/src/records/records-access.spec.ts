import { describe, expect, it, vi } from 'vitest';
import type { CreateRecordRequest } from '@paytsek/contracts';
import type { DbService } from '../db/db.service';
import type { AuditService } from '../db/audit.service';
import type { ReconcileService } from '../matching/reconcile.service';
import type { ProofsService } from './proofs.service';
import { RecordsService } from './records.service';
vi.mock('../config/env',()=>({loadEnv:()=>({BETA_MODE:true})}));

const input={clientRecordId:'record',proofId:'proof'} as CreateRecordRequest;
function setup(results:unknown[]) {
  const one=vi.fn();
  for(const result of results)one.mockResolvedValueOnce(result);
  return new RecordsService({one} as unknown as DbService,{} as AuditService,{} as ReconcileService,{} as ProofsService);
}
describe('record creation replay authorization',()=>{
  it('does not reveal a coworker record through a client-id replay',async()=>{
    const service=setup([{created_by:'coworker'}]);
    await expect(service.create('workspace','cashier',input)).rejects.toMatchObject({code:'FORBIDDEN'});
  });
  it('does not reveal a coworker record through exact proof deduplication',async()=>{
    const service=setup([null,{upload_finalized_at:new Date(),purged_at:null,linked:'other-record'},{created_by:'coworker'}]);
    await expect(service.create('workspace','cashier',input)).rejects.toMatchObject({code:'FORBIDDEN'});
  });
  it('does not acknowledge a new record against purged image bytes',async()=>{
    const service=setup([null,{upload_finalized_at:new Date(),purged_at:new Date(),linked:null}]);
    await expect(service.create('workspace','cashier',input)).rejects.toMatchObject({code:'PROOF_UPLOAD_NOT_FINALIZED'});
  });
});
