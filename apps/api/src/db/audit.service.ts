import { Injectable } from '@nestjs/common';
import type { AuditAction } from '@payrecord/contracts';
import { DbService, type Queryable } from './db.service';

export interface AuditEntry {
  organizationId: string;
  actorUserId?: string | null;
  actorDeviceId?: string | null;
  action: AuditAction;
  subjectType: string;
  subjectId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
}

@Injectable()
export class AuditService {
  constructor(private readonly db: DbService) {}

  /** Write inside the caller's transaction when `q` is provided. */
  async record(entry: AuditEntry, q?: Queryable): Promise<void> {
    const runner = q ?? this.db.pool;
    await runner.query(
      `insert into audit_events (organization_id, actor_user_id, actor_device_id, action, subject_type, subject_id, before_ref, after_ref, reason)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        entry.organizationId,
        entry.actorUserId ?? null,
        entry.actorDeviceId ?? null,
        entry.action,
        entry.subjectType,
        entry.subjectId ?? null,
        entry.before ? JSON.stringify(entry.before) : null,
        entry.after ? JSON.stringify(entry.after) : null,
        entry.reason ?? null,
      ],
    );
  }
}
