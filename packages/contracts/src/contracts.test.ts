import { describe, expect, it } from 'vitest';
import {
  AUTO_MATCH_DISCLOSURE,
  EVIDENCE_STATE_LABELS,
  EvidenceState,
  IncomingPaymentEventInput,
  PLAN_LIMITS,
  ReceiptFields,
} from './index';

describe('contracts', () => {
  it('has a label for every evidence state and never uses forbidden wording', () => {
    for (const state of EvidenceState.options) {
      const label = EVIDENCE_STATE_LABELS[state];
      expect(label).toBeTruthy();
      expect(label.toLowerCase()).not.toContain('gcash verified');
      expect(label).not.toBe('VERIFIED');
      expect(label).not.toMatch(/\d+%/);
    }
    expect(EvidenceState.options).not.toContain('PROVIDER_VERIFIED');
    expect(AUTO_MATCH_DISCLOSURE).toContain('not confirmed directly with the payment provider');
  });

  it('free plan supports the remote-owner/cashier workflow (pairing is not paid-only)', () => {
    expect(PLAN_LIMITS.FREE.collectorDevices).toBeGreaterThanOrEqual(1);
    expect(PLAN_LIMITS.FREE.scannerDevices).toBeGreaterThanOrEqual(1);
    expect(PLAN_LIMITS.FREE.members).toBeGreaterThanOrEqual(2);
  });

  it('receipt fields allow every value to be null (nothing is invented)', () => {
    const parsed = ReceiptFields.parse({
      receiptProvider: null,
      paymentRail: null,
      currency: null,
      amountCentavos: null,
      feeCentavos: null,
      totalChargedCentavos: null,
      referenceNamespace: null,
      referenceValue: null,
      payerName: null,
      payerPhone: null,
      payeeName: null,
      payeePhone: null,
      receiptTransactionAt: null,
      receiptTransactionPrecision: 'UNKNOWN',
      receiptStatus: 'UNKNOWN',
    });
    expect(parsed.amountCentavos).toBeNull();
  });

  it('rejects non-integer or non-positive event amounts', () => {
    const base = {
      clientEventId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      provider: 'GCASH',
      sourcePackage: 'com.globe.gcash.android',
      sourceAppVersionName: null,
      sourceAppVersionCode: null,
      parserId: 'gcash.express_send.incoming',
      parserVersion: '1',
      paymentRail: 'EXPRESS_SEND',
      currency: 'PHP',
      referenceNamespace: 'GCASH_REF_NO',
      referenceValue: '1234567890123',
      payerMaskedName: 'JU•N D.',
      payerMaskedPhone: null,
      providerDescribedAt: null,
      notificationWhenAt: null,
      postedAt: '2026-09-08T01:00:00.000Z',
      capturedAt: '2026-09-08T01:00:00.000Z',
      monotonicCaptureMs: 1,
      bootSessionId: 'boot',
      lifecycleDedupKey: 'k',
      normalizedTextSha256: 'a'.repeat(64),
    };
    expect(IncomingPaymentEventInput.safeParse({ ...base, amountCentavos: 150.5 }).success).toBe(false);
    expect(IncomingPaymentEventInput.safeParse({ ...base, amountCentavos: 0 }).success).toBe(false);
    expect(IncomingPaymentEventInput.safeParse({ ...base, amountCentavos: 15050 }).success).toBe(true);
  });
});
