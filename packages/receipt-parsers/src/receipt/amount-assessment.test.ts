import { describe, expect, it } from 'vitest';
import { extractReceiptFields } from './extract';
import { assessReceiptAmount } from './amount-assessment';

describe('amount review decisions', () => {
  it('saves a clear labelled amount even if provider/time/listening evidence is absent', () => {
    expect(assessReceiptAmount(extractReceiptFields('Amount PHP 125.00'))).toEqual({ ready: true, reason: 'READY' });
  });
  it('asks about a standalone balance or unexplained currency value', () => {
    expect(assessReceiptAmount(extractReceiptFields('Available balance\nPHP 125.00')).reason).toBe('UNLABELLED');
  });
  it('asks when the amount, fee and total disagree', () => {
    expect(assessReceiptAmount(extractReceiptFields('Amount PHP 125.00\nFee PHP 10.00\nTotal PHP 140.00')).reason).toBe('CONFLICTING');
  });
  it('asks when the printed amount line includes competing values', () => {
    expect(assessReceiptAmount(extractReceiptFields('Amount PHP 125.00 PHP 150.00')).reason).toBe('CONFLICTING');
  });
  it('asks about conflicting amount labels on separate lines', () => {
    expect(assessReceiptAmount(extractReceiptFields('Amount PHP 125.00\nAmount paid PHP 150.00')).reason).toBe('CONFLICTING');
  });
  it('asks about low OCR confidence only for the amount field', () => {
    const receipt = extractReceiptFields('Amount PHP 125.00');
    expect(assessReceiptAmount(receipt, [{ text: 'PHP 125.00', confidence: 0.6, box: null }]).reason).toBe('LOW_OCR_CONFIDENCE');
    expect(assessReceiptAmount(receipt, [{ text: 'Footer text', confidence: 0.3, box: null }]).ready).toBe(true);
  });
});
