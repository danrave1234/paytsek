import { Body, Controller, Delete, Get, Injectable, Module, Param, Post, Query } from '@nestjs/common';
import { AnalyticsRange, CreateExportRequest, type AnalyticsSummary, type ExportJobView, type HomeSummary } from '@paytsek/contracts';
import { z } from 'zod';
import { CurrentUser, UserRoute, Workspace, WorkspaceRoute } from '../auth/decorators';
import { OwnerOnly, type AuthUser, type WorkspaceContext } from '../auth/guards';
import { ApiException } from '../common/errors';
import { zod } from '../common/zod.pipe';
import { AuditService } from '../db/audit.service';
import { DbService } from '../db/db.service';
import { StorageService } from '../db/storage.service';
import { JobsService } from '../jobs/jobs.service';
import { RECORD_SELECT, toSummary, type RecordRow } from '../records/records.rows';

@Injectable()
export class OperationsService {
  constructor(
    private readonly db: DbService,
    private readonly storage: StorageService,
    private readonly jobs: JobsService,
    private readonly audit: AuditService,
  ) {}

  /** Recorded-payment totals for "today" in the workspace timezone. Not wallet balance. */
  async home(orgId: string): Promise<HomeSummary> {
    const t = await this.db.one<{
      recorded_n: number; recorded_c: string; matched_n: number; matched_c: string; manual_n: number; manual_c: string; unverified_n: number; unverified_c: string; review_n: number;
    }>(
      `with day as (
         select
           (date_trunc('day', now() at time zone o.timezone) at time zone o.timezone) as start,
           o.timezone
         from organizations o where o.id = $1
       ), scoped as (
         select r.*
         from payment_records r, day
         where r.organization_id = $1
           and coalesce(r.receipt_transaction_at, r.captured_at, r.created_at) >= day.start
           and coalesce(r.receipt_transaction_at, r.captured_at, r.created_at) < day.start + interval '1 day'
       )
       select
         count(*) filter (where evidence_state <> 'VOIDED')::int as recorded_n,
         coalesce(sum(amount_centavos) filter (where evidence_state <> 'VOIDED'),0)::text as recorded_c,
         count(*) filter (where evidence_state in ('MATCHED_AUTO','MATCHED_BY_USER'))::int as matched_n,
         coalesce(sum(amount_centavos) filter (where evidence_state in ('MATCHED_AUTO','MATCHED_BY_USER')),0)::text as matched_c,
         count(*) filter (where evidence_state = 'CONFIRMED_MANUALLY')::int as manual_n,
         coalesce(sum(amount_centavos) filter (where evidence_state = 'CONFIRMED_MANUALLY'),0)::text as manual_c,
         count(*) filter (where evidence_state = 'UNVERIFIED')::int as unverified_n,
         coalesce(sum(amount_centavos) filter (where evidence_state = 'UNVERIFIED'),0)::text as unverified_c,
         count(*) filter (where evidence_state = 'REVIEW_REQUIRED')::int as review_n
       from scoped`,
      [orgId],
    );
    const hourly = await this.db.query<{ hour: number | string; amount_c: string }>(
      `with day as (
         select
           (date_trunc('day', now() at time zone o.timezone) at time zone o.timezone) as start,
           o.timezone
         from organizations o where o.id = $1
       )
       select
         extract(hour from coalesce(r.receipt_transaction_at, r.captured_at, r.created_at) at time zone day.timezone)::int as hour,
         coalesce(sum(r.amount_centavos), 0)::text as amount_c
       from payment_records r, day
       where r.organization_id = $1
         and r.evidence_state <> 'VOIDED'
         and coalesce(r.receipt_transaction_at, r.captured_at, r.created_at) >= day.start
         and coalesce(r.receipt_transaction_at, r.captured_at, r.created_at) < day.start + interval '1 day'
       group by 1
       order by 1`,
      [orgId],
    );
    const hourlyRecordedCentavos = Array.from({ length: 24 }, () => 0);
    for (const bucket of hourly.rows) {
      const hour = Number(bucket.hour);
      if (Number.isInteger(hour) && hour >= 0 && hour < 24) hourlyRecordedCentavos[hour] = Number(bucket.amount_c);
    }
    const collectors = await this.db.query<{ id: string; label: string; source_label: string; last: Date | null; pending: number | null; access: boolean | null }>(
      `select d.id, d.label, string_agg(distinct s.label, ', ' order by s.label) as source_label,
              d.last_server_contact_at as last, d.pending_upload_count as pending, d.notification_access_granted as access
         from device_bindings b join devices d on d.id = b.device_id join payment_sources s on s.id = b.source_id
        where b.organization_id = $1 and b.status = 'ACTIVE' and d.status <> 'REVOKED' and s.collection_paused = false
        group by d.id`,
      [orgId],
    );
    const recent = await this.db.query<RecordRow>(
      `${RECORD_SELECT} where r.organization_id = $1 order by r.created_at desc limit 6`,
      [orgId],
    );
    return {
      today: {
        recordedCount: t?.recorded_n ?? 0,
        recordedCentavos: Number(t?.recorded_c ?? 0),
        notificationMatchedCount: t?.matched_n ?? 0,
        notificationMatchedCentavos: Number(t?.matched_c ?? 0),
        confirmedManuallyCount: t?.manual_n ?? 0,
        confirmedManuallyCentavos: Number(t?.manual_c ?? 0),
        unverifiedCount: t?.unverified_n ?? 0,
        unverifiedCentavos: Number(t?.unverified_c ?? 0),
        reviewRequiredCount: t?.review_n ?? 0,
        hourlyRecordedCentavos,
      },
      collectors: collectors.rows.map((c) => ({
        deviceId: c.id, label: c.label, sourceLabel: c.source_label, lastSeenAt: c.last?.toISOString() ?? null,
        stale: !c.last || Date.now() - c.last.getTime() > 10 * 60 * 1000, pendingUploadCount: c.pending, notificationAccessGranted: c.access,
      })),
      recentRecords: recent.rows.map(toSummary),
    };
  }

  /** Aggregates only facts present in the ledger: date, provider, amount and evidence. */
  async analytics(orgId: string, range: AnalyticsRange): Promise<AnalyticsSummary> {
    const days = range === '90D' ? 90 : range === '30D' ? 30 : 7;
    const bounds = await this.db.one<{ timezone: string; from_date: string; to_date: string }>(
      `select o.timezone,
              to_char((now() at time zone o.timezone)::date - ($2::int - 1), 'YYYY-MM-DD') as from_date,
              to_char((now() at time zone o.timezone)::date, 'YYYY-MM-DD') as to_date
         from organizations o where o.id = $1`,
      [orgId, days],
    );
    if (!bounds) throw new ApiException('NOT_FOUND', 'Workspace not found');

    const scope = `with context as (
      select o.timezone,
             ((date_trunc('day', now() at time zone o.timezone) - ($2::int - 1) * interval '1 day') at time zone o.timezone) as start_at,
             ((date_trunc('day', now() at time zone o.timezone) + interval '1 day') at time zone o.timezone) as end_at
        from organizations o where o.id = $1
    ), scoped as (
      select r.*, coalesce(r.receipt_provider, s.provider) as provider, context.timezone
        from payment_records r
        left join payment_sources s on s.id = r.source_id
        cross join context
       where r.organization_id = $1
         and r.evidence_state <> 'VOIDED'
         and coalesce(r.receipt_transaction_at, r.captured_at, r.created_at) >= context.start_at
         and coalesce(r.receipt_transaction_at, r.captured_at, r.created_at) < context.end_at
    )`;

    const [totals, daily, providers, evidence] = await Promise.all([
      this.db.one<{ recorded_n: number; recorded_c: string }>(
        `${scope} select count(*)::int as recorded_n, coalesce(sum(amount_centavos), 0)::text as recorded_c from scoped`,
        [orgId, days],
      ),
      this.db.query<{ day: string; recorded_n: number; recorded_c: string }>(
        `${scope}, dates as (
           select generate_series(($3::date), ($4::date), interval '1 day')::date as day
         )
         select to_char(dates.day, 'YYYY-MM-DD') as day,
                count(scoped.id)::int as recorded_n,
                coalesce(sum(scoped.amount_centavos), 0)::text as recorded_c
           from dates
           left join scoped on (coalesce(scoped.receipt_transaction_at, scoped.captured_at, scoped.created_at) at time zone scoped.timezone)::date = dates.day
          group by dates.day order by dates.day`,
        [orgId, days, bounds.from_date, bounds.to_date],
      ),
      this.db.query<{ provider: AnalyticsSummary['byProvider'][number]['provider']; recorded_n: number; recorded_c: string }>(
        `${scope} select provider, count(*)::int as recorded_n, sum(amount_centavos)::text as recorded_c
                    from scoped where provider is not null group by provider order by sum(amount_centavos) desc`,
        [orgId, days],
      ),
      this.db.query<{ state: AnalyticsSummary['byEvidence'][number]['state']; recorded_n: number; recorded_c: string }>(
        `${scope} select evidence_state as state, count(*)::int as recorded_n, sum(amount_centavos)::text as recorded_c
                    from scoped group by evidence_state order by sum(amount_centavos) desc`,
        [orgId, days],
      ),
    ]);

    return {
      range,
      timezone: bounds.timezone,
      from: bounds.from_date,
      to: bounds.to_date,
      recordedCount: totals?.recorded_n ?? 0,
      recordedCentavos: Number(totals?.recorded_c ?? 0),
      daily: daily.rows.map((row) => ({ date: row.day, recordedCount: row.recorded_n, recordedCentavos: Number(row.recorded_c) })),
      byProvider: providers.rows.map((row) => ({ provider: row.provider, recordedCount: row.recorded_n, recordedCentavos: Number(row.recorded_c) })),
      byEvidence: evidence.rows.map((row) => ({ state: row.state, recordedCount: row.recorded_n, recordedCentavos: Number(row.recorded_c) })),
    };
  }

  // ---- Exports ------------------------------------------------------------------
  async createExport(orgId: string, userId: string, input: CreateExportRequest): Promise<ExportJobView> {
    const r = await this.db.tx(async (c) => {
      const ins = await c.query<{ id: string; created_at: Date }>(
        `insert into export_jobs (organization_id, requested_by, format, params) values ($1,$2,$3,$4) returning id, created_at`,
        [orgId, userId, input.format, JSON.stringify(input)],
      );
      await this.jobs.enqueue('GENERATE_EXPORT', { exportJobId: ins.rows[0]!.id }, `export:${ins.rows[0]!.id}`, c);
      await this.audit.record({ organizationId: orgId, actorUserId: userId, action: 'EXPORT_CREATED', subjectType: 'export_job', subjectId: ins.rows[0]!.id, after: { format: input.format, from: input.from, to: input.to } }, c);
      return ins.rows[0]!;
    });
    return { id: r.id, status: 'PENDING', format: input.format, createdAt: r.created_at.toISOString(), downloadUrl: null, expiresAt: null, rowCount: null, errorCode: null };
  }

  async exportStatus(orgId: string, id: string): Promise<ExportJobView> {
    const e = await this.db.one<{ id: string; status: ExportJobView['status']; format: ExportJobView['format']; created_at: Date; storage_path: string | null; row_count: number | null; error_code: string | null; expires_at: Date | null }>(
      `select id, status, format, created_at, storage_path, row_count, error_code, expires_at from export_jobs where id = $1 and organization_id = $2`,
      [id, orgId],
    );
    if (!e) throw new ApiException('NOT_FOUND', 'Export not found');
    let url: string | null = null;
    if (e.status === 'READY' && e.storage_path) {
      if (e.expires_at && e.expires_at.getTime() < Date.now()) throw new ApiException('EXPORT_EXPIRED', 'Export expired and was deleted');
      url = (await this.storage.createSignedDownload(this.storage.exportsBucket, e.storage_path)).url;
    }
    return { id: e.id, status: e.status, format: e.format, createdAt: e.created_at.toISOString(), downloadUrl: url, expiresAt: e.expires_at?.toISOString() ?? null, rowCount: e.row_count, errorCode: e.error_code };
  }

  // ---- Privacy --------------------------------------------------------------------
  /** Personal-data export for the calling user (profile, memberships, records they created — metadata only). */
  async privacyExport(userId: string): Promise<Record<string, unknown>> {
    const profile = await this.db.one(`select user_id, display_name, created_at from profiles where user_id = $1`, [userId]);
    const memberships = await this.db.query(`select organization_id, role, created_at from memberships where user_id = $1`, [userId]);
    const records = await this.db.query(`select id, organization_id, amount_centavos, evidence_state, created_at from payment_records where created_by = $1 order by created_at desc limit 5000`, [userId]);
    return { generatedAt: new Date().toISOString(), profile, memberships: memberships.rows, recordsCreated: records.rows };
  }

  /**
   * Delete a user account. Sole owners must transfer ownership or delete the
   * workspace first. Business-owned records are retained (created_by keeps the id;
   * profile row is removed so no display name remains).
   */
  async deleteAccount(userId: string): Promise<void> {
    const sole = await this.db.query<{ organization_id: string }>(
      `select m.organization_id from memberships m where m.user_id = $1 and m.role = 'OWNER'
         and not exists (select 1 from memberships o where o.organization_id = m.organization_id and o.role = 'OWNER' and o.user_id <> $1)
         and not exists (select 1 from organizations x where x.id = m.organization_id and x.deleted_at is not null)`,
      [userId],
    );
    if (sole.rowCount) throw new ApiException('CONFLICT', 'You are the sole owner of a workspace. Transfer ownership or delete the workspace first.', { workspaces: sole.rows.map((r) => r.organization_id) });
    await this.db.tx(async (c) => {
      await c.query(`delete from memberships where user_id = $1`, [userId]);
      await c.query(`delete from profiles where user_id = $1`, [userId]);
      // Supabase Auth user deletion is performed via the admin API by the caller of this service (see privacy controller).
    });
  }

  /** Owner deletes the workspace: soft-delete immediately, purge assets via retention job. */
  async deleteWorkspace(orgId: string, ownerId: string): Promise<void> {
    await this.db.tx(async (c) => {
      await c.query(`update organizations set deleted_at = now() where id = $1`, [orgId]);
      await c.query(`update devices set status = 'REVOKED', revoked_at = now(), credential_hash = null, revoked_reason = 'workspace deleted' where organization_id = $1`, [orgId]);
      await c.query(`update device_bindings set status = 'REVOKED', revoked_at = now() where organization_id = $1 and status = 'ACTIVE'`, [orgId]);
      await this.audit.record({ organizationId: orgId, actorUserId: ownerId, action: 'WORKSPACE_DELETED', subjectType: 'organization', subjectId: orgId }, c);
      await this.jobs.enqueue('PURGE_RETENTION', { orgId, hardDelete: true }, `purge-org:${orgId}`, c);
    });
  }
}

const DeleteBody = z.object({ confirm: z.literal('DELETE') });
const AnalyticsQuery = z.object({ range: AnalyticsRange.default('7D') });

@Controller('v1')
export class OperationsController {
  constructor(private readonly svc: OperationsService) {}

  @Get('health')
  health() {
    return { ok: true, service: 'paytsek-api', time: new Date().toISOString() };
  }

  @Get('home')
  @WorkspaceRoute()
  home(@Workspace() ws: WorkspaceContext) {
    return this.svc.home(ws.organizationId);
  }

  @Get('analytics')
  @WorkspaceRoute()
  analytics(@Workspace() ws: WorkspaceContext, @Query(zod(AnalyticsQuery)) query: { range: AnalyticsRange }) {
    return this.svc.analytics(ws.organizationId, query.range);
  }

  @Post('exports')
  @WorkspaceRoute()
  createExport(@Workspace() ws: WorkspaceContext, @CurrentUser() u: AuthUser, @Body(zod(CreateExportRequest)) body: CreateExportRequest) {
    return this.svc.createExport(ws.organizationId, u.id, body);
  }

  @Get('exports/:id')
  @WorkspaceRoute()
  exportStatus(@Workspace() ws: WorkspaceContext, @Param('id') id: string) {
    return this.svc.exportStatus(ws.organizationId, id);
  }

  @Get('me/privacy-export')
  @UserRoute()
  privacyExport(@CurrentUser() u: AuthUser) {
    return this.svc.privacyExport(u.id);
  }

  @Delete('me')
  @UserRoute()
  async deleteAccount(@CurrentUser() u: AuthUser, @Body(zod(DeleteBody)) _b: { confirm: 'DELETE' }) {
    await this.svc.deleteAccount(u.id);
    return { ok: true, next: 'Auth user removal is completed by the account-deletion job using the Supabase admin API.' };
  }

  @Delete('workspaces/current')
  @WorkspaceRoute()
  @OwnerOnly()
  async deleteWorkspace(@Workspace() ws: WorkspaceContext, @CurrentUser() u: AuthUser, @Body(zod(DeleteBody)) _b: { confirm: 'DELETE' }) {
    await this.svc.deleteWorkspace(ws.organizationId, u.id);
    return { ok: true };
  }
}

@Module({ controllers: [OperationsController], providers: [OperationsService], exports: [OperationsService] })
export class OperationsModule {}
