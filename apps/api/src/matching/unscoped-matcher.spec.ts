import { describe, expect, it } from 'vitest';
import type { MatchRecordInput, MatcherConfig } from './matcher';
import { decideUnscoped } from './unscoped-matcher';

const config: MatcherConfig = { candidateWindowSeconds: 300, captureTimeFallbackWindowSeconds: 900 };
const record: Omit<MatchRecordInput, 'receivingProvider'> = {
  id: 'proof-first',
  receiptProvider: 'MAYA',
  paymentRail: 'QR_P2P',
  currency: 'PHP',
  amountCentavos: 85000,
  referenceNamespace: 'MAYA_REF_NO',
  referenceValue: 'receipt-only-reference',
  receiptStatus: 'SUCCESS',
  receiptTransactionAt: '2026-09-14T08:42:00.000Z',
  receiptTransactionPrecision: 'MINUTE',
  capturedAt: '2026-09-14T08:43:00.000Z',
  editedFields: [],
  requiresOwnerApproval: false,
};

describe('proof-first unscoped matching', () => {
  it('offers a nearby GCash notification without auto-confirming it', () => {
    const decision = decideUnscoped(record, [{
      provider: 'GCASH',
      event: {
        id: 'notification',
        currency: 'PHP',
        amountCentavos: 85000,
        referenceNamespace: 'UNKNOWN',
        referenceValue: null,
        eventAt: '2026-09-14T08:42:30.000Z',
        eventTimeSource: 'POSTED',
        linkedToOtherRecord: false,
      },
    }], config);
    expect(decision.kind).toBe('REVIEW');
    if (decision.kind === 'REVIEW') expect(decision.candidates[0]?.event.id).toBe('notification');
  });

  it('keeps equal amounts from two wallet listeners as separate choices', () => {
    const event = {
      id: 'gcash', currency: 'PHP' as const, amountCentavos: 85000, referenceNamespace: 'UNKNOWN' as const,
      referenceValue: null, eventAt: '2026-09-14T08:42:30.000Z', eventTimeSource: 'POSTED' as const, linkedToOtherRecord: false,
    };
    const decision = decideUnscoped(record, [
      { provider: 'GCASH', event },
      { provider: 'MAYA', event: { ...event, id: 'maya' } },
    ], config);
    expect(decision.kind).toBe('REVIEW');
    if (decision.kind === 'REVIEW') {
      expect(decision.candidates).toHaveLength(2);
      expect(decision.reasonCodes).toContain('MULTIPLE_CANDIDATES');
    }
  });
});
