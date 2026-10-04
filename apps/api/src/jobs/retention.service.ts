import { Injectable } from '@nestjs/common';
import { loadEnv } from '../config/env';
import { DbService } from '../db/db.service';
import { StorageService } from '../db/storage.service';
import { UPLOAD_PURGE_GRACE_SECONDS } from '../records/upload-capability';

const BATCH = 100;
export type RetentionProgress = { more: boolean; runAfterSeconds: number };

/** One bounded, idempotent batch. Progress is persisted per object before a
 * continuation is scheduled, so timeouts cannot restart an unbounded sweep. */
@Injectable()
export class RetentionService {
  private readonly env = loadEnv();
  constructor(private readonly db: DbService, private readonly storage: StorageService) {}

  async run(orgId: string | null, hardDelete: boolean): Promise<RetentionProgress> {
    if (hardDelete && !orgId) throw new Error('RETENTION_SCOPE_REQUIRED');
    if (hardDelete) {
      const org = await this.db.one(`select 1 from organizations where id=$1 and deleted_at is not null`, [orgId]);
      if (!org) return { more: false, runAfterSeconds: 1 };
    }
    let more = false;
    const events = await this.db.query(`with expired as (
      select e.id from notification_events e where e.purged_at is null and e.purge_after<now()
        and e.saved_as_record_id is null and ($1::uuid is null or e.organization_id=$1)
        and not exists (select 1 from payment_matches pm where pm.event_id=e.id and pm.active)
      order by e.purge_after limit $2
    ) update notification_events e set purged_at=now(),payer_masked_name=null,payer_masked_phone=null,reference_value=null
      from expired where e.id=expired.id`, [orgId, BATCH]);
    more ||= events.rowCount === BATCH;

    const proofCount = await this.db.tx(async (tx) => {
      // Serialize cleanup with issuance. SKIP LOCKED keeps each batch bounded;
      // skipped or future rows retain their manifest and schedule another pass.
      const proofs = await tx.query<{ id: string; storage_path: string | null }>(
      `select id,storage_path from payment_proofs
        where (purged_at is null or purged_at<upload_authorized_until+make_interval(secs=>$4))
        and ($1::uuid is null or organization_id=$1) and ($2::boolean or retention_until<now())
        and coalesce(upload_authorized_until,'epoch'::timestamptz)+make_interval(secs=>$4)<=now()
        order by retention_until limit $3 for update skip locked`, [orgId, hardDelete, BATCH,UPLOAD_PURGE_GRACE_SECONDS]);
      if (proofs.rowCount) {
        await this.storage.remove(this.storage.proofsBucket, proofs.rows.flatMap((p) => p.storage_path ? [p.storage_path] : []));
        await tx.query(`update payment_proofs set purged_at=now() where id=any($1::uuid[])`, [proofs.rows.map((p) => p.id)]);
      }
      return proofs.rowCount;
    });
    more ||= proofCount === BATCH;
    const deferred = await this.db.query<{ seconds: number | null }>(`select ceil(extract(epoch from min(greatest(
        coalesce(upload_authorized_until,'epoch'::timestamptz)+make_interval(secs=>$3),now()+interval '60 seconds'))-now()))::int as seconds
      from payment_proofs where (purged_at is null or purged_at<upload_authorized_until+make_interval(secs=>$3))
        and ($1::uuid is null or organization_id=$1) and ($2::boolean or retention_until<now())`, [orgId,hardDelete,UPLOAD_PURGE_GRACE_SECONDS]);
    const delaySeconds = deferred.rows[0]?.seconds ?? 0;

    const exports = await this.db.query<{ id: string; storage_path: string | null }>(
      `select id,storage_path from export_jobs where storage_path is not null
        and ($1::uuid is null or organization_id=$1) and ($2::boolean or expires_at<now())
        order by created_at limit $3`, [orgId, hardDelete, BATCH]);
    if (exports.rowCount) {
      await this.storage.remove(this.storage.exportsBucket, exports.rows.flatMap((p) => p.storage_path ? [p.storage_path] : []));
      await this.db.query(`update export_jobs set status='EXPIRED',storage_path=null where id=any($1::uuid[])`, [exports.rows.map((p) => p.id)]);
    }
    more ||= exports.rowCount === BATCH;

    if (hardDelete && !more && !delaySeconds) {
      // Storage must be gone before the organization cascade removes its manifest.
      await this.db.query(`delete from organizations where id=$1 and deleted_at is not null
        and not exists (select 1 from payment_proofs where organization_id=$1
          and (purged_at is null or purged_at<upload_authorized_until+make_interval(secs=>$2)))
        and not exists (select 1 from export_jobs where organization_id=$1 and storage_path is not null)`, [orgId,UPLOAD_PURGE_GRACE_SECONDS]);
    }
    if (!orgId) {
      // Existing operational replay/job retention only; no beta usage ledger.
      const pairing = await this.db.query(`delete from pairing_attempts where id in (select id from pairing_attempts where attempted_at<now()-interval '1 day' limit 100)`);
      const batches = await this.db.query(`delete from ingest_batches where id in (select id from ingest_batches where created_at<now()-interval '30 days' limit 100)`);
      const jobs = await this.db.query(`delete from jobs where id in (select id from jobs where status='DONE' and finished_at<now()-interval '14 days' limit 100)`);
      more ||= [pairing,batches,jobs].some((result) => result.rowCount === BATCH);
      // A count report is deliberately the only structured-record action.
      // It records no payer data and cannot remove a historical ledger.
      await this.db.query(`insert into maintenance_reports (name,details) values ('record-retention',
        jsonb_build_object('mode','DRY_RUN','policyMonths',$1::int,'eligibleRecords',
          (select count(*) from payment_records where created_at<now()-make_interval(months=>$1)),
          'activationBlocked',true)) on conflict(name) do update set checked_at=now(),details=excluded.details`, [this.env.RETENTION_RECORDS_MONTHS]);
    }
    return { more: more || delaySeconds > 0, runAfterSeconds: more ? 1 : Math.max(1,delaySeconds) };
  }
}
