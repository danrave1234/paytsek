import { describe, expect, it, vi } from 'vitest';
import type { InitProofUploadRequest } from '@paytsek/contracts';
import type { DbService } from '../db/db.service';
import type { StorageService } from '../db/storage.service';
import { ProofsService } from './proofs.service';
vi.mock('../config/env',()=>({loadEnv:()=>({STORAGE_SIGNED_UPLOAD_TTL_SECONDS:300})}));

const input:InitProofUploadRequest={clientProofId:'00000000-0000-4000-8000-000000000001',sha256:'a'.repeat(64),contentType:'image/jpeg',byteLength:200,perceptualHash:null};
const stored={id:'proof',sha256:input.sha256,content_type:input.contentType,byte_length:input.byteLength,upload_finalized_at:new Date(),purged_at:null};
function setup(proof:unknown) {
  const storage={createSignedUpload:vi.fn()};
  return {service:new ProofsService({one:async()=>proof} as unknown as DbService,storage as unknown as StorageService),storage};
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
});
