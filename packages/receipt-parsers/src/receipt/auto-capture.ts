import type { ReceiptExtraction } from './extract';

export interface AutoCaptureAssessment {
  eligible: boolean;
  fingerprint: string | null;
  reason: 'READY' | 'NO_AMOUNT' | 'NO_PROVIDER' | 'LOW_CONFIDENCE' | 'NOT_SUCCESSFUL' | 'TOO_LITTLE_EVIDENCE';
}

/**
 * Conservative camera auto-capture gate. One OCR amount is never enough:
 * require a decisive provider, successful status and another receipt signal.
 * The caller must still see the same fingerprint in two consecutive frames.
 */
export function assessReceiptForAutoCapture(receipt: ReceiptExtraction): AutoCaptureAssessment {
  const fields = receipt.fields;
  if (!fields.amountCentavos) return { eligible: false, fingerprint: null, reason: 'NO_AMOUNT' };
  if (!fields.receiptProvider) return { eligible: false, fingerprint: null, reason: 'NO_PROVIDER' };
  if (receipt.providerDetection.confidence < 0.5) return { eligible: false, fingerprint: null, reason: 'LOW_CONFIDENCE' };
  if (fields.receiptStatus !== 'SUCCESS') return { eligible: false, fingerprint: null, reason: 'NOT_SUCCESSFUL' };
  const corroborating = Boolean(fields.referenceValue || fields.receiptTransactionAt || fields.paymentRail);
  if (!corroborating || receipt.readabilityScore < 0.6) {
    return { eligible: false, fingerprint: null, reason: 'TOO_LITTLE_EVIDENCE' };
  }
  return {
    eligible: true,
    fingerprint: [
      fields.receiptProvider,
      fields.amountCentavos,
      fields.referenceValue ?? '',
      fields.receiptTransactionAt ?? '',
      fields.paymentRail ?? '',
    ].join('|'),
    reason: 'READY',
  };
}
