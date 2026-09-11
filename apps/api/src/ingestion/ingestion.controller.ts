import { Body, Controller, Injectable, Module, Post } from '@nestjs/common';
import { IngestBatchRequest, type IncomingPaymentEventInput, type IngestBatchResponse, type IngestItemAck, type Provider } from '@paytsek/contracts';
import { providerForPackage } from '@paytsek/receipt-parsers';
import { Collector, CollectorRoute } from '../auth/decorators';
import type { CollectorContext } from '../auth/guards';
import { zod } from '../common/zod.pipe';
import { loadEnv } from '../config/env';
import { AuditService } from '../db/audit.service';
import { DbService, isUniqueViolation } from '../db/db.service';
import { ReconcileService } from '../matching/reconcile.service';

@Injectable()
export class IngestionService {
  private readonly env = loadEnv();

  constructor(
    private readonly db: DbService,
    private readonly audit: AuditService,
    private readonly reconcile: ReconcileService,
  ) {}

  /**
   * Scoped collector batch ingestion.
   *  - Batch idempotency: a replayed batchId returns the stored acks.
   *  - Item idempotency: (device, clientEventId) and (source, lifecycleDedupKey) are unique.
   *  - Scope: the target source is derived from the device's active bindings and the
   *    event's provider package; the client never names a workspace or source.
   */
  async ingest(col: CollectorContext, batch: IngestBatchRequest): Promise<IngestBatchResponse> {
    const replay = await this.db.one<{ acks: IngestItemAck[] }>(`select acks from ingest_batches where id = $1 and device_id = $2`, [batch.batchId, col.deviceId]);
    if (replay) return { batchId: batch.batchId, acks: replay.acks, serverReceivedAt: new Date().toISOString() };

    const device = await this.db.one<{ status: string }>(`select status from devices where id = $1`, [col.deviceId]);
    const sources = await this.db.query<{ id: string; provider: Provider; collection_paused: boolean }>(
      `select id, provider, collection_paused from payment_sources where id = any($1::uuid[]) and deleted_at is null`,
      [col.boundSourceIds],
    );

    const acks: IngestItemAck[] = [];
    for (const ev of batch.events) {
      acks.push(await this.ingestOne(col, device?.status ?? 'REVOKED', sources.rows, ev));
    }

    // Store acks for replay (best effort; a concurrent duplicate batch simply recomputes the same idempotent result).
    await this.db.query(`insert into ingest_batches (id, device_id, acks) values ($1,$2,$3) on conflict (id) do nothing`, [batch.batchId, col.deviceId, JSON.stringify(acks)]);
    await this.db.query(`update devices set last_observed_event_at = greatest(coalesce(last_observed_event_at, 'epoch'), $2) where id = $1`, [
      col.deviceId,
      batch.events.reduce((m, e) => (e.postedAt > m ? e.postedAt : m), batch.events[0]!.postedAt),
    ]);
    return { batchId: batch.batchId, acks, serverReceivedAt: new Date().toISOString() };
  }

  private async ingestOne(col: CollectorContext, deviceStatus: string, sources: { id: string; provider: Provider; collection_paused: boolean }[], ev: IncomingPaymentEventInput): Promise<IngestItemAck> {
    const reject = (reason: NonNullable<IngestItemAck['reason']>): IngestItemAck => ({ clientEventId: ev.clientEventId, outcome: 'REJECTED', eventId: null, reason });
    if (deviceStatus === 'REVOKED') return reject('DEVICE_REVOKED');
    if (deviceStatus === 'PAUSED') return reject('DEVICE_PAUSED');

    // The provider must be derivable from the authoritative package, and must equal the declared provider.
    const pkgProvider = providerForPackage(ev.sourcePackage);
    if (!pkgProvider || pkgProvider !== ev.provider) return reject('PROVIDER_NOT_ENABLED');

    const targets = sources.filter((s) => s.provider === ev.provider);
    if (targets.length === 0) return reject('SOURCE_NOT_BOUND');
    // A single phone cannot distinguish multiple logins of the same wallet package; one binding per provider per device.
    if (targets.length > 1) return reject('AMBIGUOUS_LIFECYCLE_KEY');
    const source = targets[0]!;
    if (source.collection_paused) return reject('DEVICE_PAUSED');

    const purgeAfter = new Date(Date.now() + this.env.RETENTION_UNLINKED_EVENTS_DAYS * 86400_000);
    try {
      const eventId = await this.db.tx(async (c) => {
        const ins = await c.query<{ id: string }>(
          `insert into notification_events (
             organization_id, source_id, device_id, client_event_id, provider, source_package, source_app_version_name, source_app_version_code,
             parser_id, parser_version, payment_rail, currency, amount_centavos, reference_namespace, reference_value,
             payer_masked_name, payer_masked_phone, provider_described_at, notification_when_at, posted_at, captured_at,
             monotonic_capture_ms, boot_session_id, lifecycle_dedup_key, normalized_text_sha256, was_group_child, purge_after)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27) returning id`,
          [
            col.organizationId, source.id, col.deviceId, ev.clientEventId, ev.provider, ev.sourcePackage, ev.sourceAppVersionName, ev.sourceAppVersionCode,
            ev.parserId, ev.parserVersion, ev.paymentRail, ev.currency, ev.amountCentavos, ev.referenceNamespace, ev.referenceValue,
            ev.payerMaskedName, ev.payerMaskedPhone, ev.providerDescribedAt, ev.notificationWhenAt, ev.postedAt, ev.capturedAt,
            ev.monotonicCaptureMs, ev.bootSessionId, ev.lifecycleDedupKey, ev.normalizedTextSha256, ev.wasGroupChild, purgeAfter,
          ],
        );
        const id = ins.rows[0]!.id;
        await this.audit.record({ organizationId: col.organizationId, actorDeviceId: col.deviceId, action: 'EVENT_INGESTED', subjectType: 'notification_event', subjectId: id, after: { provider: ev.provider, amountCentavos: ev.amountCentavos, hasReference: ev.referenceValue !== null } }, c);
        await this.reconcile.scheduleEvent(id, c);
        return id;
      });
      return { clientEventId: ev.clientEventId, outcome: 'ACCEPTED', eventId, reason: null };
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      const existing = await this.db.one<{ id: string; normalized_text_sha256: string; amount_centavos: string }>(
        `select id, normalized_text_sha256, amount_centavos from notification_events
          where (device_id = $1 and client_event_id = $2) or (source_id = $3 and lifecycle_dedup_key = $4) limit 1`,
        [col.deviceId, ev.clientEventId, source.id, ev.lifecycleDedupKey],
      );
      if (!existing) return reject('SCHEMA_INVALID');
      // Same lifecycle key but materially different content (different amount) => a provider reused a
      // notification key for a distinct payment. Preserve the money evidence by flagging ambiguity rather
      // than silently dropping it.
      if (Number(existing.amount_centavos) !== ev.amountCentavos) return reject('AMBIGUOUS_LIFECYCLE_KEY');
      return { clientEventId: ev.clientEventId, outcome: 'DUPLICATE', eventId: existing.id, reason: null };
    }
  }
}

@Controller('v1/collector')
@CollectorRoute()
export class IngestionController {
  constructor(private readonly svc: IngestionService) {}

  @Post('events')
  ingest(@Collector() col: CollectorContext, @Body(zod(IngestBatchRequest)) body: IngestBatchRequest) {
    return this.svc.ingest(col, body);
  }
}

@Module({ controllers: [IngestionController], providers: [IngestionService] })
export class IngestionModule {}
