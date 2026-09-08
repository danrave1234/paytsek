import { Injectable } from '@nestjs/common';
import type { InitProofUploadRequest, InitProofUploadResponse } from '@payrecord/contracts';
import { ApiException } from '../common/errors';
import { loadEnv } from '../config/env';
import { DbService, isUniqueViolation } from '../db/db.service';
import { StorageService } from '../db/storage.service';

@Injectable()
export class ProofsService {
  private readonly env = loadEnv();

  constructor(
    private readonly db: DbService,
    private readonly storage: StorageService,
  ) {}

  /** Retention entitlement fixed at creation: paid plan or any prepaid credit => paid retention. */
  private async retentionDays(orgId: string): Promise<number> {
    const r = await this.db.one<{ plan_code: string; credits: number }>(
      `select o.plan_code, prepaid_credits_remaining(o.id) as credits from organizations o where o.id = $1`,
      [orgId],
    );
    const paid = r && (r.plan_code !== 'FREE' || r.credits > 0);
    return paid ? this.env.RETENTION_PROOF_IMAGE_PAID_DAYS : this.env.RETENTION_PROOF_IMAGE_FREE_DAYS;
  }

  async init(orgId: string, userId: string, input: InitProofUploadRequest): Promise<InitProofUploadResponse> {
    const expiresAt = new Date(Date.now() + this.env.STORAGE_SIGNED_UPLOAD_TTL_SECONDS * 1000).toISOString();
    // Exact-bytes duplicate within the workspace -> reuse the stored proof; no second upload.
    const dup = await this.db.one<{ id: string; upload_finalized_at: Date | null }>(
      `select id, upload_finalized_at from payment_proofs where organization_id = $1 and (sha256 = $2 or client_proof_id = $3)`,
      [orgId, input.sha256, input.clientProofId],
    );
    if (dup?.upload_finalized_at) return { proofId: dup.id, uploadUrl: null, uploadHeaders: {}, alreadyStored: true, expiresAt };

    let proofId = dup?.id ?? null;
    if (!proofId) {
      const days = await this.retentionDays(orgId);
      try {
        const ins = await this.db.query<{ id: string }>(
          `insert into payment_proofs (organization_id, client_proof_id, uploaded_by, content_type, byte_length, sha256, perceptual_hash, retention_days, retention_until)
           values ($1,$2,$3,$4,$5,$6,$7,$8, now() + make_interval(days => $8)) returning id`,
          [orgId, input.clientProofId, userId, input.contentType, input.byteLength, input.sha256, input.perceptualHash ?? null, days],
        );
        proofId = ins.rows[0]!.id;
      } catch (e) {
        if (!isUniqueViolation(e)) throw e;
        const again = await this.db.one<{ id: string }>(`select id from payment_proofs where organization_id = $1 and (sha256 = $2 or client_proof_id = $3)`, [orgId, input.sha256, input.clientProofId]);
        proofId = again!.id;
      }
    }
    const path = this.storage.proofPath(orgId, proofId, input.contentType);
    await this.db.query(`update payment_proofs set storage_path = $2 where id = $1 and storage_path is null`, [proofId, path]);
    const signed = await this.storage.createSignedUpload(this.storage.proofsBucket, path);
    return { proofId, uploadUrl: signed.url, uploadHeaders: { 'x-upsert': 'false' }, alreadyStored: false, expiresAt };
  }

  /** Verify the object exists and its size matches, then mark finalized. */
  async finalize(orgId: string, proofId: string): Promise<{ proofId: string; finalized: boolean }> {
    const p = await this.db.one<{ storage_path: string | null; byte_length: number; upload_finalized_at: Date | null }>(
      `select storage_path, byte_length, upload_finalized_at from payment_proofs where id = $1 and organization_id = $2`,
      [proofId, orgId],
    );
    if (!p) throw new ApiException('NOT_FOUND', 'Proof not found');
    if (p.upload_finalized_at) return { proofId, finalized: true };
    if (!p.storage_path) throw new ApiException('PROOF_UPLOAD_NOT_FINALIZED', 'Upload was never initialized');
    const stat = await this.storage.stat(this.storage.proofsBucket, p.storage_path);
    if (!stat || (stat.size > 0 && stat.size !== p.byte_length)) {
      throw new ApiException('PROOF_UPLOAD_NOT_FINALIZED', 'Uploaded bytes not found or size mismatch; retry the upload');
    }
    await this.db.query(`update payment_proofs set upload_finalized_at = now() where id = $1`, [proofId]);
    return { proofId, finalized: true };
  }

  /** Short-lived signed URL for viewing; null when purged or not finalized. */
  async signedView(orgId: string, proofId: string): Promise<{ url: string; expiresAt: string; retentionUntil: string } | null> {
    const p = await this.db.one<{ storage_path: string | null; upload_finalized_at: Date | null; purged_at: Date | null; retention_until: Date }>(
      `select storage_path, upload_finalized_at, purged_at, retention_until from payment_proofs where id = $1 and organization_id = $2`,
      [proofId, orgId],
    );
    if (!p?.storage_path || !p.upload_finalized_at || p.purged_at) return null;
    const s = await this.storage.createSignedDownload(this.storage.proofsBucket, p.storage_path);
    return { url: s.url, expiresAt: s.expiresAt.toISOString(), retentionUntil: p.retention_until.toISOString() };
  }
}
