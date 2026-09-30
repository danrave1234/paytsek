import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditService } from '../db/audit.service';
import type { DbService } from '../db/db.service';
import type { JobsService } from '../jobs/jobs.service';
import { ReconcileService } from './reconcile.service';

vi.mock('../config/env', () => ({
  loadEnv: () => ({
    MATCH_CANDIDATE_WINDOW_SECONDS: 300,
    MATCH_CAPTURE_TIME_FALLBACK_WINDOW_SECONDS: 900,
  }),
}));

const record = {
  id: '00000000-0000-4000-8000-000000000001',
  organization_id: '00000000-0000-4000-8000-000000000010',
  source_id: null,
  provider: null,
  currency: 'PHP' as const,
  amount_centavos: '125000',
  reference_namespace: null,
  reference_value: null,
  receipt_provider: 'GCASH' as const,
  payment_rail: 'QR_P2P' as const,
  receipt_status: 'SUCCESS' as const,
  receipt_transaction_at: new Date('2026-10-01T02:00:00.000Z'),
  receipt_transaction_precision: 'MINUTE' as const,
  captured_at: new Date('2026-10-01T02:01:00.000Z'),
  edited_fields: [],
  evidence_state: 'UNVERIFIED' as const,
  creator_role: 'OWNER' as const,
  require_owner_approval: false,
};

function event(id: string, secondsAfterReceipt: number) {
  return {
    id,
    currency: 'PHP' as const,
    amount_centavos: '125000',
    reference_namespace: 'UNKNOWN' as const,
    reference_value: null,
    provider_described_at: new Date(record.receipt_transaction_at.getTime() + secondsAfterReceipt * 1000),
    notification_when_at: null,
    posted_at: new Date(record.receipt_transaction_at.getTime() + secondsAfterReceipt * 1000),
    payer_masked_name: null,
    payer_masked_phone: null,
    provider: 'GCASH' as const,
    payment_rail: 'UNKNOWN' as const,
    linked_record_id: null,
    source_id: '00000000-0000-4000-8000-000000000020',
  };
}

function setup(events: ReturnType<typeof event>[]) {
  const statements: Array<{ sql: string; params: unknown[] }> = [];
  const client = {
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      statements.push({ sql, params });
      if (sql.includes('from payment_records r')) return { rows: [record], rowCount: 1 };
      if (sql.includes('from notification_events e')) return { rows: events, rowCount: events.length };
      return { rows: [], rowCount: 0 };
    }),
  };
  const db = {
    tx: vi.fn(async (fn: (q: typeof client) => Promise<unknown>) => fn(client)),
    query: vi.fn(),
  } as unknown as DbService;
  const audit = { record: vi.fn(async () => undefined) } as unknown as AuditService;
  const jobs = { enqueue: vi.fn(async () => undefined) } as unknown as JobsService;
  return { service: new ReconcileService(db, audit, jobs), db, audit, statements };
}

describe('ReconcileService authoritative matching', () => {
  beforeEach(() => vi.clearAllMocks());

  it('automatically links the single safe notification already recorded before the scan', async () => {
    const candidate = event('00000000-0000-4000-8000-000000000030', 30);
    const { service, audit, statements } = setup([candidate]);

    await expect(service.reconcileRecord(record.id)).resolves.toBe('MATCHED_AUTO');

    const matchInsert = statements.find(({ sql }) => sql.includes('insert into payment_matches'));
    expect(matchInsert?.params[2]).toBe(candidate.id);
    expect(matchInsert?.params[3]).toContain('AMOUNT_AND_TIME');
    expect(statements.some(({ sql, params }) => sql.includes('set source_id = $2') && params[1] === candidate.source_id)).toBe(true);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'MATCH_AUTO', subjectId: record.id }),
      expect.anything(),
    );
  });

  it('keeps two nearby same-amount notifications as Possible match instead of choosing the nearest', async () => {
    const { service, audit, statements } = setup([
      event('00000000-0000-4000-8000-000000000031', 15),
      event('00000000-0000-4000-8000-000000000032', 45),
    ]);

    await expect(service.reconcileRecord(record.id)).resolves.toBe('REVIEW_REQUIRED');

    expect(statements.some(({ sql }) => sql.includes('insert into payment_matches'))).toBe(false);
    expect(statements.some(({ sql, params }) => sql.includes('set evidence_state = $2') && params[1] === 'REVIEW_REQUIRED')).toBe(true);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('rechecks open records when a notification arrives after the scan', async () => {
    const { service, db } = setup([]);
    const dbQuery = vi.mocked(db.query);
    dbQuery.mockResolvedValue({ rows: [{ id: record.id }], rowCount: 1 } as never);
    const reconcileRecord = vi.spyOn(service, 'reconcileRecord').mockResolvedValue('MATCHED_AUTO');

    await service.reconcileEvent('00000000-0000-4000-8000-000000000030');

    expect(reconcileRecord).toHaveBeenCalledWith(record.id);
  });
});
