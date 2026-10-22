import { describe, expect, it, vi } from 'vitest';
import type { CorrectRecordRequest, RecordDetail } from '@paytsek/contracts';
import type { AuditService } from '../db/audit.service';
import type { DbService } from '../db/db.service';
import type { ReconcileService } from '../matching/reconcile.service';
import type { ProofsService } from './proofs.service';
import type { RecordRow } from './records.rows';
import { RecordsService } from './records.service';

vi.mock('../config/env', () => ({ loadEnv: () => ({ BETA_MODE: true }) }));

function setup(patch: Partial<RecordRow> = {}) {
  const row = {
    id: 'synthetic-record', organization_id: 'synthetic-workspace', created_by: 'synthetic-cashier',
    amount_centavos: '125000', currency: 'PHP', receipt_provider: 'GCASH', payment_rail: 'EXPRESS_SEND',
    fee_centavos: null, total_charged_centavos: null, reference_namespace: null, reference_value: null,
    payer_name: null, payer_phone: null, payee_name: null, payee_phone: null, customer_label: null, note: null,
    receipt_transaction_at: new Date('2026-10-04T02:00:00.000Z'), receipt_transaction_precision: 'MINUTE', receipt_status: 'SUCCESS',
    evidence_state: 'MATCHED_AUTO', edited_fields: [], ...patch,
  } as RecordRow;
  const tx = { query: vi.fn(async (sql: string, _params?: unknown[]) => {
    if (sql.includes('for update of r')) return { rows: [row] };
    if (sql.includes('max(version)')) return { rows: [{ n: 2 }] };
    return { rows: [] };
  }) };
  const db = { tx: async (action: (client: typeof tx) => Promise<unknown>) => action(tx) } as unknown as DbService;
  const audit = { record: vi.fn(async () => undefined) };
  const reconcile = { scheduleRecord: vi.fn(async () => undefined) };
  const service = new RecordsService(db, audit as unknown as AuditService, reconcile as unknown as ReconcileService, {} as ProofsService);
  vi.spyOn(service, 'detail').mockResolvedValue({ id: row.id } as RecordDetail);
  const correct = (input: Partial<CorrectRecordRequest>, owner = true, userId = 'synthetic-cashier') => service.correct(row.organization_id, userId, owner, row.id, {
    corrected: {}, reason: 'Synthetic correction', ...input,
  });
  const writes = () => tx.query.mock.calls.filter(([sql]) => /^(update|insert)/.test(sql));
  return { correct, audit, reconcile, writes };
}

describe('record correction integrity', () => {
  it.each(['MATCHED_AUTO', 'MATCHED_BY_USER', 'CONFIRMED_MANUALLY'] as const)('preserves %s and history on an unchanged save', async (evidence_state) => {
    const context = setup({ evidence_state });
    await context.correct({ corrected: { amountCentavos: 125000, receiptProvider: 'GCASH', receiptTransactionAt: '2026-10-04T02:00:00Z' } });
    expect(context.writes()).toEqual([]);
    expect(context.audit.record).not.toHaveBeenCalled();
    expect(context.reconcile.scheduleRecord).not.toHaveBeenCalled();
  });

  it('does not reject a cashier retry that changes no matching facts', async () => {
    const context = setup();
    await context.correct({ corrected: { amountCentavos: 125000 } }, false);
    expect(context.writes()).toEqual([]);
  });

  it.each([
    ['receiptProvider', 'receipt_provider', 'GCASH'],
    ['referenceValue', 'reference_value', 'synthetic-reference'],
    ['receiptTransactionAt', 'receipt_transaction_at', new Date('2026-10-04T02:00:00.000Z')],
    ['feeCentavos', 'fee_centavos', '100'],
  ] as const)('persists an explicit null for %s without overwriting omitted fields', async (field, column, value) => {
    const context = setup({ [column]: value });
    await context.correct({ corrected: { [field]: null } });
    const update = context.writes()[0]!;
    expect(update[0]).toContain(`set ${column} = $3,`);
    expect(update[0]).not.toContain('coalesce(');
    expect(update[0]).not.toContain('amount_centavos =');
    expect(update[1]).toEqual(['synthetic-workspace', 'synthetic-record', null, [field]]);
  });

  it('clears metadata without unlinking evidence or losing its audit entry', async () => {
    const context = setup({ note: 'Synthetic note' });
    await context.correct({ corrected: { amountCentavos: 125000 }, note: null });
    expect(context.writes()[0]![0]).toContain('set note = $3,');
    expect(context.writes()[0]![1]).toEqual(['synthetic-workspace', 'synthetic-record', null, ['note']]);
    expect(context.writes().some(([sql]) => sql.includes('update payment_matches'))).toBe(false);
    expect(context.audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'RECORD_CORRECTED', after: { fields: ['note'], material: false } }), expect.anything());
    expect(context.reconcile.scheduleRecord).not.toHaveBeenCalled();
  });

  it.each(['MATCHED_AUTO', 'MATCHED_BY_USER', 'CONFIRMED_MANUALLY'] as const)('reopens %s after an actual amount correction', async (evidence_state) => {
    const context = setup({ evidence_state });
    await context.correct({ corrected: { amountCentavos: 150000, receiptProvider: 'GCASH' } });
    expect(context.writes()[0]![1]).toEqual(['synthetic-workspace', 'synthetic-record', 150000, ['amountCentavos']]);
    expect(context.writes().some(([sql]) => sql.includes('update payment_matches set active = false'))).toBe(true);
    expect(context.writes().some(([sql]) => sql.includes("set evidence_state = 'UNVERIFIED', last_reconciled_at = null where"))).toBe(true);
    expect(context.reconcile.scheduleRecord).toHaveBeenCalledWith('synthetic-record', expect.anything());
    expect(context.audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'MATCH_REOPENED' }), expect.anything());
  });

  it.each([{ receiptStatus: 'FAILED' as const }, { receiptTransactionPrecision: 'DAY' as const }])('requires an owner for matching-critical edits: %j', async (corrected) => {
    const context = setup();
    await expect(context.correct({ corrected }, false)).rejects.toMatchObject({ code: 'OWNER_ONLY' });
    expect(context.writes()).toEqual([]);
    await context.correct({ corrected });
    expect(context.reconcile.scheduleRecord).toHaveBeenCalledOnce();
  });

  it('still refuses another staff member’s record, even for an unchanged save', async () => {
    const context = setup();
    await expect(context.correct({}, false, 'other-cashier')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(context.writes()).toEqual([]);
  });

  it('never edits a voided record', async () => {
    const context = setup({ evidence_state: 'VOIDED' });
    await expect(context.correct({ corrected: { amountCentavos: 150000 } })).rejects.toMatchObject({ code: 'RECORD_VOIDED' });
    expect(context.writes()).toEqual([]);
  });
});
