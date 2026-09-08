import { describe, expect, it } from 'vitest';
import { decide, type MatchEventInput, type MatchRecordInput, type MatcherConfig } from './matcher';

const cfg: MatcherConfig = { candidateWindowSeconds: 300, captureTimeFallbackWindowSeconds: 900 };
const T0 = '2026-09-08T01:05:00.000Z';
const plus = (s: number) => new Date(new Date(T0).getTime() + s * 1000).toISOString();

function record(over: Partial<MatchRecordInput> = {}): MatchRecordInput {
  return {
    id: 'rec-1',
    receivingProvider: 'GCASH',
    receiptProvider: 'GCASH',
    paymentRail: 'EXPRESS_SEND',
    currency: 'PHP',
    amountCentavos: 125000,
    referenceNamespace: 'GCASH_REF_NO',
    referenceValue: '1234567890123',
    receiptStatus: 'SUCCESS',
    receiptTransactionAt: T0,
    receiptTransactionPrecision: 'MINUTE',
    capturedAt: plus(60),
    editedFields: [],
    requiresOwnerApproval: false,
    ...over,
  };
}

function event(over: Partial<MatchEventInput> = {}): MatchEventInput {
  return {
    id: 'ev-1',
    currency: 'PHP',
    amountCentavos: 125000,
    referenceNamespace: 'GCASH_REF_NO',
    referenceValue: '1234567890123',
    eventAt: plus(20),
    eventTimeSource: 'POSTED',
    linkedToOtherRecord: false,
    ...over,
  };
}

describe('matcher v1 — automatic match', () => {
  it('auto-matches on exact comparable reference + exact amount + same source', () => {
    const d = decide(record(), [event()], cfg);
    expect(d.kind).toBe('AUTO');
    if (d.kind === 'AUTO') {
      expect(d.eventId).toBe('ev-1');
      expect(d.reasonCodes).toEqual(['EXACT_REFERENCE_AND_AMOUNT']);
      expect(d.timeBasis).toBe('RECEIPT_TRANSACTION_TIME');
      expect(d.flowId).toBe('gcash-to-gcash.express-send');
    }
  });

  it('tolerates OCR spacing in the reference but never character substitutions', () => {
    expect(decide(record({ referenceValue: '1234 567 890123' }), [event()], cfg).kind).toBe('AUTO');
    expect(decide(record({ referenceValue: '12345O7890123' }), [event()], cfg).kind).not.toBe('AUTO');
  });

  it('accepts a delayed exact-ID match outside the window and explains the delay', () => {
    const d = decide(record(), [event({ eventAt: plus(3 * 3600) })], cfg);
    expect(d.kind).toBe('AUTO');
    if (d.kind === 'AUTO') expect(d.reasonCodes).toContain('DELAYED_EXACT_REFERENCE');
  });
});

describe('matcher v1 — never auto-confirm on weak evidence', () => {
  it('same amount + time only (single candidate) -> REVIEW, never AUTO', () => {
    const d = decide(record({ referenceValue: null, referenceNamespace: null }), [event({ referenceValue: null, referenceNamespace: 'UNKNOWN' })], cfg);
    expect(d.kind).toBe('REVIEW');
    if (d.kind === 'REVIEW') {
      expect(d.reasonCodes).toContain('AMOUNT_ONLY_CANDIDATES');
      expect(d.candidates).toHaveLength(1);
      expect(d.candidates[0]!.blockers).toContain('AMOUNT_ONLY_CANDIDATES');
    }
  });

  it('reference on receipt only (notification has none) -> REVIEW', () => {
    const d = decide(record(), [event({ referenceValue: null, referenceNamespace: 'UNKNOWN' })], cfg);
    expect(d.kind).toBe('REVIEW');
    if (d.kind === 'REVIEW') expect(d.candidates[0]!.missingFields).toContain('notification.reference');
  });

  it('three same-amount payments -> distinct candidates, no arbitrary assignment', () => {
    const evs = [event({ id: 'a', referenceValue: null, referenceNamespace: 'UNKNOWN', eventAt: plus(10) }), event({ id: 'b', referenceValue: null, referenceNamespace: 'UNKNOWN', eventAt: plus(40) }), event({ id: 'c', referenceValue: null, referenceNamespace: 'UNKNOWN', eventAt: plus(-30) })];
    const d = decide(record({ referenceValue: null, referenceNamespace: null }), evs, cfg);
    expect(d.kind).toBe('REVIEW');
    if (d.kind === 'REVIEW') {
      expect(d.candidates.map((c) => c.event.id)).toEqual(['a', 'c', 'b']); // sorted by |delta|
      expect(d.reasonCodes).toContain('MULTIPLE_CANDIDATES');
    }
  });

  it('cross-provider references never map (GoTyme receipt -> GCash notification)', () => {
    // Both sides carry a valid reference in their own namespace; the values are never compared across providers.
    const d = decide(record({ referenceNamespace: 'GOTYME_REF_NO', referenceValue: 'GT-1234567890123' }), [event({ referenceNamespace: 'GCASH_REF_NO', referenceValue: '1234567890123' })], cfg);
    expect(d.kind).not.toBe('AUTO');
    if (d.kind === 'REVIEW') expect(d.reasonCodes).toContain('NO_COMPARABLE_NAMESPACE');
  });

  it('amount mismatch is never a candidate', () => {
    const d = decide(record(), [event({ amountCentavos: 125001 })], cfg);
    expect(d.kind).toBe('NONE');
  });

  it('two events with the same exact reference -> REVIEW (provider key reuse / ambiguity)', () => {
    const d = decide(record(), [event({ id: 'a' }), event({ id: 'b', eventAt: plus(90) })], cfg);
    expect(d.kind).toBe('REVIEW');
    if (d.kind === 'REVIEW') expect(d.reasonCodes).toContain('MULTIPLE_CANDIDATES');
  });

  it('event already linked to another record is never auto-claimed again', () => {
    const d = decide(record(), [event({ linkedToOtherRecord: true })], cfg);
    expect(d.kind).toBe('REVIEW');
    if (d.kind === 'REVIEW') expect(d.candidates[0]!.blockers).toContain('EVENT_ALREADY_LINKED');
  });

  it('failed/pending receipt status blocks auto-match even with exact reference', () => {
    expect(decide(record({ receiptStatus: 'FAILED' }), [event()], cfg).kind).toBe('REVIEW');
    expect(decide(record({ receiptStatus: 'PENDING' }), [event()], cfg).kind).toBe('REVIEW');
  });

  it('user-edited matching-critical field -> REVIEW', () => {
    const d = decide(record({ editedFields: ['referenceValue'] }), [event()], cfg);
    expect(d.kind).toBe('REVIEW');
    if (d.kind === 'REVIEW') expect(d.reasonCodes).toContain('RECEIPT_EDITED_AFTER_MATCH');
    // Non-critical edits (customer label) do not block.
    expect(decide(record({ editedFields: ['customerLabel'] }), [event()], cfg).kind).toBe('AUTO');
  });

  it('owner approval requirement for staff records -> REVIEW with the exact candidate', () => {
    const d = decide(record({ requiresOwnerApproval: true }), [event()], cfg);
    expect(d.kind).toBe('REVIEW');
    if (d.kind === 'REVIEW') expect(d.candidates[0]!.supportingFields).toContain('reference');
  });

  it('falls back to capture time with a wider window when receipt time is missing/imprecise', () => {
    const d = decide(record({ receiptTransactionAt: null, receiptTransactionPrecision: 'UNKNOWN', referenceValue: null, referenceNamespace: null }), [event({ referenceValue: null, referenceNamespace: 'UNKNOWN', eventAt: plus(60 + 600) })], cfg);
    expect(d.kind).toBe('REVIEW');
    if (d.kind === 'REVIEW') expect(d.timeBasis).toBe('CAPTURE_TIME');
    const far = decide(record({ receiptTransactionAt: null, receiptTransactionPrecision: 'DAY', referenceValue: null, referenceNamespace: null }), [event({ referenceValue: null, referenceNamespace: 'UNKNOWN', eventAt: plus(60 + 2000) })], cfg);
    expect(far.kind).toBe('NONE');
  });

  it('resolves the flow by the receipt rail, not by namespace alone', () => {
    // Both GCash-to-GCash rails are enabled in the registry.
    expect(decide(record({ paymentRail: 'EXPRESS_SEND' }), [event()], cfg).kind).toBe('AUTO');
    expect(decide(record({ paymentRail: 'QR_P2P' }), [event()], cfg).kind).toBe('AUTO');

    // Merchant QR shares the provider and namespace but its own flow is
    // disabled, so it must go to Review rather than borrow an enabled rule.
    const merchant = decide(record({ paymentRail: 'QR_MERCHANT' }), [event()], cfg);
    expect(merchant.kind).toBe('REVIEW');
    if (merchant.kind === 'REVIEW') expect(merchant.candidates[0]!.blockers).toContain('NO_COMPARABLE_NAMESPACE');
  });

  it('never auto-matches when the confirmation did not name a rail', () => {
    const d = decide(record({ paymentRail: null }), [event()], cfg);
    expect(d.kind).toBe('REVIEW');
  });

  it('never auto-matches a cross-provider flow', () => {
    const d = decide(record({ receiptProvider: 'MAYA', paymentRail: 'INSTAPAY' }), [event()], cfg);
    expect(d.kind).toBe('REVIEW');
  });

  it('no events -> NONE (shown as "No matching notification yet", never "failed")', () => {
    expect(decide(record(), [], cfg).kind).toBe('NONE');
  });
});
