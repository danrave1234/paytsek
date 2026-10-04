import { describe, expect, it, vi } from 'vitest';
import type { InitProofUploadRequest } from '@paytsek/contracts';
import type { DbService } from '../db/db.service';
import type { StorageService } from '../db/storage.service';
import { ProofsService } from './proofs.service';
vi.mock('../config/env',()=>({loadEnv:()=>({BETA_MODE:true,RETENTION_PROOF_IMAGE_FREE_DAYS:30})}));

const input:InitProofUploadRequest={clientProofId:'00000000-0000-4000-8000-000000000001',sha256:'a'.repeat(64),contentType:'image/jpeg',byteLength:200,perceptualHash:null};
const stored={id:'proof',sha256:input.sha256,content_type:input.contentType,byte_length:input.byteLength,upload_finalized_at:new Date(),purged_at:null};
function setup(proof:unknown, live=true, member=true) {
  const storage={createSignedUpload:vi.fn(async()=>({url:'https://storage.example.invalid/upload',expiresAt:new Date('2027-01-01T02:00:00Z')})),proofPath:()=> 'workspace/proof.jpg',proofsBucket:'proofs'};
  const query=vi.fn(async(sql:string)=>sql.startsWith('select id from organizations')?{rows:[],rowCount:live?1:0}
    :sql.startsWith('select 1 from memberships')?{rows:[],rowCount:member?1:0}
    :sql.startsWith('select storage_path')?{rows:[{storage_path:'workspace/proof.jpg'}],rowCount:1}
    :sql.startsWith('select id, upload')?{rows:proof?[proof]:[],rowCount:proof?1:0}:{rows:[{id:'proof'}],rowCount:1});
  const tx=async(fn:(q:{query:typeof query})=>unknown)=>fn({query});
  return {service:new ProofsService({tx} as unknown as DbService,storage as unknown as StorageService),storage,query};
}
describe('proof idempotency preserves actual image evidence',()=>{
  it('reuses an intact finalized image',async()=>{
    const {service}=setup(stored);
    await expect(service.init('workspace','user',input)).resolves.toMatchObject({alreadyStored:true,proofId:'proof'});
  });
  it('does not acknowledge bytes removed by retention',async()=>{
    const {service,storage}=setup({...stored,purged_at:new Date()});
    await expect(service.init('workspace','user',input)).rejects.toMatchObject({code:'PROOF_UPLOAD_NOT_FINALIZED'});
    expect(storage.createSignedUpload).not.toHaveBeenCalled();
  });
  it('does not bind a reused client ID to different bytes',async()=>{
    const {service}=setup({...stored,sha256:'b'.repeat(64)});
    await expect(service.init('workspace','user',input)).rejects.toMatchObject({code:'IDEMPOTENCY_CONFLICT'});
  });
  it('refuses issuance after workspace deletion even if request authorization ran earlier',async()=>{
    const {service,storage}=setup(stored,false);
    await expect(service.init('workspace','user',input)).rejects.toMatchObject({code:'NOT_A_MEMBER'});
    expect(storage.createSignedUpload).not.toHaveBeenCalled();
  });
  it('persists the actual capability expiry before returning the signed URL',async()=>{
    const {service,storage,query}=setup({...stored,upload_finalized_at:null});
    const result=await service.init('workspace','user',input);
    expect(result.expiresAt).toBe('2027-01-01T02:00:00.000Z');
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining('upload_authorized_until=greatest'),['proof',new Date(result.expiresAt)]);
    expect(query.mock.calls[0]![0]).toContain('for update');
    expect(query.mock.calls[1]![0]).toContain('select 1 from memberships');
    expect(storage.createSignedUpload).toHaveBeenCalledTimes(1);
  });
  it('rechecks membership in a fresh statement after acquiring the workspace lock',async()=>{
    const {service,storage}=setup({...stored,upload_finalized_at:null},true,false);
    await expect(service.init('workspace','user',input)).rejects.toMatchObject({code:'NOT_A_MEMBER'});
    expect(storage.createSignedUpload).not.toHaveBeenCalled();
  });
});
