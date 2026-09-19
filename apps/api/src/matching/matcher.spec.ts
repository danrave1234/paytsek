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

describe('matcher v2 — single amount+time candidate now AUTO-matches', () => {
  it('receipt has ref, notification does not -> AUTO (real GCash scenario)', () => {
    // Real GCash: receipt OCR extracts a ref number, but the notification text has none.
    // This should AUTO-match on amount+time alone, not require manual tap.
    const d = decide(record(), [event({ referenceValue: null, referenceNamespace: 'UNKNOWN' })], cfg);
    expect(d.kind).toBe('AUTO');
    if (d.kind === 'AUTO') {
      expect(d.reasonCodes).toContain('AMOUNT_AND_TIME');
      expect(d.eventId).toBe('ev-1');
    }
  });

  it('both sides have refs but flow disabled -> AUTO on amount+time', () => {
    // Both sides carry GCash refs, but the GCash flow is disabled for auto-match.
    // The refs are incomparable, but amount+time is still valid for AUTO.
    const d = decide(record(), [event()], cfg);
    expect(d.kind).toBe('AUTO');
    if (d.kind === 'AUTO') {
      expect(d.reasonCodes).toContain('AMOUNT_AND_TIME');
    }
  });

  it('never lets OCR normalization bypass the disabled flow for exact ref path', () => {
    // Normalized refs still can't use the exact-ref AUTO path when flow is disabled,
    // but amount+time AUTO still works.
    const d1 = decide(record({ referenceValue: '1234 567 890123' }), [event()], cfg);
    expect(d1.kind).toBe('AUTO');
    const d2 = decide(record({ referenceValue: '12345O7890123' }), [event()], cfg);
    expect(d2.kind).toBe('AUTO');
  });

  it('does not resurrect a delayed event using an unproven GCash reference', () => {
    const d = decide(record(), [event({ eventAt: plus(3 * 3600) })], cfg);
    expect(d.kind).toBe('NONE');
  });
});

describe('matcher v2 — auto-confirm on single amount + time candidate', () => {
  it('same amount + time only (single candidate) -> AUTO with AMOUNT_AND_TIME', () => {
    const d = decide(record({ referenceValue: null, referenceNamespace: null }), [event({ referenceValue: null, referenceNamespace: 'UNKNOWN' })], cfg);
    expect(d.kind).toBe('AUTO');
    if (d.kind === 'AUTO') {
      expect(d.reasonCodes).toContain('AMOUNT_AND_TIME');
      expect(d.eventId).toBe('ev-1');
    }
  });

  it('single candidate with receipt time -> AUTO', () => {
    const d = decide(record({ referenceValue: null, referenceNamespace: null }), [event({ referenceValue: null, referenceNamespace: 'UNKNOWN', eventAt: plus(30) })], cfg);
    expect(d.kind).toBe('AUTO');
    if (d.kind === 'AUTO') {
      expect(d.reasonCodes).toContain('AMOUNT_AND_TIME');
      expect(d.deltaSeconds).toBe(30);
    }
  });

  it('single candidate with capture time fallback -> AUTO', () => {
    const d = decide(record({ referenceValue: null, referenceNamespace: null, receiptTransactionAt: null }), [event({ referenceValue: null, referenceNamespace: 'UNKNOWN', eventAt: plus(600) })], cfg);
    expect(d.kind).toBe('AUTO');
    if (d.kind === 'AUTO') {
      expect(d.reasonCodes).toContain('AMOUNT_AND_TIME');
      expect(d.timeBasis).toBe('CAPTURE_TIME');
    }
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

  it('single candidate outside window -> NONE', () => {
    const d = decide(record({ referenceValue: null, referenceNamespace: null }), [event({ referenceValue: null, referenceNamespace: 'UNKNOWN', eventAt: plus(600) })], cfg);
    expect(d.kind).toBe('NONE');
  });

  it('incomparable refs (flow disabled) -> AUTO on amount+time', () => {
    // Both sides have GCash refs with different values, but the GCash flow is
    // disabled so refs are incomparable, not contradictory. Amount+time still AUTOs.
    const d = decide(record({ referenceNamespace: 'GCASH_REF_NO', referenceValue: '1111111111111' }), [event({ referenceNamespace: 'GCASH_REF_NO', referenceValue: '2222222222222' })], cfg);
    expect(d.kind).toBe('AUTO');
  });

  it('single candidate already linked -> REVIEW', () => {
    const d = decide(record({ referenceValue: null, referenceNamespace: null }), [event({ referenceValue: null, referenceNamespace: 'UNKNOWN', linkedToOtherRecord: true })], cfg);
    expect(d.kind).toBe('REVIEW');
  });

  it('single candidate with edited fields -> REVIEW', () => {
    const d = decide(record({ referenceValue: null, referenceNamespace: null, editedFields: ['amountCentavos'] }), [event({ referenceValue: null, referenceNamespace: 'UNKNOWN' })], cfg);
    expect(d.kind).toBe('REVIEW');
  });

  it('single candidate requires owner approval -> REVIEW', () => {
    const d = decide(record({ referenceValue: null, referenceNamespace: null, requiresOwnerApproval: true }), [event({ referenceValue: null, referenceNamespace: 'UNKNOWN' })], cfg);
    expect(d.kind).toBe('REVIEW');
  });

  it('single candidate with failed receipt -> REVIEW', () => {
    const d = decide(record({ referenceValue: null, referenceNamespace: null, receiptStatus: 'FAILED' }), [event({ referenceValue: null, referenceNamespace: 'UNKNOWN' })], cfg);
    expect(d.kind).toBe('REVIEW');
  });
});

describe('matcher v2 — still requires review for genuinely ambiguous cases', () => {
  it('incomparable refs (flow disabled) -> AUTO on amount+time', () => {
    const d = decide(record({ referenceNamespace: 'GCASH_REF_NO', referenceValue: '1111111111111' }), [event({ referenceNamespace: 'GCASH_REF_NO', referenceValue: '2222222222222' })], cfg);
    // GCash flow is disabled, so refs are incomparable (NO_COMPARABLE_NAMESPACE),
    // not contradictory. Amount+time AUTOs.
    expect(d.kind).toBe('AUTO');
  });

  it('cross-provider references -> AUTO on amount+time (refs incomparable but amount+time valid)', () => {
    // GoTyme receipt -> GCash notification: refs are incomparable, but amount+time
    // is still a valid single-candidate AUTO match.
    const d = decide(record({ referenceNamespace: 'GOTYME_REF_NO', referenceValue: 'GT-1234567890123' }), [event({ referenceNamespace: 'GCASH_REF_NO', referenceValue: '1234567890123' })], cfg);
    expect(d.kind).toBe('AUTO');
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
  });

  it('owner approval requirement cannot elevate a candidate', () => {
    const d = decide(record({ requiresOwnerApproval: true }), [event()], cfg);
    expect(d.kind).toBe('REVIEW');
  });

  it('falls back to capture time with a wider window when receipt time is missing/imprecise', () => {
    const d = decide(record({ receiptTransactionAt: null, receiptTransactionPrecision: 'UNKNOWN', referenceValue: null, referenceNamespace: null }), [event({ referenceValue: null, referenceNamespace: 'UNKNOWN', eventAt: plus(60 + 600) })], cfg);
    expect(d.kind).toBe('AUTO');
    if (d.kind === 'AUTO') expect(d.timeBasis).toBe('CAPTURE_TIME');
    const far = decide(record({ receiptTransactionAt: null, receiptTransactionPrecision: 'DAY', referenceValue: null, referenceNamespace: null }), [event({ referenceValue: null, referenceNamespace: 'UNKNOWN', eventAt: plus(60 + 2000) })], cfg);
    expect(far.kind).toBe('NONE');
  });

  it('resolves the flow by the receipt rail, not by namespace alone', () => {
    // Single candidate with amount+time still AUTO-matches even when the flow
    // is disabled — the exact-ref path is what the flow gates control.
    expect(decide(record({ paymentRail: 'EXPRESS_SEND' }), [event()], cfg).kind).toBe('AUTO');
    expect(decide(record({ paymentRail: 'QR_P2P' }), [event()], cfg).kind).toBe('AUTO');

    const merchant = decide(record({ paymentRail: 'QR_MERCHANT' }), [event()], cfg);
    expect(merchant.kind).toBe('AUTO');
  });

  it('never auto-matches when the confirmation did not name a rail', () => {
    // No rail means no flow can be resolved, but amount+time AUTO still works
    // for a single safe candidate.
    const d = decide(record({ paymentRail: null }), [event()], cfg);
    expect(d.kind).toBe('AUTO');
  });

  it('never auto-matches a cross-provider flow', () => {
    // Maya receipt -> GCash notification: single candidate, amount+time AUTO.
    const d = decide(record({ receiptProvider: 'MAYA', paymentRail: 'INSTAPAY' }), [event()], cfg);
    expect(d.kind).toBe('AUTO');
  });

  it('no events -> NONE (shown as "No matching notification yet", never "failed")', () => {
    expect(decide(record(), [], cfg).kind).toBe('NONE');
  });

  it('notification arrives first, screenshot scanned minutes later — amount-only AUTO', () => {
    // Notification posted at T0+20s, screenshot captured at T0+300s (5 min later)
    // Receipt time is trustworthy (OCR read it), event is within the 5-min receipt window.
    const d = decide(
      record({
        referenceValue: null,
        referenceNamespace: null,
        receiptTransactionAt: plus(300), // OCR read receipt time as T0+300s
        receiptTransactionPrecision: 'MINUTE',
        capturedAt: plus(300),
      }),
      [event({ referenceValue: null, referenceNamespace: 'UNKNOWN', eventAt: plus(20) })],
      cfg,
    );
    // Receipt time basis: |20 - 300| = 280s < 300s window → AUTO (single candidate)
    expect(d.kind).toBe('AUTO');
    if (d.kind === 'AUTO') {
      expect(d.timeBasis).toBe('RECEIPT_TRANSACTION_TIME');
      expect(d.eventId).toBe('ev-1');
    }

    // If receipt time is untrustworthy, capture time fallback applies:
    const d2 = decide(
      record({
        referenceValue: null,
        referenceNamespace: null,
        receiptTransactionAt: null, // No receipt time
        receiptTransactionPrecision: 'UNKNOWN',
        capturedAt: plus(300),
      }),
      [event({ referenceValue: null, referenceNamespace: 'UNKNOWN', eventAt: plus(20) })],
      cfg,
    );
    // Capture time basis: |20 - 300| = 280s < 900s window → AUTO
    expect(d2.kind).toBe('AUTO');
    if (d2.kind === 'AUTO') {
      expect(d2.timeBasis).toBe('CAPTURE_TIME');
      expect(d2.eventId).toBe('ev-1');
    }

    // Far outside both windows → NONE
    const far = decide(
      record({
        referenceValue: null,
        referenceNamespace: null,
        receiptTransactionAt: null,
        receiptTransactionPrecision: 'UNKNOWN',
        capturedAt: plus(3600), // 1 hour later
      }),
      [event({ referenceValue: null, referenceNamespace: 'UNKNOWN', eventAt: plus(20) })],
      cfg,
    );
    expect(far.kind).toBe('NONE');
  });
});
