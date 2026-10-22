import type { ListRecordsQuery, RecordSummary } from '@paytsek/contracts';
import { parseMoneyExact } from '@paytsek/receipt-parsers';
import { providerLabel } from './feed';

export type RecordFilters = Pick<ListRecordsQuery, 'q' | 'state' | 'provider'>;
type SearchableRecord = Pick<RecordSummary, 'receiptProvider' | 'amountCentavos' | 'evidenceState'>;

/** Apply the same visible-field filters to local scans and cached server rows. */
export function matchesRecordFilters(record: SearchableRecord, filters: RecordFilters): boolean {
  if (filters.provider && record.receiptProvider !== filters.provider) return false;
  if (filters.state?.length && !filters.state.includes(record.evidenceState)) return false;
  const search = filters.q?.trim() ?? '';
  return !search || providerLabel(record.receiptProvider).toLowerCase().includes(search.toLowerCase()) ||
    parseMoneyExact(search)?.centavos === record.amountCentavos;
}
