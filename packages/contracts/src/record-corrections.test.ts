import { describe, expect, it } from 'vitest';
import { CorrectRecordRequest, ReceiptFields, receiptFieldChanges } from './index';

const current: ReceiptFields = {
  amountCentavos: 125000, currency: 'PHP', receiptProvider: 'GCASH', paymentRail: 'EXPRESS_SEND',
  feeCentavos: null, totalChargedCentavos: null, referenceNamespace: null, referenceValue: null,
  payerName: null, payerPhone: null, payeeName: null, payeePhone: null,
  receiptTransactionAt: '2026-10-04T02:00:00.000Z', receiptTransactionPrecision: 'MINUTE', receiptStatus: 'SUCCESS',
};

describe('receipt corrections', () => {
  it.each([{ amountCentavos: null }, { amountCentavos: 0 }, { amountCentavos: 1.5 }, { currency: null }])('rejects invalid persisted fields: %j', (corrected) => {
    expect(CorrectRecordRequest.safeParse({ corrected, reason: 'Synthetic correction' }).success).toBe(false);
  });

  it('allows omission and explicit clearing of optional evidence', () => {
    const patch = { receiptProvider: null, referenceValue: null, receiptTransactionAt: null };
    expect(CorrectRecordRequest.parse({ corrected: patch, reason: 'Synthetic correction' }).corrected).toEqual(patch);
    expect(receiptFieldChanges(current, patch)).toEqual({ receiptProvider: null, receiptTransactionAt: null });
    expect(current.receiptProvider).toBe('GCASH');
  });

  it('ignores unchanged values, omitted keys and equivalent timestamp representations', () => {
    expect(receiptFieldChanges(current, { amountCentavos: 125000, receiptProvider: 'GCASH', feeCentavos: undefined,
      receiptTransactionAt: '2026-10-04T02:00:00Z' })).toEqual({});
    expect(receiptFieldChanges(current, {})).toEqual({});
  });

  it('returns only the actual receipt changes', () => {
    expect(receiptFieldChanges(current, { amountCentavos: 150000, receiptProvider: 'GCASH', receiptTransactionPrecision: 'DAY', receiptStatus: 'PENDING' }))
      .toEqual({ amountCentavos: 150000, receiptTransactionPrecision: 'DAY', receiptStatus: 'PENDING' });
  });
});
