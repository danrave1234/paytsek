import { Injectable } from '@nestjs/common';
import type { CorrectRecordRequest, CreateRecordRequest, CreateRecordResponse, ListRecordsQuery, ListRecordsResponse, RecordDetail, RecordSummary } from '@payrecord/contracts';
import { AUTO_MATCH_DISCLOSURE, MATCHING_CRITICAL_FIELDS } from '@payrecord/contracts';
import { ApiException } from '../common/errors';
import { AuditService } from '../db/audit.service';
import { DbService, isUniqueViolation } from '../db/db.service';
import { ReconcileService } from '../matching/reconcile.service';
import { ProofsService } from './proofs.service';
import { RECORD_SELECT, toDetail, toSummary, type RecordRow } from './records.rows';

@Injectable()
export class RecordsService {
  constructor(
    private readonly db: DbService,
    private readonly audit: AuditService,
    private readonly reconcile: ReconcileService,
    private readonly proofs: ProofsService,
  ) {}

  /**
   * Create one canonical record. Stable clientRecordId makes retries free.
   * Quota is consumed atomically with creation via consume_record_quota();
   * when exhausted nothing is written and QUOTA_EXHAUSTED is returned so the
   * client keeps a clearly labeled local draft.
   */
  async create(orgId: string, userId: string, input: CreateRecordRequest): Promise<CreateRecordResponse> {
    const existing = await this.db.one<RecordRow>(`${RECORD_SELECT} where r.organization_id = $1 and r.client_record_id = $2`, [orgId, input.clientRecordId]);
    if (existing) return { record: toSummary(existing), deduplicated: true, quotaConsumed: false };

    if (input.proofId) {
      const p = await this.db.one<{ upload_finalized_at: Date | null; linked: string | null }>(
        `select p.upload_finalized_at, (select id from payment_records where proof_id = p.id and evidence_state <> 'VOIDED' limit 1) as linked
           from payment_proofs p where p.id = $1 and p.organization_id = $2`,
        [input.proofId, orgId],
      );
      if (!p) throw new ApiException('NOT_FOUND', 'Proof not found');
      if (!p.upload_finalized_at) throw new ApiException('PROOF_UPLOAD_NOT_FINALIZED', 'Finalize the image upload first');
      if (p.linked) {
        const rec = await this.db.one<RecordRow>(`${RECORD_SELECT} where r.id = $1`, [p.linked]);
        return { record: toSummary(rec!), deduplicated: true, quotaConsumed: false };
      }
    }
    const c = input.corrected;
    const edited = computeEdited(input.extracted as unknown as Record<string, unknown>, c as unknown as Record<string, unknown>);

    return this.db.tx(async (tx) => {
      let id: string;
      try {
        const ins = await tx.query<{ id: string }>(
          `insert into payment_records (organization_id, source_id, client_record_id, proof_id, capture_origin, created_by, app_version, receipt_parser_id, receipt_parser_version,
             currency, amount_centavos, fee_centavos, total_charged_centavos, receipt_provider, payment_rail, reference_namespace, reference_value,
             payer_name, payer_phone, payee_name, payee_phone, receipt_transaction_at, receipt_transaction_precision, receipt_status, customer_label, note, edited_fields, captured_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'PHP',$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27) returning id`,
          [orgId, input.sourceId, input.clientRecordId, input.proofId, input.captureOrigin, userId, input.appVersion, input.receiptParserId, input.receiptParserVersion,
            c.amountCentavos, c.feeCentavos, c.totalChargedCentavos, c.receiptProvider, c.paymentRail, c.referenceNamespace, c.referenceValue,
            c.payerName, c.payerPhone, c.payeeName, c.payeePhone, c.receiptTransactionAt, c.receiptTransactionPrecision, c.receiptStatus, input.customerLabel ?? null, input.note ?? null, edited, input.capturedAt],
        );
        id = ins.rows[0]!.id;
      } catch (e) {
        if (isUniqueViolation(e)) throw new ApiException('IDEMPOTENCY_CONFLICT', 'Record already being created; retry');
        throw e;
      }
      const pool = await tx.query<{ consume_record_quota: string }>(`select consume_record_quota($1,$2,$3)`, [orgId, id, userId]);
      const outcome = pool.rows[0]!.consume_record_quota;
      if (outcome === 'NONE') throw new ApiException('QUOTA_EXHAUSTED', 'Monthly record allowance and prepaid credits are used up. Your scan is kept as a local draft.');

      await tx.query(`insert into proof_versions (organization_id, record_id, version, kind, ocr, fields, edited_fields, created_by) values ($1,$2,1,'OCR_ORIGINAL',$3,$4,'{}',$5)`, [orgId, id, input.ocr ? JSON.stringify(input.ocr) : null, JSON.stringify(input.extracted), userId]);
      if (edited.length > 0) {
        await tx.query(`insert into proof_versions (organization_id, record_id, version, kind, fields, edited_fields, created_by) values ($1,$2,2,'USER_CORRECTION',$3,$4,$5)`, [orgId, id, JSON.stringify(c), edited, userId]);
      }
      await this.flagDuplicates(tx, orgId, id, c.referenceNamespace, c.referenceValue, input.proofId);
      await this.audit.record({ organizationId: orgId, actorUserId: userId, action: 'RECORD_CREATED', subjectType: 'payment_record', subjectId: id, after: { amountCentavos: c.amountCentavos, sourceId: input.sourceId, quotaPool: outcome } }, tx);
      await this.audit.record({ organizationId: orgId, actorUserId: userId, action: 'QUOTA_CONSUMED', subjectType: 'payment_record', subjectId: id, after: { pool: outcome } }, tx);
      if (input.fromEventId) await tx.query(`update notification_events set saved_as_record_id = $2, purge_after = null where id = $1 and organization_id = $3`, [input.fromEventId, id, orgId]);
      await this.reconcile.scheduleRecord(id, tx);
      const row = await tx.query<RecordRow>(`${RECORD_SELECT} where r.id = $1`, [id]);
      return { record: toSummary(row.rows[0]!), deduplicated: false, quotaConsumed: true };
    });
  }

  private async flagDuplicates(tx: { query: DbService['pool']['query'] }, orgId: string, id: string, ns: string | null, ref: string | null, proofId: string | null): Promise<void> {
    const flags: string[] = [];
    if (ns && ref) {
      const dup = await tx.query(`select 1 from payment_records where organization_id = $1 and id <> $2 and reference_namespace = $3 and reference_value = $4 and evidence_state <> 'VOIDED' limit 1`, [orgId, id, ns, ref]);
      if (dup.rowCount) flags.push('DUPLICATE_SUSPECTED');
    }
    if (proofId) {
      const sim = await tx.query(
        `select 1 from payment_proofs a join payment_proofs b on b.organization_id = a.organization_id and b.id <> a.id and b.perceptual_hash is not null and b.perceptual_hash = a.perceptual_hash
          where a.id = $1 and a.perceptual_hash is not null limit 1`,
        [proofId],
      );
      if (sim.rowCount) flags.push('SIMILAR_IMAGE');
    }
    if (flags.length) await tx.query(`update payment_records set flags = $2 where id = $1`, [id, flags]);
  }

  async list(orgId: string, q: ListRecordsQuery): Promise<ListRecordsResponse> {
    const params: unknown[] = [orgId];
    const where: string[] = ['r.organization_id = $1'];
    if (q.q) { params.push(`%${q.q}%`); where.push(`(r.reference_value ilike $${params.length} or r.customer_label ilike $${params.length} or r.note ilike $${params.length} or r.payer_name ilike $${params.length})`); }
    if (q.state?.length) { params.push(q.state); where.push(`r.evidence_state = any($${params.length}::evidence_state[])`); }
    if (q.sourceId) { params.push(q.sourceId); where.push(`r.source_id = $${params.length}`); }
    if (q.staffUserId) { params.push(q.staffUserId); where.push(`r.created_by = $${params.length}`); }
    if (q.from) { params.push(q.from); where.push(`r.created_at >= $${params.length}`); }
    if (q.to) { params.push(q.to); where.push(`r.created_at <= $${params.length}`); }
    if (q.cursor) { params.push(q.cursor); where.push(`r.created_at < $${params.length}::timestamptz`); }
    params.push(q.limit + 1);
    const r = await this.db.query<RecordRow>(`${RECORD_SELECT} where ${where.join(' and ')} order by r.created_at desc limit $${params.length}`, params);
    const items = r.rows.slice(0, q.limit).map(toSummary);
    const nextCursor = r.rows.length > q.limit ? items[items.length - 1]!.createdAt : null;
    return { items, nextCursor };
  }

  async detail(orgId: string, id: string): Promise<RecordDetail> {
    const row = await this.db.one<RecordRow>(`${RECORD_SELECT} where r.organization_id = $1 and r.id = $2`, [orgId, id]);
    if (!row) throw new ApiException('RECORD_NOT_FOUND', 'Record not found');
    const versions = await this.db.query<{ kind: string; fields: RecordDetail['extracted'] }>(`select kind, fields from proof_versions where record_id = $1 order by version`, [id]);
    const history = await this.db.query<{ created_at: Date; action: string; display_name: string | null; reason: string | null }>(
      `select a.created_at, a.action, p.display_name, a.reason from audit_events a left join profiles p on p.user_id = a.actor_user_id
        where a.subject_type = 'payment_record' and a.subject_id = $1 order by a.created_at desc limit 100`,
      [id],
    );
    const image = row.proof_id ? await this.proofs.signedView(orgId, row.proof_id) : null;
    const match = await this.db.one<{ kind: RecordDetail['matchExplanation']['kind']; reason_codes: RecordDetail['matchExplanation']['reasonCodes']; supporting_fields: string[]; missing_fields: string[]; time_basis: RecordDetail['matchExplanation']['timeBasis']; window_seconds: number | null; matcher_version: string }>(
      `select kind, reason_codes, supporting_fields, missing_fields, time_basis, window_seconds, matcher_version from payment_matches where record_id = $1 and active`,
      [id],
    );
    return toDetail(row, {
      extracted: versions.rows.find((v) => v.kind === 'OCR_ORIGINAL')?.fields ?? null,
      history: history.rows.map((h) => ({ at: h.created_at.toISOString(), action: h.action, actorDisplayName: h.display_name, reason: h.reason })),
      image,
      match: match
        ? { kind: match.kind, reasonCodes: match.reason_codes, supportingFields: match.supporting_fields, missingFields: match.missing_fields, timeBasis: match.time_basis, windowSeconds: match.window_seconds, matcherVersion: match.matcher_version, disclosure: match.kind === 'AUTO' ? AUTO_MATCH_DISCLOSURE : null }
        : { kind: null, reasonCodes: [], supportingFields: [], missingFields: [], timeBasis: 'NONE', windowSeconds: null, matcherVersion: row.matcher_version, disclosure: null },
    });
  }

  /** Corrections keep history; material (matching-critical) edits reopen reconciliation. */
  async correct(orgId: string, userId: string, isOwner: boolean, id: string, input: CorrectRecordRequest): Promise<RecordDetail> {
    await this.db.tx(async (tx) => {
      const cur = await tx.query<RecordRow>(`${RECORD_SELECT} where r.organization_id = $1 and r.id = $2 for update of r`, [orgId, id]);
      const row = cur.rows[0];
      if (!row) throw new ApiException('RECORD_NOT_FOUND', 'Record not found');
      if (row.evidence_state === 'VOIDED') throw new ApiException('RECORD_VOIDED', 'Voided records cannot be edited');
      if (!isOwner && row.created_by !== userId) throw new ApiException('FORBIDDEN', 'Cashiers can only correct their own records');
      const changed = Object.keys(input.corrected).filter((k) => (input.corrected as Record<string, unknown>)[k] !== undefined);
      const material = changed.some((k) => (MATCHING_CRITICAL_FIELDS as readonly string[]).includes(k));
      if (material && !isOwner && row.evidence_state !== 'UNVERIFIED' && row.evidence_state !== 'REVIEW_REQUIRED') {
        throw new ApiException('OWNER_ONLY', 'Only the owner can change matching-critical fields of a matched record');
      }
      const f = input.corrected;
      await tx.query(
        `update payment_records set amount_centavos = coalesce($3, amount_centavos), fee_centavos = coalesce($4, fee_centavos), total_charged_centavos = coalesce($5, total_charged_centavos),
           receipt_provider = coalesce($6, receipt_provider), payment_rail = coalesce($7, payment_rail), reference_namespace = coalesce($8, reference_namespace), reference_value = coalesce($9, reference_value),
           payer_name = coalesce($10, payer_name), payer_phone = coalesce($11, payer_phone), payee_name = coalesce($12, payee_name), payee_phone = coalesce($13, payee_phone),
           receipt_transaction_at = coalesce($14, receipt_transaction_at), receipt_transaction_precision = coalesce($15, receipt_transaction_precision), receipt_status = coalesce($16, receipt_status),
           customer_label = coalesce($17, customer_label), note = coalesce($18, note),
           edited_fields = (select array_agg(distinct x) from unnest(edited_fields || $19::text[]) x)
         where organization_id = $1 and id = $2`,
        [orgId, id, f.amountCentavos, f.feeCentavos, f.totalChargedCentavos, f.receiptProvider, f.paymentRail, f.referenceNamespace, f.referenceValue, f.payerName, f.payerPhone, f.payeeName, f.payeePhone, f.receiptTransactionAt, f.receiptTransactionPrecision, f.receiptStatus, input.customerLabel ?? null, input.note ?? null, changed],
      );
      const v = await tx.query<{ n: number }>(`select coalesce(max(version),0)::int + 1 as n from proof_versions where record_id = $1`, [id]);
      await tx.query(`insert into proof_versions (organization_id, record_id, version, kind, fields, edited_fields, reason, created_by) values ($1,$2,$3,$4,$5,$6,$7,$8)`, [orgId, id, v.rows[0]!.n, isOwner ? 'OWNER_CORRECTION' : 'USER_CORRECTION', JSON.stringify(f), changed, input.reason, userId]);
      await this.audit.record({ organizationId: orgId, actorUserId: userId, action: 'RECORD_CORRECTED', subjectType: 'payment_record', subjectId: id, after: { fields: changed, material }, reason: input.reason }, tx);
      if (material) {
        // Reopen reconciliation: deactivate the current association but keep it in history.
        await tx.query(`update payment_matches set active = false, unlinked_at = now(), unlinked_by = $2, unlink_reason = 'material edit' where record_id = $1 and active`, [id, userId]);
        await tx.query(`update payment_records set evidence_state = 'UNVERIFIED' where id = $1 and evidence_state in ('MATCHED_AUTO','MATCHED_BY_USER','REVIEW_REQUIRED')`, [id]);
        await this.audit.record({ organizationId: orgId, actorUserId: userId, action: 'MATCH_REOPENED', subjectType: 'payment_record', subjectId: id, reason: 'material edit' }, tx);
        await this.reconcile.scheduleRecord(id, tx);
      }
    });
    return this.detail(orgId, id);
  }

  /** Voiding excludes from totals, keeps evidence + audit, and never refunds quota automatically. */
  async void(orgId: string, userId: string, id: string, reason: string): Promise<void> {
    await this.db.tx(async (tx) => {
      const r = await tx.query<{ evidence_state: string }>(`select evidence_state from payment_records where organization_id = $1 and id = $2 for update`, [orgId, id]);
      if (!r.rows[0]) throw new ApiException('RECORD_NOT_FOUND', 'Record not found');
      if (r.rows[0].evidence_state === 'VOIDED') return;
      await tx.query(`update payment_matches set active = false, unlinked_at = now(), unlinked_by = $2, unlink_reason = 'record voided' where record_id = $1 and active`, [id, userId]);
      await tx.query(`update payment_records set evidence_state = 'VOIDED', void_reason = $3, voided_at = now(), voided_by = $2 where id = $1`, [id, userId, reason]);
      await this.audit.record({ organizationId: orgId, actorUserId: userId, action: 'RECORD_VOIDED', subjectType: 'payment_record', subjectId: id, before: { evidenceState: r.rows[0].evidence_state }, reason }, tx);
    });
  }
}

function computeEdited(extracted: Record<string, unknown>, corrected: Record<string, unknown>): string[] {
  return Object.keys(corrected).filter((k) => JSON.stringify(corrected[k] ?? null) !== JSON.stringify(extracted[k] ?? null));
}
