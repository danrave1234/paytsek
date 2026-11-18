import { receiptFieldChanges, type CorrectRecordRequest, type ReceiptFields } from '@paytsek/contracts';
import { rowFields, type RecordRow } from './records.rows';

/** Only these static identifiers may enter the correction UPDATE statement. */
const COLUMNS = {
  amountCentavos: 'amount_centavos', currency: 'currency', feeCentavos: 'fee_centavos',
  totalChargedCentavos: 'total_charged_centavos', receiptProvider: 'receipt_provider',
  paymentRail: 'payment_rail', referenceNamespace: 'reference_namespace', referenceValue: 'reference_value',
  payerName: 'payer_name', payerPhone: 'payer_phone', payeeName: 'payee_name', payeePhone: 'payee_phone',
  receiptTransactionAt: 'receipt_transaction_at', receiptTransactionPrecision: 'receipt_transaction_precision',
  receiptStatus: 'receipt_status',
} as const satisfies Record<keyof ReceiptFields, keyof RecordRow>;

/** Build a minimal, parameterized patch against the locked row, including nulls. */
export function recordCorrection(row: RecordRow, input: CorrectRecordRequest) {
  const corrected = receiptFieldChanges(rowFields(row), input.corrected);
  const changed = Object.keys(corrected);
  const values: unknown[] = [];
  const assignments: string[] = [];
  const assign = (column: string, value: unknown) => {
    values.push(value);
    assignments.push(`${column} = $${values.length + 2}`); // $1 = workspace, $2 = record
  };
  for (const key of Object.keys(COLUMNS) as Array<keyof typeof COLUMNS>) {
    if (corrected[key] !== undefined) assign(COLUMNS[key], corrected[key]);
  }
  for (const [key, column] of [['customerLabel', 'customer_label'], ['note', 'note']] as const) {
    if (input[key] !== undefined && input[key] !== row[column]) {
      changed.push(key);
      assign(column, input[key]);
    }
  }
  return { corrected, changed, values, assignments };
}
