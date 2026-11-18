import { ReceiptFields, type CorrectRecordRequest } from './schemas/records';

/** Compare persisted receipt values; omission and explicit clearing are distinct. */
export function receiptFieldChanges(current: ReceiptFields, proposed: CorrectRecordRequest['corrected']): CorrectRecordRequest['corrected'] {
  const changes: CorrectRecordRequest['corrected'] = {};
  for (const key of Object.keys(ReceiptFields.shape) as Array<keyof ReceiptFields>) {
    const next = proposed[key];
    if (next === undefined || next === current[key]) continue;
    // Equivalent ISO representations are the same transaction instant.
    if (key === 'receiptTransactionAt' && next && current.receiptTransactionAt &&
      Date.parse(String(next)) === Date.parse(current.receiptTransactionAt)) continue;
    Object.assign(changes, { [key]: next });
  }
  return changes;
}
