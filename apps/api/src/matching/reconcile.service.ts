import { Injectable, Logger } from '@nestjs/common';
import type { CandidateEvent, CandidatesResponse, EvidenceState, PaymentRail, Provider, ReferenceNamespace, TimePrecision } from '@paytsek/contracts';
import { loadEnv } from '../config/env';
import { AuditService } from '../db/audit.service';
import { DbService, isUniqueViolation, type Queryable } from '../db/db.service';
import { JobsService } from '../jobs/jobs.service';
import { MATCHER_VERSION, decide, type MatchEventInput, type MatchRecordInput, type MatcherConfig } from './matcher';

interface RecordRow {
  id: string;
  organization_id: string;
  source_id: string;
  provider: Provider;
  currency: 'PHP';
  amount_centavos: string;
  reference_namespace: ReferenceNamespace | null;
  reference_value: string | null;
  receipt_provider: Provider | null;
  payment_rail: PaymentRail | null;
  receipt_status: MatchRecordInput['receiptStatus'];
  receipt_transaction_at: Date | null;
  receipt_transaction_precision: TimePrecision;
  captured_at: Date;
  edited_fields: string[];
  evidence_state: EvidenceState;
  creator_role: 'OWNER' | 'CASHIER' | null;
  require_owner_approval: boolean;
}

interface EventRow {
  id: string;
  currency: 'PHP';
  amount_centavos: string;
  reference_namespace: ReferenceNamespace;
  reference_value: string | null;
  provider_described_at: Date | null;
  notification_when_at: Date | null;
  posted_at: Date;
  payer_masked_name: string | null;
  payer_masked_phone: string | null;
  provider: Provider;
  payment_rail: CandidateEvent['paymentRail'];
  linked_record_id: string | null;
}

/** States that reconciliation may move between. Anything else needs an explicit human action. */
const OPEN_STATES: EvidenceState[] = ['UNVERIFIED', 'REVIEW_REQUIRED'];

@Injectable()
export class ReconcileService {
  private readonly logger = new Logger(ReconcileService.name);
  private readonly cfg: MatcherConfig;

  constructor(
    private readonly db: DbService,
    private readonly audit: AuditService,
    private readonly jobs: JobsService,
  ) {
    const env = loadEnv();
    this.cfg = { candidateWindowSeconds: env.MATCH_CANDIDATE_WINDOW_SECONDS, captureTimeFallbackWindowSeconds: env.MATCH_CAPTURE_TIME_FALLBACK_WINDOW_SECONDS };
  }

  /** Enqueue reconciliation for a record (coalesced). */
  async scheduleRecord(recordId: string, q?: Queryable): Promise<void> {
    await this.jobs.enqueue('RECONCILE_RECORD', { recordId }, `record:${recordId}`, q);
  }

  /** Enqueue reconciliation for an event (fans out to same-source, same-amount open records). */
  async scheduleEvent(eventId: string, q?: Queryable): Promise<void> {
    await this.jobs.enqueue('RECONCILE_EVENT', { eventId }, `event:${eventId}`, q);
  }

  async reconcileEvent(eventId: string): Promise<void> {
    const recs = await this.db.query<{ id: string }>(
      `select r.id from payment_records r
         join notification_events e on e.source_id = r.source_id and e.amount_centavos = r.amount_centavos and e.currency = r.currency
        where e.id = $1 and r.evidence_state in ('UNVERIFIED','REVIEW_REQUIRED')
        order by r.created_at limit 200`,
      [eventId],
    );
    for (const r of recs.rows) await this.reconcileRecord(r.id);
  }

  /**
   * Reconcile one record inside a transaction. The record row is locked; the
   * event side is protected by the partial unique index on active matches, so
   * two workers racing for the same event produce exactly one winner.
   */
  async reconcileRecord(recordId: string): Promise<EvidenceState | null> {
    return this.db.tx(async (c) => {
      const rec = await this.loadRecord(c, recordId, true);
      if (!rec) return null;
      if (!OPEN_STATES.includes(rec.evidence_state)) return rec.evidence_state; // never downgrade a human/auto decision here

      const input = toMatchInput(rec);
      const events = await this.loadCandidateEvents(c, rec);
      const decision = decide(input, events.map(toEventInput), this.cfg);

      let next: EvidenceState = 'UNVERIFIED';
      if (decision.kind === 'AUTO') {
        try {
          await c.query('SAVEPOINT claim');
          await c.query(
            `insert into payment_matches (organization_id, record_id, event_id, kind, reason_codes, supporting_fields, missing_fields, time_basis, window_seconds, delta_seconds, flow_id, matcher_version)
             values ($1,$2,$3,'AUTO',$4,$5,$6,$7,$8,$9,$10,$11)`,
            [rec.organization_id, rec.id, decision.eventId, decision.reasonCodes, decision.supportingFields, decision.missingFields, decision.timeBasis, decision.windowSeconds, decision.deltaSeconds, decision.flowId, MATCHER_VERSION],
          );
          await c.query('RELEASE SAVEPOINT claim');
          next = 'MATCHED_AUTO';
          await this.audit.record(
            { organizationId: rec.organization_id, action: 'MATCH_AUTO', subjectType: 'payment_record', subjectId: rec.id, after: { eventId: decision.eventId, reasonCodes: decision.reasonCodes, flowId: decision.flowId, deltaSeconds: decision.deltaSeconds, matcherVersion: MATCHER_VERSION } },
            c,
          );
        } catch (e) {
          if (!isUniqueViolation(e)) throw e;
          // Lost the race: the event (or this record) was claimed concurrently. Fall back to review.
          await c.query('ROLLBACK TO SAVEPOINT claim');
          next = 'REVIEW_REQUIRED';
          this.logger.log(`record ${rec.id}: event ${decision.eventId} claimed concurrently; routing to review`);
        }
      } else if (decision.kind === 'REVIEW') {
        next = 'REVIEW_REQUIRED';
      }

      await c.query(
        `update payment_records set evidence_state = $2, matcher_version = $3, last_reconciled_at = now() where id = $1 and evidence_state in ('UNVERIFIED','REVIEW_REQUIRED')`,
        [rec.id, next, MATCHER_VERSION],
      );
      return next;
    });
  }

  /** Scoped candidate list for the Review screen. Cashiers only see minimal, masked fields. */
  async candidates(orgId: string, recordId: string): Promise<CandidatesResponse> {
    const rec = await this.loadRecord(this.db.pool, recordId, false);
    if (!rec || rec.organization_id !== orgId) return { recordId, timeBasis: 'NONE', windowSeconds: 0, candidates: [], collectorStale: true, collectorLastSeenAt: null };
    const events = await this.loadCandidateEvents(this.db.pool, rec);
    const decision = decide(toMatchInput(rec), events.map(toEventInput), this.cfg);
    const assessed = decision.kind === 'REVIEW' ? decision.candidates : [];
    const byId = new Map(events.map((e) => [e.id, e]));

    const collector = await this.db.one<{ last: Date | null }>(
      `select d.last_server_contact_at as last from device_bindings b join devices d on d.id = b.device_id where b.source_id = $1 and b.status = 'ACTIVE' limit 1`,
      [rec.source_id],
    );
    const lastSeen = collector?.last ?? null;
    const stale = !lastSeen || Date.now() - lastSeen.getTime() > 10 * 60 * 1000;

    return {
      recordId,
      timeBasis: decision.timeBasis,
      windowSeconds: decision.windowSeconds,
      collectorStale: stale,
      collectorLastSeenAt: lastSeen?.toISOString() ?? null,
      candidates: assessed.map((a) => {
        const e = byId.get(a.event.id)!;
        const { at, source } = bestEventTime(e);
        return {
          eventId: e.id,
          provider: e.provider,
          paymentRail: e.payment_rail,
          currency: 'PHP',
          amountCentavos: Number(e.amount_centavos),
          referenceNamespace: e.reference_namespace,
          referenceValue: e.reference_value,
          payerMaskedName: e.payer_masked_name,
          payerMaskedPhone: e.payer_masked_phone,
          eventAt: at.toISOString(),
          eventTimeSource: source,
          deltaSeconds: a.deltaSeconds,
          supportingFields: a.supportingFields,
          missingFields: a.missingFields,
          blockers: a.blockers,
          alreadyLinkedToOtherRecord: a.event.linkedToOtherRecord,
        };
      }),
    };
  }

  // ---- loaders ----------------------------------------------------------------

  private async loadRecord(q: Queryable, recordId: string, lock: boolean): Promise<RecordRow | null> {
    const r = await q.query<RecordRow>(
      `select r.id, r.organization_id, r.source_id, s.provider, r.currency, r.amount_centavos, r.reference_namespace, r.reference_value,
              r.receipt_provider, r.payment_rail, r.receipt_status, r.receipt_transaction_at, r.receipt_transaction_precision, r.captured_at, r.edited_fields, r.evidence_state,
              m.role as creator_role, s.require_owner_approval_for_staff_matches as require_owner_approval
         from payment_records r
         join payment_sources s on s.id = r.source_id
         left join memberships m on m.organization_id = r.organization_id and m.user_id = r.created_by
        where r.id = $1 ${lock ? 'for update of r' : ''}`,
      [recordId],
    );
    return r.rows[0] ?? null;
  }

  /** Same source, exact amount, not purged; wide time bounds (the matcher applies the precise window). */
  private async loadCandidateEvents(q: Queryable, rec: RecordRow): Promise<EventRow[]> {
    const r = await q.query<EventRow>(
      `select e.id, e.currency, e.amount_centavos, e.reference_namespace, e.reference_value, e.provider_described_at, e.notification_when_at, e.posted_at,
              e.payer_masked_name, e.payer_masked_phone, e.provider, e.payment_rail,
              (select pm.record_id from payment_matches pm where pm.event_id = e.id and pm.active and pm.record_id <> $1 limit 1) as linked_record_id
         from notification_events e
        where e.source_id = $2 and e.amount_centavos = $3 and e.currency = $4 and e.purged_at is null
          and e.posted_at between $5::timestamptz - interval '3 days' and $5::timestamptz + interval '3 days'
        order by e.posted_at limit 200`,
      [rec.id, rec.source_id, rec.amount_centavos, rec.currency, rec.receipt_transaction_at ?? rec.captured_at],
    );
    // Exact-reference events outside the 3-day bound are still valid (delayed match): fetch them explicitly.
    if (rec.reference_value && rec.reference_namespace) {
      const extra = await q.query<EventRow>(
        `select e.id, e.currency, e.amount_centavos, e.reference_namespace, e.reference_value, e.provider_described_at, e.notification_when_at, e.posted_at,
                e.payer_masked_name, e.payer_masked_phone, e.provider, e.payment_rail,
                (select pm.record_id from payment_matches pm where pm.event_id = e.id and pm.active and pm.record_id <> $1 limit 1) as linked_record_id
           from notification_events e
          where e.source_id = $2 and e.amount_centavos = $3 and e.currency = $4 and e.purged_at is null
            and e.reference_value is not null and regexp_replace(e.reference_value, '[^A-Za-z0-9]', '', 'g') = regexp_replace($5, '[^A-Za-z0-9]', '', 'g')`,
        [rec.id, rec.source_id, rec.amount_centavos, rec.currency, rec.reference_value],
      );
      const seen = new Set(r.rows.map((x) => x.id));
      for (const e of extra.rows) if (!seen.has(e.id)) r.rows.push(e);
    }
    return r.rows;
  }
}

function bestEventTime(e: EventRow): { at: Date; source: CandidateEvent['eventTimeSource'] } {
  if (e.provider_described_at) return { at: e.provider_described_at, source: 'PROVIDER_DESCRIBED' };
  if (e.notification_when_at) return { at: e.notification_when_at, source: 'NOTIFICATION_WHEN' };
  return { at: e.posted_at, source: 'POSTED' };
}

function toMatchInput(r: RecordRow): MatchRecordInput {
  return {
    id: r.id,
    receivingProvider: r.provider,
    receiptProvider: r.receipt_provider,
    paymentRail: r.payment_rail,
    currency: r.currency,
    amountCentavos: Number(r.amount_centavos),
    referenceNamespace: r.reference_namespace,
    referenceValue: r.reference_value,
    receiptStatus: r.receipt_status,
    receiptTransactionAt: r.receipt_transaction_at?.toISOString() ?? null,
    receiptTransactionPrecision: r.receipt_transaction_precision,
    capturedAt: r.captured_at.toISOString(),
    editedFields: r.edited_fields ?? [],
    requiresOwnerApproval: r.require_owner_approval && r.creator_role !== 'OWNER',
  };
}

function toEventInput(e: EventRow): MatchEventInput {
  const { at, source } = bestEventTime(e);
  return {
    id: e.id,
    currency: e.currency,
    amountCentavos: Number(e.amount_centavos),
    referenceNamespace: e.reference_namespace,
    referenceValue: e.reference_value,
    eventAt: at.toISOString(),
    eventTimeSource: source,
    linkedToOtherRecord: e.linked_record_id !== null,
  };
}
