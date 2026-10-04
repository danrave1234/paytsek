import { describe, expect, it, vi } from 'vitest';
import type { DbService } from '../db/db.service';
import type { StorageService } from '../db/storage.service';
import { ExportService, MAX_EXPORT_ROWS } from './export.service';
vi.mock('../config/env',()=>({loadEnv:()=>({RETENTION_EXPORT_HOURS:24})}));
function setup(count=1, live=true) {
  const row={id:'fixture',transaction_at:new Date('2026-10-04T00:00:00Z'),provider:'Unknown provider',amount_centavos:'12345',evidence_state:'UNVERIFIED'};
  const query=vi.fn(async(sql:string)=>sql.startsWith('select r.id')?{rows:Array(count).fill(row),rowCount:count}:sql.includes('for share')?{rows:[],rowCount:live?1:0}:{rows:[],rowCount:0});
  const one=vi.fn(async()=>({organization_id:'workspace',format:'CSV',params:{from:'2026-10-04T00:00:00Z',to:'2026-10-05T00:00:00Z',includeVoided:false},status:'PENDING'}));
  const upload=vi.fn(async()=>undefined);
  const service=new ExportService({query,one,tx:async(fn:(tx:{query:typeof query})=>unknown)=>fn({query})} as unknown as DbService,{upload,exportsBucket:'exports'} as unknown as StorageService);
  return {service,query,upload};
}
describe('bounded CSV export',()=>{
  it('writes the real amount, visible proof provider and CSV content type',async()=>{
    const {service,upload}=setup();
    await service.generate('request');
    expect(upload).toHaveBeenCalledWith('exports','workspace/request.csv',expect.stringContaining('Unknown provider,123.45,12345,UNVERIFIED,Recorded'),'text/csv');
  });
  it('reports an oversized range without uploading a misleading partial file',async()=>{
    const {service,query,upload}=setup(MAX_EXPORT_ROWS+1);
    await service.generate('request');
    expect(upload).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledWith(expect.stringContaining("status='FAILED'"),['request','EXPORT_RANGE_TOO_LARGE']);
  });
  it('never uploads late bytes after a workspace was deleted',async()=>{
    const {service,upload}=setup(1,false);
    await service.generate('request');
    expect(upload).not.toHaveBeenCalled();
  });
});
