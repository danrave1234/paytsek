import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { AccountDeletionResult } from '@paytsek/contracts';
import { ApiException } from '../common/errors';
import { DbService } from '../db/db.service';
import { StorageService } from '../db/storage.service';
import { JobsService } from '../jobs/jobs.service';

export const accountSubjectHash = (id: string) => createHash('sha256').update(id).digest('hex');

@Injectable()
export class AccountDeletionService {
  constructor(private readonly db: DbService, private readonly storage: StorageService, private readonly jobs: JobsService) {}

  async request(userId: string): Promise<AccountDeletionResult> {
    return this.db.tx(async (tx) => {
      await tx.query(`select pg_advisory_xact_lock(hashtextextended($1,901))`, [userId]);
      // Same ordered workspace locks as membership role/removal operations.
      await tx.query(`select o.id from organizations o join memberships m on m.organization_id=o.id
        where m.user_id=$1 order by o.id for update of o`, [userId]);
      const sole = await tx.query(`select m.organization_id from memberships m join organizations o on o.id=m.organization_id
        where m.user_id=$1 and m.role='OWNER' and o.deleted_at is null
          and not exists (select 1 from memberships other where other.organization_id=m.organization_id and other.role='OWNER' and other.user_id<>$1)`, [userId]);
      if (sole.rowCount) throw new ApiException('CONFLICT', 'Transfer ownership or delete your workspace before deleting your account.');
      const result = await tx.query<{ id: string; requested_at: Date }>(`insert into account_deletions (subject_hash,user_id) values ($1,$2)
        on conflict (subject_hash) do update set subject_hash=excluded.subject_hash returning id,requested_at`, [accountSubjectHash(userId), userId]);
      const request = result.rows[0]!;
      await this.jobs.enqueue('DELETE_ACCOUNT', { requestId: request.id }, `delete-account:${request.id}`, tx);
      // Authorization is removed in the same commit as the durable request.
      await tx.query(`update devices set status='REVOKED',credential_hash=null,revoked_at=now(),revoked_reason='account deleted'
        where current_phone_user_id=$1`, [userId]);
      await tx.query(`update device_bindings set status='REVOKED',revoked_at=now()
        where device_id in (select id from devices where current_phone_user_id=$1) and status='ACTIVE'`, [userId]);
      await tx.query(`delete from memberships where user_id=$1`, [userId]);
      await tx.query(`delete from profiles where user_id=$1`, [userId]);
      await tx.query(`delete from invitations where (accepted_at is null and invited_by=$1)
        or lower(email)=(select lower(email) from auth.users where id=$1)`, [userId]);
      // Keep action, time, evidence and tenant history while dropping copied identity fields.
      await tx.query(`update audit_events set
        before_ref=before_ref-array['email','displayName','display_name','userId','user_id'],
        after_ref=after_ref-array['email','displayName','display_name','userId','user_id'],
        subject_id=case when subject_type in ('membership','user','profile') and subject_id=$1 then null else subject_id end
        where actor_user_id=$1 or (subject_type in ('membership','user','profile') and subject_id=$1)
          or lower(before_ref->>'email')=(select lower(email) from auth.users where id=$1)
          or lower(after_ref->>'email')=(select lower(email) from auth.users where id=$1)`, [userId]);
      return { requestId: request.id, status: 'PENDING', requestedAt: request.requested_at.toISOString() };
    });
  }

  async process(requestId: string): Promise<void> {
    const request = await this.db.one<{ user_id: string | null; status: string }>(`select user_id,status from account_deletions where id=$1`, [requestId]);
    if (!request?.user_id || request.status === 'COMPLETE') return;
    await this.db.query(`update account_deletions set status='RETRYING',attempts=attempts+1,last_error_code=null where id=$1`, [requestId]);
    let errorCode = 'ACCOUNT_DELETE_RETRY';
    try {
      // Current service-role uploads have no personal owner. Storage SQL is
      // read-only: never take over or remove legacy objects from other buckets.
      const owned = await this.db.query(`select 1 from storage.objects where owner_id=$1 or owner::text=$1 limit 1`, [request.user_id]);
      if (owned.rowCount) {
        errorCode = 'ACCOUNT_STORAGE_REVIEW_REQUIRED';
        throw new Error(errorCode);
      }
      await this.storage.deleteAuthUser(request.user_id);
      await this.db.query(`update account_deletions set status='COMPLETE',completed_at=now(),user_id=null,last_error_code=null where id=$1`, [requestId]);
    } catch {
      await this.db.query(`update account_deletions set last_error_code=$2 where id=$1 and status<>'COMPLETE'`, [requestId,errorCode]);
      throw new Error(errorCode);
    }
  }
}
