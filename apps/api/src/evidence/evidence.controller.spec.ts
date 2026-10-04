import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { AuditService } from '../db/audit.service';
import type { DbService } from '../db/db.service';
import type { ReconcileService } from '../matching/reconcile.service';
import { EvidenceWebhookService } from './evidence-webhook.service';

const master = 'evidence-fixture-master-key-32-bytes-minimum';
vi.mock('../config/env', () => ({
  loadEnv: () => ({ EVIDENCE_WEBHOOK_SIGNING_KEY: master, RETENTION_UNLINKED_EVENTS_DAYS: 7 }),
}));

const connector = {
  id: '00000000-0000-4000-8000-000000000001',
  organization_id: '00000000-0000-4000-8000-000000000002',
  source_id: '00000000-0000-4000-8000-000000000003',
  provider: 'GCASH' as const,
  label: 'Contracted feed',
  adapter: 'GENERIC_HMAC_V1' as const,
  status: 'ACTIVE' as const,
  secret_version: 1,
  created_at: new Date('2026-10-01T00:00:00.000Z'),
  updated_at: new Date('2026-10-01T00:00:00.000Z'),
};

const bodyFor = (status: 'SUCCEEDED' | 'REVERSED') => Buffer.from(JSON.stringify({
  eventId: `delivery-${status.toLowerCase()}`,
  paymentId: 'payment-1',
  status,
  amountCentavos: 15000,
  currency: 'PHP',
  occurredAt: '2026-10-01T00:00:00.000Z',
  paymentRail: 'QR_MERCHANT',
  referenceNamespace: 'UNKNOWN',
  referenceValue: null,
}));

function signature(body: Buffer): string {
  const secret = `pew_${createHmac('sha256', master).update(`paytsek:evidence:${connector.id}:1`).digest('base64url')}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const digest = createHmac('sha256', secret).update(`${timestamp}.${body.toString('utf8')}`).digest('hex');
  return `t=${timestamp},v1=${digest}`;
}

function serviceWith(query: (sql: string, params: unknown[]) => Promise<{ rows: unknown[]; rowCount: number }>) {
  const client = { query: vi.fn(query) };
  const db = {
    one: vi.fn(async () => connector),
    tx: vi.fn(async (work: (tx: typeof client) => Promise<unknown>) => work(client)),
  } as unknown as DbService;
  const audit = { record: vi.fn(async () => undefined) } as unknown as AuditService;
  const reconcile = {
    scheduleEvent: vi.fn(async () => undefined),
    scheduleRecord: vi.fn(async () => undefined),
    reconcileEventInline: vi.fn(async () => undefined),
  } as unknown as ReconcileService;
  return { service: new EvidenceWebhookService(db, audit, reconcile), client, audit, reconcile };
}

describe('signed evidence webhook', () => {
  it('accepts one minimal succeeded event and schedules authoritative matching', async () => {
    const body = bodyFor('SUCCEEDED');
    const eventId = '00000000-0000-4000-8000-000000000010';
    const fixture = serviceWith(async (sql) => {
      if (sql.includes('select id, external_event_id')) return { rows: [], rowCount: 0 };
      if (sql.includes('insert into notification_events')) return { rows: [{ id: eventId }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });

    await expect(fixture.service.receive(connector.id, body, signature(body))).resolves.toEqual({ ok: true, outcome: 'ACCEPTED' });
    expect(fixture.reconcile.scheduleEvent).toHaveBeenCalledWith(eventId, expect.anything());
    expect(fixture.reconcile.reconcileEventInline).toHaveBeenCalledWith(eventId);
    const insert = fixture.client.query.mock.calls.find(([sql]) => String(sql).includes('insert into notification_events'));
    expect(insert?.[1]).not.toContain(body.toString('utf8'));
  });

  it('reopens a linked record when signed evidence is reversed', async () => {
    const body = bodyFor('REVERSED');
    const eventId = '00000000-0000-4000-8000-000000000010';
    const recordId = '00000000-0000-4000-8000-000000000020';
    const fixture = serviceWith(async (sql) => {
      if (sql.includes('select id, external_event_id')) return { rows: [{
        id: eventId, external_event_id: 'delivery-succeeded', external_payment_id: 'payment-1',
        event_status: 'SUCCEEDED', amount_centavos: '15000', currency: 'PHP',
      }], rowCount: 1 };
      if (sql.includes('update payment_matches')) return { rows: [{ record_id: recordId }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });

    await expect(fixture.service.receive(connector.id, body, signature(body))).resolves.toEqual({ ok: true, outcome: 'ACCEPTED' });
    expect(fixture.client.query.mock.calls.some(([sql]) => String(sql).includes("evidence_state = 'REVIEW_REQUIRED'"))).toBe(true);
    expect(fixture.audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'MATCH_REOPENED', subjectId: recordId }), expect.anything());
    expect(fixture.reconcile.scheduleRecord).toHaveBeenCalledWith(recordId, expect.anything());
    expect(fixture.reconcile.scheduleEvent).not.toHaveBeenCalled();
  });
});
