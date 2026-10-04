import type { OcrResult } from '@paytsek/contracts';
import { findMoneyCandidates } from '../money';
import type { ReceiptExtraction } from './extract';

export type ReceiptAmountAssessment = { ready: boolean; reason: 'READY' | 'MISSING' | 'UNLABELLED' | 'CONFLICTING' | 'LOW_OCR_CONFIDENCE' };

/** Field-specific confidence: other missing receipt fields must not block saving. */
export function assessReceiptAmount(receipt: ReceiptExtraction, blocks: OcrResult['blocks'] = []): ReceiptAmountAssessment {
  const { amountCentavos: amount, feeCentavos: fee, totalChargedCentavos: total } = receipt.fields;
  if (!amount) return { ready: false, reason: 'MISSING' };
  if (receipt.conflictingAmountLabels) return { ready: false, reason: 'CONFLICTING' };
  if (fee !== null && total !== null && amount + fee !== total) return { ready: false, reason: 'CONFLICTING' };
  const source = receipt.provenance.amountCentavos ?? '';
  if (!/(?<!Total\s)\bAmount\b/i.test(source)) return { ready: false, reason: 'UNLABELLED' };
  const amountValues = new Set(findMoneyCandidates(source).map((candidate) => candidate.centavos));
  if (amountValues.size !== 1 || !amountValues.has(amount)) return { ready: false, reason: 'CONFLICTING' };
  // OCR confidence may be unavailable on Android. A known low-confidence amount
  // must be reviewed; absence of a score is not evidence of an unreadable proof.
  const matching = blocks.filter((block) => findMoneyCandidates(block.text).some((candidate) => candidate.centavos === amount));
  if (matching.some((block) => block.confidence !== null && block.confidence < 0.8)) return { ready: false, reason: 'LOW_OCR_CONFIDENCE' };
  return { ready: true, reason: 'READY' };
}
