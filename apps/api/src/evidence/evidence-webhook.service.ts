import { Injectable } from '@nestjs/common';
import { IncomingEvidenceWebhook, type EvidenceWebhookAck } from '@paytsek/contracts';
import { normalizeReference } from '@paytsek/receipt-parsers';
import { createHash, randomUUID } from 'node:crypto';
import { ApiException } from '../common/errors';
import { verifyTimestampedWebhookSignature } from '../common/webhook-signature';
import { loadEnv } from '../config/env';
import { AuditService } from '../db/audit.service';
import { DbService, type Queryable } from '../db/db.service';
import { ReconcileService } from '../matching/reconcile.service';
import { deriveConnectorSigningSecret } from './connector-credentials';
import type { ConnectorRow, StoredEvidenceEvent } from './evidence.types';

@Injectable()
export class EvidenceWebhookService {
  private readonly env = loadEnv();

  constructor(
    private readonly db: DbService,
    private readonly audit: AuditService,
    private readonly reconcile: ReconcileService,
  ) {}

  async receive(connectorId: string, rawBody: Buffer | undefined, signature: string | undefined): Promise<EvidenceWebhookAck> {
    const connector = await this.db.one<ConnectorRow>(
      `select c.*, s.provider from evidence_connectors c join payment_sources s on s.id = c.source_id
        where c.id = $1 and c.status = 'ACTIVE' and s.deleted_at is null and not s.collection_paused`,
      [connectorId],
    );
    const secret = connector
      ? deriveConnectorSigningSecret(this.env.EVIDENCE_WEBHOOK_SIGNING_KEY, connector.id, connector.secret_version)
      : '';
    if (!connector || !verifyTimestampedWebhookSignature(rawBody, signature, secret)) {
      throw new ApiException('WEBHOOK_UNAUTHORIZED', 'Invalid evidence webhook signature');
    }

    let decoded: unknown;
    try { decoded = JSON.parse(rawBody!.toString('utf8')); }
    catch { throw new ApiException('VALIDATION_FAILED', 'Webhook body must be valid JSON'); }
    const parsed = IncomingEvidenceWebhook.safeParse(decoded);
    if (!parsed.success) throw new ApiException('VALIDATION_FAILED', 'Webhook body is invalid');
    const input = parsed.data;
    const reference = input.referenceValue && input.referenceNamespace !== 'UNKNOWN'
      ? normalizeReference(input.referenceNamespace, input.referenceValue)
      : null;
    const payloadHash = createHash('sha256').update(rawBody!).digest('hex');
    const purgeAfter = new Date(Date.now() + this.env.RETENTION_UNLINKED_EVENTS_DAYS * 86400_000);

    const result = await this.db.tx(async (tx) => {
      const current = await tx.query<StoredEvidenceEvent>(
        `select id, external_event_id, external_payment_id, event_status, amount_centavos, currency
           from notification_events
          where connector_id = $1 and (external_event_id = $2 or external_payment_id = $3)
          order by created_at limit 1 for update`,
        [connector.id, input.eventId, input.paymentId],
      );
      const existing = current.rows[0];
      if (existing && (
        existing.external_payment_id !== input.paymentId ||
        Number(existing.amount_centavos) !== input.amountCentavos ||
        existing.currency !== input.currency
      )) throw new ApiException('CONFLICT', 'Webhook identity conflicts with an earlier payment event');

      if (existing?.event_status === input.status || (existing && existing.event_status !== 'SUCCEEDED')) {
        return { outcome: 'DUPLICATE' as const, eventId: existing.id, reconcile: false };
      }

      const eventId = existing?.id ?? await this.insertEvent(tx, connector, input, reference, payloadHash, purgeAfter);
      if (existing) {
        await tx.query(
          `update notification_events set event_status = $2, external_event_id = $3, normalized_text_sha256 = $4,
                  provider_described_at = $5, posted_at = $5 where id = $1`,
          [eventId, input.status, input.eventId, payloadHash, input.occurredAt],
        );
      }

      if (input.status === 'SUCCEEDED') {
        await this.reconcile.scheduleEvent(eventId, tx);
        return { outcome: 'ACCEPTED' as const, eventId, reconcile: true };
      }
      await this.reopenLinkedRecords(tx, connector, eventId, input.status);
      return { outcome: 'ACCEPTED' as const, eventId, reconcile: false };
    });

    if (result.reconcile) {
      try { await this.reconcile.reconcileEvent(result.eventId); }
      catch { /* Queued reconciliation remains the retry safety net. */ }
    }
    return { ok: true, outcome: result.outcome };
  }

  private async insertEvent(
    tx: Queryable,
    connector: ConnectorRow,
    input: IncomingEvidenceWebhook,
    reference: ReturnType<typeof normalizeReference> | null,
    payloadHash: string,
    purgeAfter: Date,
  ): Promise<string> {
    const inserted = await tx.query<{ id: string }>(
      `insert into notification_events (
         organization_id, source_id, device_id, client_event_id, provider, source_package,
         parser_id, parser_version, payment_rail, currency, amount_centavos,
         reference_namespace, reference_value, provider_described_at, notification_when_at,
         posted_at, captured_at, monotonic_capture_ms, boot_session_id, lifecycle_dedup_key,
         normalized_text_sha256, was_group_child, purge_after, evidence_origin, connector_id,
         external_event_id, external_payment_id, event_status)
       values ($1,$2,null,$3,$4,'signed-webhook','generic-hmac-v1','1',$5,'PHP',$6,$7,$8,$9,null,$9,now(),0,$10,$11,$12,false,$13,'SIGNED_WEBHOOK',$14,$15,$16,$17)
       returning id`,
      [
        connector.organization_id, connector.source_id, randomUUID(), connector.provider,
        input.paymentRail, input.amountCentavos, reference?.namespace ?? 'UNKNOWN', reference?.value ?? null,
        input.occurredAt, `webhook:${connector.id}`, `webhook:${connector.id}:${input.paymentId}`,
        payloadHash, purgeAfter, connector.id, input.eventId, input.paymentId, input.status,
      ],
    );
    const eventId = inserted.rows[0]!.id;
    await this.audit.record({
      organizationId: connector.organization_id, action: 'EVENT_INGESTED',
      subjectType: 'payment_evidence_event', subjectId: eventId,
      after: { origin: 'SIGNED_WEBHOOK', provider: connector.provider, status: input.status, hasReference: reference !== null },
    }, tx);
    return eventId;
  }

  private async reopenLinkedRecords(
    tx: Queryable,
    connector: ConnectorRow,
    eventId: string,
    status: 'REVERSED' | 'REFUNDED',
  ): Promise<void> {
    const links = await tx.query<{ record_id: string }>(
      `update payment_matches set active = false, unlinked_at = now(), unlink_reason = $2
        where event_id = $1 and active returning record_id`,
      [eventId, `Evidence ${status.toLowerCase()}`],
    );
    for (const link of links.rows) {
      await tx.query(
        `update payment_records set evidence_state = 'REVIEW_REQUIRED'
          where id = $1 and evidence_state in ('MATCHED_AUTO','MATCHED_BY_USER')`,
        [link.record_id],
      );
      await this.reconcile.scheduleRecord(link.record_id, tx);
      await this.audit.record({
        organizationId: connector.organization_id, action: 'MATCH_REOPENED',
        subjectType: 'payment_record', subjectId: link.record_id,
        after: { eventId, status }, reason: 'Signed payment evidence was reversed or refunded',
      }, tx);
    }
    await this.audit.record({
      organizationId: connector.organization_id, action: 'EVENT_REVERSED',
      subjectType: 'payment_evidence_event', subjectId: eventId, after: { status },
    }, tx);
  }
}
