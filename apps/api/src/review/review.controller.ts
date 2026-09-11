import { Body, Controller, Get, Injectable, Module, Param, Post, Query } from '@nestjs/common';
import { ConfirmCandidateRequest, ConfirmManuallyRequest, EscalateRequest, UnlinkRequest, type OwnerInboxEvent } from '@paytsek/contracts';
import { z } from 'zod';
import { CurrentUser, Workspace, WorkspaceRoute } from '../auth/decorators';
import { OwnerOnly, type AuthUser, type WorkspaceContext } from '../auth/guards';
import { ApiException } from '../common/errors';
import { zod } from '../common/zod.pipe';
import { AuditService } from '../db/audit.service';
import { DbService, isUniqueViolation } from '../db/db.service';
import { MATCHER_VERSION } from '../matching/matcher';
import { ReconcileService } from '../matching/reconcile.service';

@Injectable()
export class ReviewService {
  constructor(
    private readonly db: DbService,
    private readonly audit: AuditService,
    private readonly reconcile: ReconcileService,
  ) {}

  candidates(orgId: string, recordId: string) {
    return this.reconcile.candidates(orgId, recordId);
  }

  /**
   * Authorized user selects a candidate. The candidate must come from the
   * record's scoped candidate set (same source, exact amount). Two cashiers
   * racing for one event: the partial unique index yields exactly one winner;
   * the loser receives MATCH_CONFLICT and refreshed review state.
   */
  async confirmCandidate(ws: WorkspaceContext, userId: string, recordId: string, eventId: string, note: string | null | undefined): Promise<void> {
    await this.db.tx(async (c) => {
      const rec = await c.query<{ id: string; source_id: string; amount_centavos: string; evidence_state: string; created_by: string; require_owner_approval: boolean }>(
        `select r.id, r.source_id, r.amount_centavos, r.evidence_state, r.created_by, s.require_owner_approval_for_staff_matches as require_owner_approval
           from payment_records r join payment_sources s on s.id = r.source_id where r.id = $1 and r.organization_id = $2 for update of r`,
        [recordId, ws.organizationId],
      );
      const r = rec.rows[0];
      if (!r) throw new ApiException('RECORD_NOT_FOUND', 'Record not found');
      if (r.evidence_state === 'VOIDED') throw new ApiException('RECORD_VOIDED', 'Voided records cannot be matched');
      if (r.evidence_state !== 'UNVERIFIED' && r.evidence_state !== 'REVIEW_REQUIRED') throw new ApiException('RECORD_ALREADY_LINKED', 'This record already has an association');
      if (ws.role !== 'OWNER') {
        if (!ws.canConfirmMatches) throw new ApiException('CONFIRMATION_REQUIRES_OWNER_APPROVAL', 'The owner has not allowed you to confirm matches');
        if (r.require_owner_approval) throw new ApiException('CONFIRMATION_REQUIRES_OWNER_APPROVAL', 'This source requires owner approval before matching staff records');
        if (r.created_by !== userId) throw new ApiException('FORBIDDEN', 'Cashiers can only confirm matches for their own records');
      }
      const ev = await c.query<{ id: string }>(
        `select id from notification_events where id = $1 and organization_id = $2 and source_id = $3 and amount_centavos = $4 and purged_at is null`,
        [eventId, ws.organizationId, r.source_id, r.amount_centavos],
      );
      if (!ev.rows[0]) throw new ApiException('CANDIDATE_OUT_OF_SCOPE', 'That notification is not a candidate for this record');
      try {
        await c.query(
          `insert into payment_matches (organization_id, record_id, event_id, kind, reason_codes, supporting_fields, matcher_version, created_by)
           values ($1,$2,$3,'USER_SELECTED','{USER_SELECTED_CANDIDATE}','{amount}',$4,$5)`,
          [ws.organizationId, recordId, eventId, MATCHER_VERSION, userId],
        );
      } catch (e) {
        if (isUniqueViolation(e)) throw new ApiException('MATCH_CONFLICT', 'That notification was just claimed by another record. Review refreshed.');
        throw e;
      }
      await c.query(`update payment_records set evidence_state = 'MATCHED_BY_USER' where id = $1`, [recordId]);
      await c.query(`update notification_events set purge_after = null where id = $1`, [eventId]);
      await this.audit.record({ organizationId: ws.organizationId, actorUserId: userId, action: 'MATCH_BY_USER', subjectType: 'payment_record', subjectId: recordId, after: { eventId }, reason: note ?? null }, c);
    });
  }

  /** Owner reports checking the wallet directly. Different audit label from any match. */
  async confirmManually(orgId: string, ownerId: string, recordId: string, note: string | null | undefined): Promise<void> {
    await this.db.tx(async (c) => {
      const r = await c.query<{ evidence_state: string }>(`select evidence_state from payment_records where id = $1 and organization_id = $2 for update`, [recordId, orgId]);
      if (!r.rows[0]) throw new ApiException('RECORD_NOT_FOUND', 'Record not found');
      if (r.rows[0].evidence_state === 'VOIDED') throw new ApiException('RECORD_VOIDED', 'Voided records cannot be confirmed');
      if (r.rows[0].evidence_state !== 'UNVERIFIED' && r.rows[0].evidence_state !== 'REVIEW_REQUIRED') throw new ApiException('RECORD_ALREADY_LINKED', 'This record already has an association');
      await c.query(
        `insert into payment_matches (organization_id, record_id, event_id, kind, reason_codes, matcher_version, created_by)
         values ($1,$2,null,'MANUAL_OWNER_CONFIRMATION','{OWNER_CONFIRMED_IN_WALLET}',$3,$4)`,
        [orgId, recordId, MATCHER_VERSION, ownerId],
      );
      await c.query(`update payment_records set evidence_state = 'CONFIRMED_MANUALLY' where id = $1`, [recordId]);
      await this.audit.record({ organizationId: orgId, actorUserId: ownerId, action: 'MATCH_CONFIRMED_MANUALLY', subjectType: 'payment_record', subjectId: recordId, reason: note ?? null }, c);
    });
  }

  /** Owner-only unlink (optionally reassign in the same transaction). History is preserved. */
  async unlink(orgId: string, ownerId: string, recordId: string, input: UnlinkRequest): Promise<void> {
    await this.db.tx(async (c) => {
      const cur = await c.query<{ id: string; event_id: string | null; kind: string; source_id: string; amount_centavos: string }>(
        `select pm.id, pm.event_id, pm.kind, r.source_id, r.amount_centavos from payment_matches pm join payment_records r on r.id = pm.record_id
          where pm.record_id = $1 and pm.active and r.organization_id = $2 for update of pm`,
        [recordId, orgId],
      );
      const m = cur.rows[0];
      if (!m) throw new ApiException('NOT_FOUND', 'No active association to unlink');
      await c.query(`update payment_matches set active = false, unlinked_at = now(), unlinked_by = $2, unlink_reason = $3 where id = $1`, [m.id, ownerId, input.reason]);
      let next = 'UNVERIFIED';
      if (input.reassignToEventId) {
        const ev = await c.query(`select 1 from notification_events where id = $1 and organization_id = $2 and source_id = $3 and amount_centavos = $4 and purged_at is null`, [input.reassignToEventId, orgId, m.source_id, m.amount_centavos]);
        if (!ev.rowCount) throw new ApiException('CANDIDATE_OUT_OF_SCOPE', 'Replacement notification is not a candidate for this record');
        try {
          await c.query(
            `insert into payment_matches (organization_id, record_id, event_id, kind, reason_codes, matcher_version, created_by) values ($1,$2,$3,'USER_SELECTED','{USER_SELECTED_CANDIDATE,UNLINKED_BY_OWNER}',$4,$5)`,
            [orgId, recordId, input.reassignToEventId, MATCHER_VERSION, ownerId],
          );
        } catch (e) {
          if (isUniqueViolation(e)) throw new ApiException('MATCH_CONFLICT', 'Replacement notification is already linked to another record');
          throw e;
        }
        next = 'MATCHED_BY_USER';
      }
      await c.query(`update payment_records set evidence_state = $2 where id = $1`, [recordId, next]);
      await this.audit.record({ organizationId: orgId, actorUserId: ownerId, action: 'MATCH_UNLINKED', subjectType: 'payment_record', subjectId: recordId, before: { eventId: m.event_id, kind: m.kind }, after: { eventId: input.reassignToEventId ?? null }, reason: input.reason }, c);
      if (next === 'UNVERIFIED') await this.reconcile.scheduleRecord(recordId, c);
    });
  }

  async escalate(orgId: string, userId: string, recordId: string, message: string | null | undefined): Promise<void> {
    const r = await this.db.one<{ id: string }>(`select id from payment_records where id = $1 and organization_id = $2`, [recordId, orgId]);
    if (!r) throw new ApiException('RECORD_NOT_FOUND', 'Record not found');
    await this.db.query(`update payment_records set evidence_state = 'REVIEW_REQUIRED' where id = $1 and evidence_state = 'UNVERIFIED'`, [recordId]);
    await this.audit.record({ organizationId: orgId, actorUserId: userId, action: 'RECORD_CORRECTED', subjectType: 'payment_record', subjectId: recordId, after: { escalated: true }, reason: message ?? 'escalated to owner' });
  }

  /** Owner-only incoming inbox (restricted retention). */
  async inbox(orgId: string, unlinkedOnly: boolean, limit: number): Promise<OwnerInboxEvent[]> {
    const r = await this.db.query<{
      id: string; source_id: string; source_label: string; device_id: string; provider: OwnerInboxEvent['provider']; payment_rail: OwnerInboxEvent['paymentRail'];
      amount_centavos: string; reference_namespace: OwnerInboxEvent['referenceNamespace']; reference_value: string | null; payer_masked_name: string | null; payer_masked_phone: string | null;
      provider_described_at: Date | null; notification_when_at: Date | null; posted_at: Date; server_received_at: Date; purge_after: Date | null; linked_record_id: string | null;
    }>(
      `select e.*, s.label as source_label, (select pm.record_id from payment_matches pm where pm.event_id = e.id and pm.active) as linked_record_id
         from notification_events e join payment_sources s on s.id = e.source_id
        where e.organization_id = $1 and e.purged_at is null
          ${unlinkedOnly ? `and not exists (select 1 from payment_matches pm where pm.event_id = e.id and pm.active) and e.saved_as_record_id is null` : ''}
        order by e.posted_at desc limit $2`,
      [orgId, limit],
    );
    return r.rows.map((e) => {
      const at = e.provider_described_at ?? e.notification_when_at ?? e.posted_at;
      const src: OwnerInboxEvent['eventTimeSource'] = e.provider_described_at ? 'PROVIDER_DESCRIBED' : e.notification_when_at ? 'NOTIFICATION_WHEN' : 'POSTED';
      return {
        eventId: e.id, sourceId: e.source_id, sourceLabel: e.source_label, deviceId: e.device_id, provider: e.provider, paymentRail: e.payment_rail, currency: 'PHP',
        amountCentavos: Number(e.amount_centavos), referenceNamespace: e.reference_namespace, referenceValue: e.reference_value,
        payerMaskedName: e.payer_masked_name, payerMaskedPhone: e.payer_masked_phone, eventAt: at.toISOString(), eventTimeSource: src,
        alreadyLinkedToOtherRecord: e.linked_record_id !== null, linkedRecordId: e.linked_record_id, serverReceivedAt: e.server_received_at.toISOString(), purgeAfter: e.purge_after?.toISOString() ?? null,
      };
    });
  }
}

const InboxQuery = z.object({
  unlinkedOnly: z.preprocess((v) => v === 'true' || v === true, z.boolean()).default(true),
  limit: z.preprocess((v) => (typeof v === 'string' ? Number(v) : v), z.number().int().min(1).max(200)).default(50),
});

@Controller('v1')
@WorkspaceRoute()
export class ReviewController {
  constructor(private readonly svc: ReviewService) {}

  @Get('records/:id/candidates')
  candidates(@Workspace() ws: WorkspaceContext, @Param('id') id: string) {
    return this.svc.candidates(ws.organizationId, id);
  }

  @Post('records/:id/confirm-candidate')
  async confirm(@Workspace() ws: WorkspaceContext, @CurrentUser() u: AuthUser, @Param('id') id: string, @Body(zod(ConfirmCandidateRequest)) b: ConfirmCandidateRequest) {
    await this.svc.confirmCandidate(ws, u.id, id, b.eventId, b.note);
    return { ok: true };
  }

  @Post('records/:id/confirm-manually')
  @OwnerOnly()
  async manual(@Workspace() ws: WorkspaceContext, @CurrentUser() u: AuthUser, @Param('id') id: string, @Body(zod(ConfirmManuallyRequest)) b: { note?: string | null }) {
    await this.svc.confirmManually(ws.organizationId, u.id, id, b.note);
    return { ok: true };
  }

  @Post('records/:id/unlink')
  @OwnerOnly()
  async unlink(@Workspace() ws: WorkspaceContext, @CurrentUser() u: AuthUser, @Param('id') id: string, @Body(zod(UnlinkRequest)) b: UnlinkRequest) {
    await this.svc.unlink(ws.organizationId, u.id, id, b);
    return { ok: true };
  }

  @Post('records/:id/escalate')
  async escalate(@Workspace() ws: WorkspaceContext, @CurrentUser() u: AuthUser, @Param('id') id: string, @Body(zod(EscalateRequest)) b: { message?: string | null }) {
    await this.svc.escalate(ws.organizationId, u.id, id, b.message);
    return { ok: true };
  }

  @Get('inbox')
  @OwnerOnly()
  inbox(@Workspace() ws: WorkspaceContext, @Query(zod(InboxQuery)) q: z.infer<typeof InboxQuery>) {
    return this.svc.inbox(ws.organizationId, q.unlinkedOnly, q.limit);
  }
}

@Module({ controllers: [ReviewController], providers: [ReviewService] })
export class ReviewModule {}
