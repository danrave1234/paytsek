import { Body, Controller, Delete, Get, Injectable, Module, Param, Patch, Post } from '@nestjs/common';
import { CreateSourceRequest, UpdateSourceRequest, type Provider, type SourceSummary } from '@paytsek/contracts';
import { autoMatchFlowsForReceivingProvider } from '@paytsek/receipt-parsers';
import { CurrentUser, Workspace, WorkspaceRoute } from '../auth/decorators';
import { OwnerOnly, type AuthUser, type WorkspaceContext } from '../auth/guards';
import { ApiException } from '../common/errors';
import { zod } from '../common/zod.pipe';
import { AuditService } from '../db/audit.service';
import { DbService, isUniqueViolation } from '../db/db.service';

interface SourceRow {
  id: string;
  provider: Provider;
  label: string;
  masked_display: string;
  recipient_aliases: string[];
  is_default: boolean;
  collection_paused: boolean;
  require_owner_approval_for_staff_matches: boolean;
  collector_device_id: string | null;
  collector_last_seen: Date | null;
  created_at: Date;
}

const SELECT = `
  select s.id, s.provider, s.label, s.masked_display, s.recipient_aliases, s.is_default, s.collection_paused,
         s.require_owner_approval_for_staff_matches, s.created_at,
         b.device_id as collector_device_id, d.last_server_contact_at as collector_last_seen
    from payment_sources s
    left join device_bindings b on b.source_id = s.id and b.status = 'ACTIVE'
    left join devices d on d.id = b.device_id`;

function toSummary(r: SourceRow): SourceSummary {
  return {
    id: r.id,
    provider: r.provider,
    label: r.label,
    maskedDisplay: r.masked_display,
    recipientAliases: r.recipient_aliases,
    isDefault: r.is_default,
    collectionPaused: r.collection_paused,
    requireOwnerApprovalForStaffMatches: r.require_owner_approval_for_staff_matches,
    autoMatchFlows: autoMatchFlowsForReceivingProvider(r.provider),
    activeCollectorDeviceId: r.collector_device_id,
    collectorLastSeenAt: r.collector_last_seen?.toISOString() ?? null,
    createdAt: r.created_at.toISOString(),
  };
}

@Injectable()
export class SourcesService {
  constructor(
    private readonly db: DbService,
    private readonly audit: AuditService,
  ) {}

  async list(orgId: string): Promise<SourceSummary[]> {
    const r = await this.db.query<SourceRow>(`${SELECT} where s.organization_id = $1 and s.deleted_at is null order by s.created_at`, [orgId]);
    return r.rows.map(toSummary);
  }

  async get(orgId: string, id: string): Promise<SourceSummary> {
    const r = await this.db.one<SourceRow>(`${SELECT} where s.organization_id = $1 and s.id = $2 and s.deleted_at is null`, [orgId, id]);
    if (!r) throw new ApiException('NOT_FOUND', 'Source not found');
    return toSummary(r);
  }

  async create(orgId: string, actorId: string, input: CreateSourceRequest): Promise<SourceSummary> {
    return this.db.tx(async (c) => {
      const lim = await c.query<{ receiving_sources: number; n: number }>(
        `select p.receiving_sources, (select count(*) from payment_sources where organization_id = $1 and deleted_at is null)::int as n
           from organizations o join plans p on p.code = o.plan_code where o.id = $1 for update of o`,
        [orgId],
      );
      const l = lim.rows[0]!;
      if (l.n >= l.receiving_sources) throw new ApiException('PLAN_LIMIT_SOURCES', `Your plan allows ${l.receiving_sources} receiving source(s)`, { limit: l.receiving_sources });
      const makeDefault = input.isDefault || l.n === 0;
      if (makeDefault) await c.query(`update payment_sources set is_default = false where organization_id = $1`, [orgId]);
      const ins = await c.query<{ id: string }>(
        `insert into payment_sources (organization_id, provider, label, declared_identifier, masked_display, recipient_aliases, is_default)
         values ($1,$2,$3,$4,$5,$6,$7) returning id`,
        [orgId, input.provider, input.label, input.declaredIdentifier, input.maskedDisplay, input.recipientAliases, makeDefault],
      );
      const id = ins.rows[0]!.id;
      await this.audit.record({ organizationId: orgId, actorUserId: actorId, action: 'SOURCE_CREATED', subjectType: 'payment_source', subjectId: id, after: { provider: input.provider, label: input.label } }, c);
      const row = await c.query<SourceRow>(`${SELECT} where s.id = $1`, [id]);
      return toSummary(row.rows[0]!);
    });
  }

  async update(orgId: string, actorId: string, id: string, input: UpdateSourceRequest): Promise<SourceSummary> {
    return this.db.tx(async (c) => {
      const before = await c.query<SourceRow & { declared_identifier: string }>(`select * from payment_sources where organization_id = $1 and id = $2 and deleted_at is null for update`, [orgId, id]);
      const b = before.rows[0];
      if (!b) throw new ApiException('NOT_FOUND', 'Source not found');
      if (input.isDefault) await c.query(`update payment_sources set is_default = false where organization_id = $1 and id <> $2`, [orgId, id]);
      const identifierChanged = input.declaredIdentifier !== undefined && input.declaredIdentifier !== b.declared_identifier;
      await c.query(
        `update payment_sources set
           label = coalesce($3, label), declared_identifier = coalesce($4, declared_identifier), masked_display = coalesce($5, masked_display),
           recipient_aliases = coalesce($6, recipient_aliases), is_default = coalesce($7, is_default),
           collection_paused = coalesce($8, collection_paused), require_owner_approval_for_staff_matches = coalesce($9, require_owner_approval_for_staff_matches)
         where organization_id = $1 and id = $2`,
        [orgId, id, input.label ?? null, input.declaredIdentifier ?? null, input.maskedDisplay ?? null, input.recipientAliases ?? null, input.isDefault ?? null, input.collectionPaused ?? null, input.requireOwnerApprovalForStaffMatches ?? null],
      );
      // Changing the receiving wallet account requires re-pairing: revoke the active binding.
      if (identifierChanged) {
        await c.query(`update device_bindings set status = 'REVOKED', revoked_at = now() where source_id = $1 and status = 'ACTIVE'`, [id]);
      }
      await this.audit.record({ organizationId: orgId, actorUserId: actorId, action: 'SOURCE_UPDATED', subjectType: 'payment_source', subjectId: id, after: { ...input, declaredIdentifier: input.declaredIdentifier ? '[changed]' : undefined, rebindRequired: identifierChanged } }, c);
      const row = await c.query<SourceRow>(`${SELECT} where s.id = $1`, [id]);
      return toSummary(row.rows[0]!);
    }).catch((e) => {
      if (isUniqueViolation(e)) throw new ApiException('CONFLICT', 'Only one default source is allowed');
      throw e;
    });
  }

  async remove(orgId: string, actorId: string, id: string): Promise<void> {
    await this.db.tx(async (c) => {
      const used = await c.query<{ n: number }>(`select count(*)::int as n from payment_records where source_id = $1`, [id]);
      // Soft-delete keeps historical records valid; bindings are revoked.
      await c.query(`update payment_sources set deleted_at = now(), is_default = false where organization_id = $1 and id = $2`, [orgId, id]);
      await c.query(`update device_bindings set status = 'REVOKED', revoked_at = now() where source_id = $1 and status = 'ACTIVE'`, [id]);
      await this.audit.record({ organizationId: orgId, actorUserId: actorId, action: 'SOURCE_UPDATED', subjectType: 'payment_source', subjectId: id, after: { deleted: true, recordsRetained: used.rows[0]?.n ?? 0 } }, c);
    });
  }
}

@Controller('v1/sources')
@WorkspaceRoute()
export class SourcesController {
  constructor(private readonly svc: SourcesService) {}

  @Get()
  list(@Workspace() ws: WorkspaceContext) {
    return this.svc.list(ws.organizationId);
  }

  @Get(':id')
  get(@Workspace() ws: WorkspaceContext, @Param('id') id: string) {
    return this.svc.get(ws.organizationId, id);
  }

  @Post()
  @OwnerOnly()
  create(@Workspace() ws: WorkspaceContext, @CurrentUser() u: AuthUser, @Body(zod(CreateSourceRequest)) body: CreateSourceRequest) {
    return this.svc.create(ws.organizationId, u.id, body);
  }

  @Patch(':id')
  @OwnerOnly()
  update(@Workspace() ws: WorkspaceContext, @CurrentUser() u: AuthUser, @Param('id') id: string, @Body(zod(UpdateSourceRequest)) body: UpdateSourceRequest) {
    return this.svc.update(ws.organizationId, u.id, id, body);
  }

  @Delete(':id')
  @OwnerOnly()
  async remove(@Workspace() ws: WorkspaceContext, @CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.svc.remove(ws.organizationId, u.id, id);
    return { ok: true };
  }
}

@Module({ controllers: [SourcesController], providers: [SourcesService], exports: [SourcesService] })
export class SourcesModule {}
