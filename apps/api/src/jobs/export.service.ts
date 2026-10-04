import { Injectable } from '@nestjs/common';
import { EVIDENCE_STATE_LABELS, type EvidenceState } from '@paytsek/contracts';
import { loadEnv } from '../config/env';
import { DbService } from '../db/db.service';
import { StorageService } from '../db/storage.service';
import { EFFECTIVE_AT_SQL, PROVIDER_LABEL_SQL } from '../records/records.rows';

export const MAX_EXPORT_ROWS = 10_000;
export const MAX_EXPORT_BYTES = 10 * 1024 * 1024;
export function csvEscape(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

@Injectable()
export class ExportService {
  private readonly env = loadEnv();
  constructor(private readonly db: DbService, private readonly storage: StorageService) {}

  async generate(id: string): Promise<void> {
    const job = await this.db.one<{ organization_id: string; format: string; params: { from: string; to: string; sourceId?: string; includeVoided: boolean }; status: string }>(
      `select organization_id,format,params,status from export_jobs where id=$1`, [id]);
    if (!job || ['READY','EXPIRED'].includes(job.status)) return;
    await this.db.query(`update export_jobs set status='RUNNING',format='CSV' where id=$1`, [id]);
    let errorCode = 'EXPORT_GENERATION_FAILED';
    try {
      // Bound both row count and serialized bytes. These are safe per-request
      // processing limits, not beta record quotas. A smaller range can be exported.
      const rows = await this.db.query<{ id: string; transaction_at: Date; provider: string; amount_centavos: string; evidence_state: EvidenceState }>(
        `select r.id,${EFFECTIVE_AT_SQL} as transaction_at,${PROVIDER_LABEL_SQL} as provider,r.amount_centavos,r.evidence_state
         from payment_records r left join payment_sources s on s.id=r.source_id
         where r.organization_id=$1 and ${EFFECTIVE_AT_SQL}>=$2 and ${EFFECTIVE_AT_SQL}<$3
           and ($4::uuid is null or r.source_id=$4) and ($5::boolean or r.evidence_state<>'VOIDED')
         order by ${EFFECTIVE_AT_SQL},r.id limit $6`, [job.organization_id, job.params.from, job.params.to, job.params.sourceId ?? null, job.params.includeVoided, MAX_EXPORT_ROWS + 1]);
      if (rows.rows.length > MAX_EXPORT_ROWS) {
        errorCode = 'EXPORT_RANGE_TOO_LARGE';
        throw new Error(errorCode);
      }
      const header = '# PayTsek recorded payments; evidence status is not bank confirmation or wallet balance. Times are UTC.\nrecord_id,transaction_at_utc,proof_provider,amount_php,amount_centavos,evidence_state,evidence_label\n';
      const chunks = [header];
      let size = Buffer.byteLength(header);
      for (const row of rows.rows) {
        const line = [row.id,row.transaction_at.toISOString(),row.provider,(Number(row.amount_centavos)/100).toFixed(2),row.amount_centavos,row.evidence_state,EVIDENCE_STATE_LABELS[row.evidence_state]].map(csvEscape).join(',') + '\n';
        size += Buffer.byteLength(line);
        if (size > MAX_EXPORT_BYTES) { errorCode = 'EXPORT_RANGE_TOO_LARGE'; throw new Error(errorCode); }
        chunks.push(line);
      }
      const path = `${job.organization_id}/${id}.csv`;
      // Persist the object manifest before upload so workspace deletion/retention
      // can clean up a file even if the worker dies after the storage write.
      await this.db.query(`update export_jobs set storage_path=$2,expires_at=now()+make_interval(hours=>$3) where id=$1`, [id,path,this.env.RETENTION_EXPORT_HOURS]);
      await this.db.tx(async (tx) => {
        // Workspace soft-deletion takes an incompatible organization row lock.
        // Hold the live-workspace lock until upload publication finishes so its
        // later cleanup cannot remove the manifest before these bytes arrive.
        const live = await tx.query(`select id from organizations where id=$1 and deleted_at is null for share`, [job.organization_id]);
        if (!live.rowCount) return;
        await this.storage.upload(this.storage.exportsBucket,path,chunks.join(''),'text/csv');
        await tx.query(`update export_jobs set status='READY',row_count=$2,error_code=null,finished_at=now() where id=$1`, [id,rows.rows.length]);
      });
    } catch {
      await this.db.query(`update export_jobs set status='FAILED',error_code=$2,finished_at=now() where id=$1`, [id,errorCode]);
      if (errorCode !== 'EXPORT_RANGE_TOO_LARGE') throw new Error(errorCode);
    }
  }
}
