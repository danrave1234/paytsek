import type { ReceiptExtraction } from './extract';
import { assessReceiptAmount } from './amount-assessment';

export interface AutoCaptureAssessment {
  eligible: boolean;
  fingerprint: string | null;
  reason: 'READY' | 'NO_AMOUNT' | 'NO_PROVIDER' | 'LOW_CONFIDENCE' | 'NOT_SUCCESSFUL' | 'TOO_LITTLE_EVIDENCE';
}

/**
 * Conservative camera auto-capture gate. Every completed wallet proof shows
 * a reference number and a dated transaction time, while price tags, QR
 * standees and other app screens usually show neither. So auto-capture
 * requires all of: a confident amount and provider, a success line, a
 * normalized reference and a minute-precision receipt time. Weak hints
 * (a "QR" word, a date alone) never qualify. Manual capture is unaffected.
 * The caller must still see the same fingerprint in two consecutive frames.
 */
export function assessReceiptForAutoCapture(receipt: ReceiptExtraction): AutoCaptureAssessment {
  const fields = receipt.fields;
  if (!fields.amountCentavos) return { eligible: false, fingerprint: null, reason: 'NO_AMOUNT' };
  if (!assessReceiptAmount(receipt).ready) return { eligible: false, fingerprint: null, reason: 'LOW_CONFIDENCE' };
  if (!fields.receiptProvider) return { eligible: false, fingerprint: null, reason: 'NO_PROVIDER' };
  if (receipt.providerDetection.confidence < 0.5) return { eligible: false, fingerprint: null, reason: 'LOW_CONFIDENCE' };
  if (fields.receiptStatus !== 'SUCCESS') return { eligible: false, fingerprint: null, reason: 'NOT_SUCCESSFUL' };
  const timed = fields.receiptTransactionAt !== null
    && (fields.receiptTransactionPrecision === 'MINUTE' || fields.receiptTransactionPrecision === 'SECOND');
  if (!fields.referenceValue || !timed || receipt.readabilityScore < 0.6) {
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
